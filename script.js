
const input = document.getElementById("messageInput");
const send = document.getElementById("sendBtn");
const chat = document.getElementById("chatMessages");
const imageInput = document.getElementById("imageInput");
const attachImageBtn = document.getElementById("attachImageBtn");
const imagePreview = document.getElementById("imagePreview");
const imagePreviewImg = document.getElementById("imagePreviewImg");
const imagePreviewName = document.getElementById("imagePreviewName");
const removeImageBtn = document.getElementById("removeImageBtn");
let pendingImage = null;
const historySearch = document.getElementById("historySearch");
const exportChatBtn = document.getElementById("exportChatBtn");
const workspaceSelect = document.getElementById("workspaceSelect");
const voiceInputBtn = document.getElementById("voiceInputBtn");
let speechRecognition = null;
let isListening = false;
let activeWorkspaceId = localStorage.getItem("nexActiveWorkspace") || "";
let conversationWorkspaceMap = {};
try {
    conversationWorkspaceMap = JSON.parse(localStorage.getItem("nexConversationWorkspaces") || "{}");
    if (!conversationWorkspaceMap || typeof conversationWorkspaceMap !== "object") conversationWorkspaceMap = {};
} catch { conversationWorkspaceMap = {}; }
let preferences = loadPreferences();

// ==========================
// GEMINI MODEL SELECTION
// ==========================

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_MODEL_STORAGE_KEY = "nexGeminiModel";
const ALLOWED_GEMINI_MODELS = [
    "gemini-4-carbon",
    "gemini-4-argon",
    "gemini-4-hydrogen",
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.1-pro-preview"
];

function loadGeminiModel() {
    const savedModel = localStorage.getItem(GEMINI_MODEL_STORAGE_KEY);
    return ALLOWED_GEMINI_MODELS.includes(savedModel)
        ? savedModel
        : DEFAULT_GEMINI_MODEL;
}

let selectedGeminiModel = loadGeminiModel();

function renderGeminiModel() {
    const modelSelect = document.getElementById("geminiModelSelect");
    const modelStatus = document.getElementById("geminiModelStatus");

    if (!modelSelect) return;

    modelSelect.value = selectedGeminiModel;

    if (modelStatus) {
        const selectedOption = modelSelect.selectedOptions[0];
        modelStatus.textContent = selectedOption
            ? `Aktif: ${selectedOption.textContent}`
            : "Model default";
    }
}

function loadPreferences() {
    try {
        const value = JSON.parse(localStorage.getItem("nexPreferences") || "{}");
        return {
            name: typeof value.name === "string" ? value.name : "",
            language: value.language === "en" ? "en" : "id",
            style: ["concise", "detailed"].includes(value.style) ? value.style : "balanced"
        };
    } catch {
        return { name: "", language: "id", style: "balanced" };
    }
}

const newChatBtn = document.getElementById("newChatBtn");
const conversationList = document.getElementById("conversationList");

let conversationId = null;
let conversation = [];
let conversations = [];
let isLoading = false;

// ==========================
// API HELPER
// ==========================

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const text = await response.text();
    let data;

    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`Server error (${response.status})`);
    }

    if (!response.ok) {
        throw new Error(data.message || data.error || "Permintaan gagal");
    }

    return data;
}

// ==========================
// NAVIGATION
// ==========================

const navButtons = document.querySelectorAll("[data-page]");
const pages = document.querySelectorAll(".page");

const pageTitles = {
    home: 'Your AI. <span>Connected.</span>',
    chat: 'AI <span>Chat.</span>',
    tools: 'AI <span>Tools.</span>',
    stock: 'Stock <span>Management.</span>',
    projects: 'My <span>Projects.</span>',
    settings: 'System <span>Settings.</span>'
};

function navigateTo(pageName) {
    const target = document.getElementById(pageName);
    if (!target) return;

    pages.forEach(page => {
        page.classList.toggle("active", page.id === pageName);
    });

    navButtons.forEach(button => {
        button.classList.toggle("active", button.dataset.page === pageName);
    });

    document.getElementById("pageTitle").innerHTML =
        pageTitles[pageName] || "NEX AI";

    if (pageName === "projects") renderProjects();
    if (pageName === "stock") loadStockProducts();

    if (pageName === "chat") {
        input.focus();
        chat.scrollTop = chat.scrollHeight;
    }
}

navButtons.forEach(button => {
    button.addEventListener("click", () => navigateTo(button.dataset.page));
});

document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => navigateTo(button.dataset.go));
});

// ==========================
// CONVERSATION HISTORY
// ==========================

async function loadConversations(query = "") {
    conversationList.innerHTML = `<p class="history-loading">Loading chats...</p>`;

    try {
        const data = await apiRequest(
            `/api/conversations${query ? `?q=${encodeURIComponent(query)}` : ""}`
        );

        conversations = data.conversations || [];
        renderConversationList();

    } catch (error) {
        conversationList.innerHTML = `
            <p class="history-empty">${escapeHTML(error.message)}</p>
        `;
    }
}

function renderConversationList() {
    conversationList.innerHTML = "";

    const visibleConversations = conversations.filter(item =>
        (conversationWorkspaceMap[String(item.id)] || "") === String(activeWorkspaceId || "")
    );

    if (visibleConversations.length === 0) {
        conversationList.innerHTML = `
            <p class="history-empty">Belum ada chat di workspace ini.</p>
        `;
        return;
    }

    visibleConversations.forEach(item => {
        const button = document.createElement("button");
        button.className = "history-item";

        if (String(item.id) === String(conversationId)) {
            button.classList.add("active");
        }

        button.textContent = item.title || "Chat Baru";
        button.title = item.title || "Chat Baru";
        button.addEventListener("click", () => openConversation(item.id));

        conversationList.appendChild(button);
    });
}

// ==========================
// CREATE NEW CHAT
// ==========================

async function createConversation(title = "Chat Baru") {
    const data = await apiRequest("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ title })
    });

    conversationId = data.conversation.id;
    conversation = [];

    conversationWorkspaceMap[String(conversationId)] = String(activeWorkspaceId || "");
    localStorage.setItem("nexConversationWorkspaces", JSON.stringify(conversationWorkspaceMap));

    await loadConversations();
    return conversationId;
}

// ==========================
// AUTOMATIC CHAT TITLE
// ==========================

function makeConversationTitle(message) {
    const cleanMessage = message.replace(/\s+/g, " ").trim();

    if (cleanMessage.length > 45) {
        return cleanMessage.slice(0, 44) + "…";
    }

    return cleanMessage;
}

async function updateConversationTitle(id, message) {
    const title = makeConversationTitle(message);

    await apiRequest("/api/conversations", {
        method: "PATCH",
        body: JSON.stringify({ id, title })
    });
}

// ==========================
// START NEW CHAT
// ==========================

async function startNewChat() {
    if (isLoading) return;

    try {
        await createConversation("Chat Baru");
        renderConversation();
        navigateTo("chat");
        input.focus();

    } catch (error) {
        alert("Gagal membuat chat: " + error.message);
    }
}

newChatBtn.addEventListener("click", startNewChat);

// ==========================
// OPEN OLD CHAT
// ==========================

async function openConversation(id) {
    if (isLoading) return;

    try {
        send.disabled = true;

        const data = await apiRequest(
            `/api/messages?conversationId=${encodeURIComponent(id)}`
        );

        conversationId = id;
        activeWorkspaceId = conversationWorkspaceMap[String(id)] || "";
        localStorage.setItem("nexActiveWorkspace", activeWorkspaceId);

        if (workspaceSelect) workspaceSelect.value = activeWorkspaceId;

        conversation = (data.messages || []).map(item => ({
            dbId: item.id,
            role: item.role,
            parts: [{ text: item.content }]
        }));

        renderConversation();
        renderConversationList();
        navigateTo("chat");

    } catch (error) {
        alert("Gagal membuka chat: " + error.message);

    } finally {
        send.disabled = false;
    }
}

// ==========================
// RENDER CHAT
// ==========================

function renderConversation() {
    chat.innerHTML = "";

    if (conversation.length === 0) {
        addMessage(
            "NEX AI",
            "Halo! 👋 Aku NEX AI. Ada yang ingin kamu kerjakan?",
            "ai"
        );

        const suggestions = document.createElement("div");
        suggestions.className = "suggestions";

        const options = [
            ["✦ About NEX AI", "Ceritakan tentang dirimu"],
            ["⌘ What can you do?", "Apa yang bisa kamu lakukan?"],
            ["✦ Project ideas", "Bantu saya membuat ide project"]
        ];

        options.forEach(([label, message]) => {
            const button = document.createElement("button");
            button.textContent = label;
            button.addEventListener("click", () => quickMessage(message));
            suggestions.appendChild(button);
        });

        chat.appendChild(suggestions);
        return;
    }

    conversation.forEach((item, index) => {
        const text = item.parts?.map(part => part.text || "").join("\n");
        if (!text) return;

        addMessage(
            item.role === "user" ? "YOU" : "NEX AI",
            text,
            item.role === "user" ? "user" : "ai",
            null,
            item.dbId,
            index
        );
    });

    chat.scrollTop = chat.scrollHeight;
}

// ==========================
// SEND MESSAGE
// ==========================

async function sendMessage() {
    const message = input.value.trim();
    const imageToSend = pendingImage;

    if ((!message && !imageToSend) || isLoading) return;

    isLoading = true;
    send.disabled = true;
    attachImageBtn.disabled = true;
    document.querySelector(".suggestions")?.remove();

    const visibleUserText = message || "Tolong analisis foto ini.";

    addMessage("YOU", visibleUserText, "user", imageToSend?.preview || null);

    input.value = "";
    autoResizeInput();
    clearPendingImage();

    const loading = document.createElement("div");
    loading.className = "message ai";

    const loadingTitle = document.createElement("strong");
    loadingTitle.textContent = "NEX AI";

    const loadingText = document.createElement("p");
    loadingText.textContent = imageToSend ? "Menganalisis foto..." : "Thinking...";

    loading.append(loadingTitle, loadingText);
    chat.appendChild(loading);
    chat.scrollTop = chat.scrollHeight;

    try {
        if (!conversationId) await createConversation("Chat Baru");

        const isFirstMessage = conversation.length === 0;
        const previousHistory = conversation.map(({ role, parts }) => ({ role, parts }));

        const storedUserText = imageToSend
            ? `${visibleUserText}\n[Foto dilampirkan — file foto tidak disimpan di riwayat]`
            : message;

        const savedUser = await apiRequest("/api/messages", {
            method: "POST",
            body: JSON.stringify({
                conversationId,
                role: "user",
                content: storedUserText
            })
        });

        if (isFirstMessage) {
            await updateConversationTitle(conversationId, visibleUserText);
            await loadConversations();
        }

        conversation.push({
            dbId: savedUser.data?.id,
            role: "user",
            parts: [{ text: storedUserText }]
        });

        if (!imageToSend) {
            const userBubbles = chat.querySelectorAll(".message.user");
            const lastUserBubble = userBubbles[userBubbles.length - 1];

            if (lastUserBubble && !lastUserBubble.querySelector(".message-actions")) {
                const actions = document.createElement("div");
                actions.className = "message-actions";

                const editButton = document.createElement("button");
                editButton.type = "button";
                editButton.textContent = "✎ Edit";
                editButton.addEventListener("click", () =>
                    editUserMessage(conversation.length - 1)
                );

                actions.appendChild(editButton);
                lastUserBubble.appendChild(actions);
            }
        }

        const requestBody = {
            message: visibleUserText,
            history: previousHistory,
            preferences,
            projectContext: getActiveWorkspaceContext(),
            model: selectedGeminiModel
        };

        if (imageToSend) {
            requestBody.image = {
                mimeType: imageToSend.mimeType,
                data: imageToSend.data
            };
        }

        const data = await apiRequest("/api/chat", {
            method: "POST",
            body: JSON.stringify(requestBody)
        });

        if (!data.reply) throw new Error("Jawaban AI kosong.");

        const savedAssistant = await apiRequest("/api/messages", {
            method: "POST",
            body: JSON.stringify({
                conversationId,
                role: "model",
                content: data.reply
            })
        });

        conversation.push({
            dbId: savedAssistant.data?.id,
            role: "model",
            parts: [{ text: data.reply }]
        });

        loading.remove();

        addMessage(
            "NEX AI",
            data.reply,
            "ai",
            null,
            savedAssistant.data?.id,
            conversation.length - 1
        );

        await loadConversations(historySearch?.value || "");

    } catch (error) {
        loadingText.textContent = error.message;
        loadingTitle.textContent = "NEX AI ERROR";
        console.error("Chat error:", error);

    } finally {
        isLoading = false;
        send.disabled = false;
        attachImageBtn.disabled = false;
        input.focus();
        chat.scrollTop = chat.scrollHeight;
    }
}

// ==========================
// MESSAGE FUNCTIONS
// ==========================

function addMessage(name, text, type, imageUrl = null, dbId = null, conversationIndex = null) {
    const message = document.createElement("div");
    message.className = `message ${type}`;

    const strong = document.createElement("strong");
    strong.textContent = name;
    message.appendChild(strong);

    if (imageUrl) {
        const image = document.createElement("img");
        image.className = "message-image";
        image.src = imageUrl;
        image.alt = "Foto yang dikirim";
        message.appendChild(image);
    }

    if (type === "ai") {
        const content = document.createElement("div");
        content.className = "markdown-body";
        content.innerHTML = renderMarkdown(text);
        message.appendChild(content);
        addCodeCopyButtons(content);

    } else {
        const paragraph = document.createElement("p");
        paragraph.className = "user-message-text";
        paragraph.textContent = text;
        message.appendChild(paragraph);
    }

    if (type === "ai" || type === "user") {
        const actions = document.createElement("div");
        actions.className = "message-actions";

        if (type === "ai" && Number.isInteger(conversationIndex)) {
            const speakButton = document.createElement("button");
            speakButton.type = "button";
            speakButton.textContent = "🔊 Dengarkan";
            speakButton.addEventListener("click", () => speakText(text));
            actions.appendChild(speakButton);

            const previousUserIndex = conversationIndex - 1;

            if (previousUserIndex >= 0 && conversation[previousUserIndex]?.role === "user") {
                const regenerateButton = document.createElement("button");
                regenerateButton.type = "button";
                regenerateButton.textContent = "↻ Ulangi";
                regenerateButton.addEventListener("click", () =>
                    regenerateFromUser(previousUserIndex)
                );
                actions.appendChild(regenerateButton);
            }
        }

        if (type === "user" && dbId && !String(text).includes("[Foto dilampirkan")) {
            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.textContent = "✎ Edit";
            editButton.addEventListener("click", () => editUserMessage(conversationIndex));
            actions.appendChild(editButton);
        }

        if (actions.childElementCount) message.appendChild(actions);
    }

    chat.appendChild(message);
    chat.scrollTop = chat.scrollHeight;
    return message;
}

function renderMarkdown(text) {
    const source = String(text ?? "");

    if (!window.marked || !window.DOMPurify) {
        return `<p>${escapeHTML(source).replace(/\n/g, "<br>")}</p>`;
    }

    marked.setOptions({
        gfm: true,
        breaks: true,
        highlight: undefined
    });

    const rawHTML = marked.parse(source);

    return DOMPurify.sanitize(rawHTML, {
        USE_PROFILES: { html: true }
    });
}

function addCodeCopyButtons(container) {
    container.querySelectorAll("pre").forEach(pre => {
        if (pre.parentElement.classList.contains("code-block")) return;

        const wrapper = document.createElement("div");
        wrapper.className = "code-block";

        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        const code = pre.querySelector("code");

        const languageClass = [...(code?.classList || [])]
            .find(className => className.startsWith("language-"));

        const language = languageClass
            ? languageClass.replace("language-", "")
            : "CODE";

        const toolbar = document.createElement("div");
        toolbar.className = "code-toolbar";

        const label = document.createElement("span");
        label.textContent = language.toUpperCase();

        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "copy-code-btn";
        copyButton.textContent = "Salin kode";

        copyButton.addEventListener("click", async () => {
            const codeText = code?.textContent || "";

            try {
                await navigator.clipboard.writeText(codeText);
                copyButton.textContent = "Tersalin ✓";

            } catch {
                const temp = document.createElement("textarea");
                temp.value = codeText;
                document.body.appendChild(temp);
                temp.select();
                document.execCommand("copy");
                temp.remove();
                copyButton.textContent = "Tersalin ✓";
            }

            setTimeout(() => {
                copyButton.textContent = "Salin kode";
            }, 1800);
        });

        toolbar.append(label, copyButton);
        wrapper.insertBefore(toolbar, pre);

        if (window.hljs && code) {
            try {
                window.hljs.highlightElement(code);
            } catch (error) {
                console.warn("Syntax highlight:", error);
            }
        }
    });
}

// ==========================
// CHAT MANAGEMENT: EDIT / REGENERATE / SEARCH / EXPORT
// ==========================

async function saveAssistantReply(message, history) {
    const result = await apiRequest("/api/chat", {
        method: "POST",
        body: JSON.stringify({
            message,
            history,
            preferences,
            projectContext: getActiveWorkspaceContext(),
            model: selectedGeminiModel
        })
    });

    if (!result.reply) throw new Error("Jawaban AI kosong.");

    const saved = await apiRequest("/api/messages", {
        method: "POST",
        body: JSON.stringify({
            conversationId,
            role: "model",
            content: result.reply
        })
    });

    conversation.push({
        dbId: saved.data?.id,
        role: "model",
        parts: [{ text: result.reply }]
    });

    renderConversation();
    await loadConversations(historySearch?.value || "");
}

async function editUserMessage(index) {
    const item = conversation[index];

    if (!item || item.role !== "user" || !item.dbId) return;

    const oldText = item.parts?.map(part => part.text || "").join("\n") || "";
    const edited = prompt("Edit pesan kamu:", oldText);

    if (edited === null || !edited.trim() || edited.trim() === oldText) return;

    if (!confirm("Simpan perubahan? Semua pesan setelah pesan ini akan dihapus, lalu NEX AI akan menjawab ulang.")) return;

    try {
        isLoading = true;
        send.disabled = true;

        await apiRequest("/api/messages", {
            method: "PATCH",
            body: JSON.stringify({
                action: "edit",
                id: item.dbId,
                content: edited.trim()
            })
        });

        const history = conversation.slice(0, index).map(entry => ({
            role: entry.role,
            parts: entry.parts
        }));

        conversation = conversation.slice(0, index);

        conversation.push({
            dbId: item.dbId,
            role: "user",
            parts: [{ text: edited.trim() }]
        });

        if (index === 0) {
            await updateConversationTitle(conversationId, edited.trim());
        }

        renderConversation();
        addTemporaryLoading("Membuat ulang jawaban...");
        await saveAssistantReply(edited.trim(), history);

    } catch (error) {
        alert("Gagal mengedit pesan: " + error.message);
        isLoading = false;
        await openConversation(conversationId);

    } finally {
        isLoading = false;
        send.disabled = false;
    }
}

async function regenerateFromUser(index) {
    const item = conversation[index];

    if (!item || item.role !== "user" || !item.dbId) return;

    const message = item.parts?.map(part => part.text || "").join("\n") || "";

    if (message.includes("[Foto dilampirkan")) {
        alert("Foto lama tidak tersimpan di Neon, jadi jawaban untuk foto tersebut tidak bisa dibuat ulang. Silakan unggah fotonya kembali.");
        return;
    }

    if (!confirm("Buat ulang jawaban AI? Semua pesan setelah pesan ini akan dihapus lalu jawaban dibuat ulang.")) return;

    try {
        isLoading = true;
        send.disabled = true;

        await apiRequest("/api/messages", {
            method: "PATCH",
            body: JSON.stringify({
                action: "truncateAfter",
                id: item.dbId
            })
        });

        const history = conversation.slice(0, index).map(entry => ({
            role: entry.role,
            parts: entry.parts
        }));

        conversation = conversation.slice(0, index + 1);
        renderConversation();
        addTemporaryLoading("Membuat ulang jawaban...");
        await saveAssistantReply(message, history);

    } catch (error) {
        alert("Gagal membuat ulang jawaban: " + error.message);
        isLoading = false;
        await openConversation(conversationId);

    } finally {
        isLoading = false;
        send.disabled = false;
    }
}

function addTemporaryLoading(label) {
    const loading = document.createElement("div");
    loading.className = "message ai temporary-loading";
    loading.textContent = label;
    chat.appendChild(loading);
}

let searchTimer = null;

historySearch?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        loadConversations(historySearch.value.trim());
    }, 250);
});

exportChatBtn?.addEventListener("click", () => {
    if (!conversation.length) {
        alert("Belum ada percakapan untuk diekspor.");
        return;
    }

    const lines = conversation.map(item => {
        const label = item.role === "user" ? "Kamu" : "NEX AI";
        const content = item.parts?.map(part => part.text || "").join("\n") || "";
        return `## ${label}\n\n${content}`;
    });

    const blob = new Blob(
        [`# Percakapan NEX AI\n\n${lines.join("\n\n---\n\n")}`],
        { type: "text/markdown;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `nex-chat-${new Date().toISOString().slice(0,10)}.md`;
    link.click();

    URL.revokeObjectURL(url);
});

// ==========================
// VOICE CHAT
// ==========================

function speakText(text) {
    if (!("speechSynthesis" in window)) {
        alert("Pembacaan suara belum didukung browser ini.");
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 12000));
    utterance.lang = preferences.language === "en" ? "en-US" : "id-ID";
    utterance.rate = 1;

    window.speechSynthesis.speak(utterance);
}

function setupVoiceInput() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
        voiceInputBtn.title = "Dikte suara tidak didukung browser ini";
        voiceInputBtn.addEventListener("click", () => {
            alert("Dikte suara belum didukung browser ini. Coba Chrome versi terbaru di Android.");
        });
        return;
    }

    speechRecognition = new Recognition();
    speechRecognition.lang = preferences.language === "en" ? "en-US" : "id-ID";
    speechRecognition.interimResults = true;
    speechRecognition.continuous = false;

    speechRecognition.onstart = () => {
        isListening = true;
        voiceInputBtn.classList.add("listening");
        voiceInputBtn.textContent = "■";
    };

    speechRecognition.onresult = event => {
        let transcript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }

        input.value = transcript;
        autoResizeInput();
    };

    speechRecognition.onerror = event => {
        console.warn("Voice input:", event.error);
    };

    speechRecognition.onend = () => {
        isListening = false;
        voiceInputBtn.classList.remove("listening");
        voiceInputBtn.textContent = "🎙";
    };

    voiceInputBtn.addEventListener("click", () => {
        if (isListening) {
            speechRecognition.stop();
        } else {
            speechRecognition.lang = preferences.language === "en" ? "en-US" : "id-ID";
            speechRecognition.start();
        }
    });
}

// ==========================
// WORKSPACE
// ==========================

function getActiveWorkspaceContext() {
    const selected = projects.find(project =>
        String(project.id) === String(activeWorkspaceId)
    );

    if (!selected) return "";

    return `Nama proyek: ${selected.name}\nDeskripsi proyek: ${selected.description || "Tidak ada deskripsi"}`;
}

function refreshWorkspaceSelect() {
    if (!workspaceSelect) return;

    workspaceSelect.innerHTML = '<option value="">Umum</option>';

    projects.forEach(project => {
        const option = document.createElement("option");
        option.value = String(project.id);
        option.textContent = project.name;
        workspaceSelect.appendChild(option);
    });

    if (!projects.some(project => String(project.id) === String(activeWorkspaceId))) {
        activeWorkspaceId = "";
    }

    workspaceSelect.value = activeWorkspaceId;
}

workspaceSelect?.addEventListener("change", () => {
    activeWorkspaceId = workspaceSelect.value;
    localStorage.setItem("nexActiveWorkspace", activeWorkspaceId);

    if (conversationId) {
        conversationWorkspaceMap[String(conversationId)] = String(activeWorkspaceId || "");
        localStorage.setItem("nexConversationWorkspaces", JSON.stringify(conversationWorkspaceMap));
    }

    renderConversationList();
});

// ==========================
// PERSONALIZATION
// ==========================

const prefName = document.getElementById("prefName");
const prefLanguage = document.getElementById("prefLanguage");
const prefStyle = document.getElementById("prefStyle");
const savePreferencesBtn = document.getElementById("savePreferencesBtn");

function renderPreferences() {
    if (prefName) prefName.value = preferences.name;
    if (prefLanguage) prefLanguage.value = preferences.language;
    if (prefStyle) prefStyle.value = preferences.style;
}

savePreferencesBtn?.addEventListener("click", () => {
    preferences = {
        name: prefName.value.trim().slice(0, 50),
        language: prefLanguage.value === "en" ? "en" : "id",
        style: ["concise", "detailed"].includes(prefStyle.value)
            ? prefStyle.value
            : "balanced"
    };

    localStorage.setItem("nexPreferences", JSON.stringify(preferences));
    alert("Preferensi NEX AI berhasil disimpan di perangkat ini.");
});

const geminiModelSelect = document.getElementById("geminiModelSelect");

geminiModelSelect?.addEventListener("change", () => {
    const nextModel = geminiModelSelect.value;

    if (!ALLOWED_GEMINI_MODELS.includes(nextModel)) {
        renderGeminiModel();
        return;
    }

    selectedGeminiModel = nextModel;
    localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, selectedGeminiModel);
    renderGeminiModel();
});

// ==========================
// QUICK MESSAGE & INPUT
// ==========================

function quickMessage(message) {
    input.value = message;
    sendMessage();
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
}

window.quickMessage = quickMessage;

send.addEventListener("click", sendMessage);

input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

function autoResizeInput() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
}

input.addEventListener("input", autoResizeInput);

// ==========================
// IMAGE UPLOAD
// ==========================

function clearPendingImage() {
    pendingImage = null;
    imageInput.value = "";
    imagePreview.hidden = true;
    imagePreviewImg.removeAttribute("src");
    imagePreviewName.textContent = "Foto terpilih";
}

attachImageBtn.addEventListener("click", () => {
    if (!isLoading) imageInput.click();
});

removeImageBtn.addEventListener("click", clearPendingImage);

imageInput.addEventListener("change", async () => {
    const file = imageInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Pilih file gambar yang valid.");
        clearPendingImage();
        return;
    }

    try {
        const processed = await compressImage(file);

        pendingImage = processed;
        imagePreviewImg.src = processed.preview;
        imagePreviewName.textContent = file.name;
        imagePreview.hidden = false;

    } catch (error) {
        alert("Foto tidak dapat dibaca: " + error.message);
        clearPendingImage();
    }
});

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = () => reject(new Error("Gagal membaca file."));

        reader.onload = () => {
            const image = new Image();

            image.onerror = () => reject(new Error("Format foto tidak didukung."));

            image.onload = () => {
                const maxSide = 1600;
                const scale = Math.min(1, maxSide / Math.max(image.width, image.height));

                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));

                const context = canvas.getContext("2d");

                if (!context) return reject(new Error("Tidak bisa memproses foto."));

                context.drawImage(image, 0, 0, canvas.width, canvas.height);

                const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";

                canvas.toBlob(blob => {
                    if (!blob) return reject(new Error("Gagal mengompres foto."));

                    if (blob.size > 2.8 * 1024 * 1024) {
                        return reject(new Error("Ukuran foto masih terlalu besar. Pilih foto lain."));
                    }

                    const dataReader = new FileReader();

                    dataReader.onerror = () => reject(new Error("Gagal menyiapkan foto."));

                    dataReader.onload = () => {
                        const dataUrl = String(dataReader.result);

                        resolve({
                            mimeType: blob.type,
                            data: dataUrl.split(",")[1],
                            preview: dataUrl
                        });
                    };

                    dataReader.readAsDataURL(blob);

                }, outputType, 0.84);
            };

            image.src = reader.result;
        };

        reader.readAsDataURL(file);
    });
}

// ==========================
// PROJECT MANAGER
// Sementara masih LocalStorage
// ==========================

let projects = [];

try {
    projects = JSON.parse(localStorage.getItem("nexProjects") || "[]");
    if (!Array.isArray(projects)) projects = [];
} catch {
    projects = [];
}

const projectName = document.getElementById("projectName");
const projectDescription = document.getElementById("projectDescription");
const addProjectBtn = document.getElementById("addProjectBtn");
const projectList = document.getElementById("projectList");

function saveProjects() {
    localStorage.setItem("nexProjects", JSON.stringify(projects));
    refreshWorkspaceSelect();
}

function renderProjects() {
    projectList.innerHTML = "";

    if (projects.length === 0) {
        projectList.innerHTML = `
            <div class="empty-state">
                <span>▣</span>
                <strong>No projects yet</strong>
                <p>Create your first project above.</p>
            </div>
        `;
        return;
    }

    projects.forEach((project, index) => {
        const card = document.createElement("div");
        card.className = "project-card";

        const title = document.createElement("strong");
        title.textContent = project.name;

        const description = document.createElement("p");
        description.textContent = project.description || "No description";

        const date = document.createElement("small");
        date.textContent = project.date;

        const remove = document.createElement("button");
        remove.className = "danger-button";
        remove.textContent = "Delete";

        remove.addEventListener("click", () => {
            if (!confirm(`Delete project "${project.name}"?`)) return;

            projects.splice(index, 1);
            saveProjects();
            renderProjects();
        });

        card.append(title, description, date, remove);
        projectList.appendChild(card);
    });
}

addProjectBtn.addEventListener("click", () => {
    const name = projectName.value.trim();
    const description = projectDescription.value.trim();

    if (!name) {
        alert("Masukkan nama project terlebih dahulu.");
        projectName.focus();
        return;
    }

    projects.push({
        id: Date.now(),
        name,
        description,
        date: new Date().toLocaleDateString("id-ID")
    });

    saveProjects();

    projectName.value = "";
    projectDescription.value = "";

    renderProjects();
});

// ==========================
// SETTINGS
// ==========================

document.getElementById("clearChatBtn").addEventListener("click", async () => {
    if (!conversationId) {
        alert("Belum ada percakapan yang dipilih.");
        return;
    }

    const confirmed = confirm(
        "Hapus percakapan yang sedang dipilih beserta seluruh pesannya?"
    );

    if (!confirmed) return;

    try {
        await apiRequest(
            `/api/conversations?id=${encodeURIComponent(conversationId)}`,
            { method: "DELETE" }
        );

        delete conversationWorkspaceMap[String(conversationId)];

        localStorage.setItem(
            "nexConversationWorkspaces",
            JSON.stringify(conversationWorkspaceMap)
        );

        conversationId = null;
        conversation = [];

        await loadConversations();
        renderConversation();

        alert("Percakapan berhasil dihapus.");

    } catch (error) {
        alert("Gagal menghapus chat: " + error.message);
    }
});

// ==========================
// INITIALIZATION
// ==========================

async function initialize() {
    renderConversation();
    renderProjects();
    refreshWorkspaceSelect();
    renderPreferences();
    renderGeminiModel();
    setupVoiceInput();

    navigateTo("home");

    await loadConversations();
}

initialize();


// ==========================
// STOCK MANAGEMENT - STAGE 2
// ==========================

const stockProductsList = document.getElementById("stockProductsList");
const stockProductForm = document.getElementById("stockProductForm");
const stockProductSearch = document.getElementById("stockProductSearch");
const stockProductFilter = document.getElementById("stockProductFilter");
const stockAliasPanel = document.getElementById("stockAliasPanel");
let stockProductsCache = [];
let stockSearchDebounce = null;

async function stockApi(url, options = {}) {
    return apiRequest(url, options);
}

function stockSetMessage(elementId, message, isError = false) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("error", isError);
}

function formatStockNumber(value) {
    const number = Number(value || 0);
    return Number.isInteger(number) ? String(number) : number.toLocaleString("id-ID");
}

async function loadStockProducts() {
    if (!stockProductsList) return;
    stockProductsList.innerHTML = '<div class="stock-empty">Memuat produk dari Neon...</div>';
    try {
        const query = stockProductSearch?.value.trim() || "";
        const data = await stockApi(`/api/stock/products${query ? `?q=${encodeURIComponent(query)}` : ""}`);
        stockProductsCache = data.products || [];
        renderStockProducts();
    } catch (error) {
        stockProductsList.innerHTML = `<div class="stock-empty stock-error">${escapeHTML(error.message)}</div>`;
        stockSetMessage("stockProductFormMessage", "Gagal mengambil data produk.", true);
    }
}

function renderStockProducts() {
    const filter = stockProductFilter?.value || "active";
    const products = stockProductsCache.filter(product => {
        if (filter === "active") return product.is_active;
        if (filter === "archived") return !product.is_active;
        return true;
    });

    const activeCount = stockProductsCache.filter(product => product.is_active).length;
    const aliasCount = stockProductsCache.reduce((total, product) => total + Number(product.alias_count || 0), 0);
    document.getElementById("stockProductTotal").textContent = stockProductsCache.length;
    document.getElementById("stockActiveTotal").textContent = activeCount;
    document.getElementById("stockAliasTotal").textContent = aliasCount;

    if (!products.length) {
        stockProductsList.innerHTML = '<div class="stock-empty">Tidak ada produk pada filter ini.</div>';
        return;
    }

    stockProductsList.innerHTML = products.map(product => `
        <article class="stock-product-card ${product.is_active ? "" : "is-archived"}">
            <div class="stock-product-topline"><span class="stock-product-code">${escapeHTML(product.code)}</span><span class="stock-status ${product.is_active ? "active" : "archived"}">${product.is_active ? "Aktif" : "Diarsipkan"}</span></div>
            <h4>${escapeHTML(product.name)}</h4>
            <div class="stock-product-meta"><span>Satuan: <b>${escapeHTML(product.unit)}</b></span><span>Min. stok: <b>${formatStockNumber(product.low_stock_threshold)}</b></span><span>Alias: <b>${Number(product.alias_count || 0)}</b></span></div>
            <div class="stock-product-actions">
                ${product.is_active ? `<button type="button" data-stock-action="edit" data-id="${product.id}">Edit</button><button type="button" data-stock-action="aliases" data-id="${product.id}">Kelola Alias</button><button type="button" class="danger" data-stock-action="archive" data-id="${product.id}">Arsipkan</button>` : `<button type="button" data-stock-action="restore" data-id="${product.id}">Pulihkan</button>`}
            </div>
        </article>
    `).join("");
}

stockProductForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const submitButton = stockProductForm.querySelector('button[type="submit"]');
    const payload = {
        name: document.getElementById("stockProductName").value.trim(),
        unit: document.getElementById("stockProductUnit").value.trim(),
        low_stock_threshold: Number(document.getElementById("stockProductThreshold").value)
    };
    submitButton.disabled = true;
    stockSetMessage("stockProductFormMessage", "Menyimpan produk...");
    try {
        const result = await stockApi("/api/stock/products", { method: "POST", body: JSON.stringify(payload) });
        stockProductForm.reset();
        document.getElementById("stockProductUnit").value = "portion";
        document.getElementById("stockProductThreshold").value = "0";
        stockSetMessage("stockProductFormMessage", result.message || "Produk berhasil ditambahkan.");
        await loadStockProducts();
    } catch (error) {
        stockSetMessage("stockProductFormMessage", error.message, true);
    } finally {
        submitButton.disabled = false;
    }
});

stockProductsList?.addEventListener("click", async event => {
    const button = event.target.closest("[data-stock-action]");
    if (!button) return;
    const product = stockProductsCache.find(item => String(item.id) === button.dataset.id);
    if (!product) return;
    const action = button.dataset.stockAction;

    if (action === "aliases") {
        openStockAliases(product);
        return;
    }
    if (action === "edit") {
        const name = prompt("Nama produk:", product.name);
        if (name === null) return;
        const unit = prompt("Satuan produk:", product.unit);
        if (unit === null) return;
        const threshold = prompt("Batas minimum stok:", product.low_stock_threshold);
        if (threshold === null) return;
        try {
            const result = await stockApi("/api/stock/products", {
                method: "PATCH",
                body: JSON.stringify({ id: product.id, name: name.trim(), unit: unit.trim(), low_stock_threshold: Number(threshold) })
            });
            stockSetMessage("stockProductFormMessage", result.message);
            await loadStockProducts();
        } catch (error) {
            stockSetMessage("stockProductFormMessage", error.message, true);
        }
        return;
    }
    if (action === "archive") {
        if (!confirm(`Arsipkan produk "${product.name}"? Produk tidak akan muncul sebagai produk aktif, tetapi riwayat transaksi tetap aman.`)) return;
        try {
            const result = await stockApi(`/api/stock/products?id=${product.id}`, { method: "DELETE" });
            stockSetMessage("stockProductFormMessage", result.message);
            await loadStockProducts();
        } catch (error) {
            stockSetMessage("stockProductFormMessage", error.message, true);
        }
        return;
    }
    if (action === "restore") {
        if (!confirm(`Pulihkan produk "${product.name}"?`)) return;
        try {
            const result = await stockApi("/api/stock/products", {
                method: "PATCH", body: JSON.stringify({ id: product.id, is_active: true })
            });
            stockSetMessage("stockProductFormMessage", result.message);
            await loadStockProducts();
        } catch (error) {
            stockSetMessage("stockProductFormMessage", error.message, true);
        }
    }
});

async function openStockAliases(product) {
    stockAliasPanel.hidden = false;
    document.getElementById("stockAliasProductId").value = product.id;
    document.getElementById("stockAliasTitle").textContent = `Alias: ${product.name}`;
    document.getElementById("stockAliasName").value = "";
    stockSetMessage("stockAliasMessage", "Memuat alias...");
    await loadStockAliases(product.id);
    stockAliasPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadStockAliases(productId) {
    const list = document.getElementById("stockAliasesList");
    list.innerHTML = '<p class="stock-empty">Memuat alias...</p>';
    try {
        const data = await stockApi(`/api/stock/aliases?product_id=${encodeURIComponent(productId)}`);
        if (!data.aliases?.length) {
            list.innerHTML = '<p class="stock-empty">Belum ada alias tambahan.</p>';
        } else {
            list.innerHTML = data.aliases.map(alias => `
                <div class="stock-alias-item"><span>${escapeHTML(alias.raw_alias)}</span><button type="button" data-alias-delete="${alias.id}" aria-label="Hapus alias ${escapeHTML(alias.raw_alias)}">Hapus</button></div>
            `).join("");
        }
        stockSetMessage("stockAliasMessage", `${data.total} alias terdaftar.`);
    } catch (error) {
        list.innerHTML = `<p class="stock-empty stock-error">${escapeHTML(error.message)}</p>`;
        stockSetMessage("stockAliasMessage", "Gagal memuat alias.", true);
    }
}

document.getElementById("stockAliasForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const productId = document.getElementById("stockAliasProductId").value;
    const rawAlias = document.getElementById("stockAliasName").value.trim();
    try {
        const result = await stockApi("/api/stock/aliases", {
            method: "POST", body: JSON.stringify({ product_id: productId, raw_alias: rawAlias })
        });
        document.getElementById("stockAliasName").value = "";
        stockSetMessage("stockAliasMessage", result.message);
        await loadStockAliases(productId);
        await loadStockProducts();
    } catch (error) {
        stockSetMessage("stockAliasMessage", error.message, true);
    }
});

document.getElementById("stockAliasesList")?.addEventListener("click", async event => {
    const button = event.target.closest("[data-alias-delete]");
    if (!button) return;
    if (!confirm("Hapus alias ini?")) return;
    const productId = document.getElementById("stockAliasProductId").value;
    try {
        const result = await stockApi(`/api/stock/aliases?id=${button.dataset.aliasDelete}`, { method: "DELETE" });
        stockSetMessage("stockAliasMessage", result.message);
        await loadStockAliases(productId);
        await loadStockProducts();
    } catch (error) {
        stockSetMessage("stockAliasMessage", error.message, true);
    }
});

document.getElementById("stockAliasCloseBtn")?.addEventListener("click", () => {
    stockAliasPanel.hidden = true;
});

document.getElementById("stockRefreshBtn")?.addEventListener("click", loadStockProducts);
stockProductFilter?.addEventListener("change", renderStockProducts);
stockProductSearch?.addEventListener("input", () => {
    clearTimeout(stockSearchDebounce);
    stockSearchDebounce = setTimeout(loadStockProducts, 250);
});
