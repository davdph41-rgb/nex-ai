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
        throw new Error(
            data.message ||
            data.error ||
            "Permintaan gagal"
        );
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
        button.classList.toggle(
            "active",
            button.dataset.page === pageName
        );
    });

    document.getElementById("pageTitle").innerHTML =
        pageTitles[pageName] || "NEX AI";

    if (pageName === "projects") {
        renderProjects();
    }

    if (pageName === "chat") {
        input.focus();
        chat.scrollTop = chat.scrollHeight;
    }
}

navButtons.forEach(button => {
    button.addEventListener("click", () => {
        navigateTo(button.dataset.page);
    });
});

document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
        navigateTo(button.dataset.go);
    });
});

// ==========================
// CONVERSATION HISTORY
// ==========================

async function loadConversations() {
    conversationList.innerHTML = `
        <p class="history-loading">Loading chats...</p>
    `;

    try {
        const data = await apiRequest("/api/conversations");

        conversations = data.conversations || [];

        renderConversationList();

    } catch (error) {
        conversationList.innerHTML = `
            <p class="history-empty">
                ${escapeHTML(error.message)}
            </p>
        `;
    }
}

function renderConversationList() {
    conversationList.innerHTML = "";

    if (conversations.length === 0) {
        conversationList.innerHTML = `
            <p class="history-empty">No chats yet.</p>
        `;
        return;
    }

    conversations.forEach(item => {
        const button = document.createElement("button");

        button.className = "history-item";

        if (String(item.id) === String(conversationId)) {
            button.classList.add("active");
        }

        button.textContent = item.title || "Chat Baru";
        button.title = item.title || "Chat Baru";

        button.addEventListener("click", () => {
            openConversation(item.id);
        });

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

    await loadConversations();

    return conversationId;
}

// ==========================
// AUTOMATIC CHAT TITLE
// ==========================

function makeConversationTitle(message) {
    const cleanMessage = message
        .replace(/\s+/g, " ")
        .trim();

    if (cleanMessage.length > 45) {
        return cleanMessage.slice(0, 44) + "…";
    }

    return cleanMessage;
}

async function updateConversationTitle(id, message) {
    const title = makeConversationTitle(message);

    await apiRequest("/api/conversations", {
        method: "PATCH",
        body: JSON.stringify({
            id,
            title
        })
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

        conversation = (data.messages || []).map(item => ({
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

    conversation.forEach(item => {
        const text = item.parts?.map(part => part.text || "").join("\n");
        if (!text) return;
        addMessage(
            item.role === "user" ? "YOU" : "NEX AI",
            text,
            item.role === "user" ? "user" : "ai"
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
        const previousHistory = [...conversation];
        const storedUserText = imageToSend
            ? `${visibleUserText}\n[Foto dilampirkan — file foto tidak disimpan di riwayat]`
            : message;

        await apiRequest("/api/messages", {
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
            role: "user",
            parts: [{ text: storedUserText }]
        });

        const requestBody = {
            message: visibleUserText,
            history: previousHistory
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

        await apiRequest("/api/messages", {
            method: "POST",
            body: JSON.stringify({
                conversationId,
                role: "model",
                content: data.reply
            })
        });

        conversation.push({
            role: "model",
            parts: [{ text: data.reply }]
        });

        loading.remove();
        addMessage("NEX AI", data.reply, "ai");
        await loadConversations();

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

function addMessage(name, text, type, imageUrl = null) {
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
            setTimeout(() => { copyButton.textContent = "Salin kode"; }, 1800);
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
    projects = JSON.parse(
        localStorage.getItem("nexProjects") || "[]"
    );

    if (!Array.isArray(projects)) projects = [];

} catch {
    projects = [];
}

const projectName = document.getElementById("projectName");
const projectDescription = document.getElementById("projectDescription");
const addProjectBtn = document.getElementById("addProjectBtn");
const projectList = document.getElementById("projectList");

function saveProjects() {
    localStorage.setItem(
        "nexProjects",
        JSON.stringify(projects)
    );
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
        description.textContent =
            project.description || "No description";

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

    navigateTo("home");

    await loadConversations();
}

initialize();
