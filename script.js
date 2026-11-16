
const input = document.getElementById("messageInput");
const send = document.getElementById("sendBtn");
const chat = document.getElementById("chatMessages");

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

    renderConversation();

    return conversationId;
}

async function startNewChat() {
    if (isLoading) return;

    try {
        await createConversation("Chat Baru");

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

            button.addEventListener("click", () => {
                quickMessage(message);
            });

            suggestions.appendChild(button);
        });

        chat.appendChild(suggestions);
        return;
    }

    conversation.forEach(item => {
        const text = item.parts
            ?.map(part => part.text || "")
            .join("\n");

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

    if (!message || isLoading) return;

    isLoading = true;
    send.disabled = true;

    document.querySelector(".suggestions")?.remove();

    addMessage("YOU", message, "user");

    input.value = "";

    const loading = document.createElement("div");
    loading.className = "message ai";

    const loadingTitle = document.createElement("strong");
    loadingTitle.textContent = "NEX AI";

    const loadingText = document.createElement("p");
    loadingText.textContent = "Thinking...";

    loading.append(loadingTitle, loadingText);
    chat.appendChild(loading);

    chat.scrollTop = chat.scrollHeight;

    try {
        // Buat chat otomatis jika belum ada
        if (!conversationId) {
            await createConversation(message.slice(0, 45));
        }

        // Simpan riwayat lama untuk dikirim ke Gemini
        const previousHistory = [...conversation];

        // Simpan pesan pengguna ke Neon
        await apiRequest("/api/messages", {
            method: "POST",
            body: JSON.stringify({
                conversationId,
                role: "user",
                content: message
            })
        });

        // Masukkan pesan pengguna ke riwayat lokal sementara
        conversation.push({
            role: "user",
            parts: [{ text: message }]
        });

        // Kirim ke Gemini melalui API lama
        const data = await apiRequest("/api/chat", {
            method: "POST",
            body: JSON.stringify({
                message,
                history: previousHistory
            })
        });

        if (!data.reply) {
            throw new Error("Jawaban AI kosong.");
        }

        // Simpan jawaban Gemini ke Neon
        await apiRequest("/api/messages", {
            method: "POST",
            body: JSON.stringify({
                conversationId,
                role: "model",
                content: data.reply
            })
        });

        // Simpan jawaban ke riwayat aktif
        conversation.push({
            role: "model",
            parts: [{ text: data.reply }]
        });

        loadingText.textContent = data.reply;

        await loadConversations();

    } catch (error) {
        loadingText.textContent = error.message;
        loadingTitle.textContent = "NEX AI ERROR";

        console.error("Chat error:", error);

    } finally {
        isLoading = false;
        send.disabled = false;

        input.focus();
        chat.scrollTop = chat.scrollHeight;
    }
}

function addMessage(name, text, type) {
    const message = document.createElement("div");

    message.className = `message ${type}`;

    const strong = document.createElement("strong");
    strong.textContent = name;

    const paragraph = document.createElement("p");
    paragraph.textContent = text;

    message.append(strong, paragraph);
    chat.appendChild(message);
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
    if (event.key === "Enter") {
        sendMessage();
    }
});

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
