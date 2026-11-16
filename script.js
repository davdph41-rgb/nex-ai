
const input = document.getElementById("messageInput");
const send = document.getElementById("sendBtn");
const chat = document.getElementById("chatMessages");

let conversation = [];

try {
    conversation = JSON.parse(
        localStorage.getItem("nexConversation") || "[]"
    );

    if (!Array.isArray(conversation)) conversation = [];
} catch {
    conversation = [];
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

// Dashboard shortcuts and page buttons
document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
        navigateTo(button.dataset.go);
    });
});

// ==========================
// CHAT
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

        suggestions.innerHTML = `
            <button onclick="quickMessage('Ceritakan tentang dirimu')">
                ✦ About NEX AI
            </button>

            <button onclick="quickMessage('Apa yang bisa kamu lakukan?')">
                ⌘ What can you do?
            </button>

            <button onclick="quickMessage('Bantu saya membuat ide project')">
                ✦ Project ideas
            </button>
        `;

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
}

async function sendMessage() {
    const message = input.value.trim();

    if (!message || send.disabled) return;

    document.querySelector(".suggestions")?.remove();

    addMessage("YOU", message, "user");

    input.value = "";
    send.disabled = true;

    const loading = document.createElement("div");
    loading.className = "message ai";

    loading.innerHTML = `
        <strong>NEX AI</strong>
        <p>Thinking...</p>
    `;

    chat.appendChild(loading);
    chat.scrollTop = chat.scrollHeight;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message,
                history: conversation
            })
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
                data?.details?.error?.message ||
                data?.message ||
                data?.error ||
                "Request gagal"
            );
        }

        if (!data.reply) {
            throw new Error("Jawaban AI kosong.");
        }

        loading.innerHTML = `
            <strong>NEX AI</strong>
            <p>${escapeHTML(data.reply)}</p>
        `;

        conversation.push({
            role: "user",
            parts: [{ text: message }]
        });

        conversation.push({
            role: "model",
            parts: [{ text: data.reply }]
        });

        localStorage.setItem(
            "nexConversation",
            JSON.stringify(conversation)
        );

    } catch (error) {
        loading.innerHTML = `
            <strong>NEX AI ERROR</strong>
            <p>${escapeHTML(error.message)}</p>
        `;
    }

    send.disabled = false;
    input.focus();
    chat.scrollTop = chat.scrollHeight;
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

send.addEventListener("click", sendMessage);

input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        sendMessage();
    }
});

// ==========================
// PROJECT MANAGER
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

document.getElementById("clearChatBtn").addEventListener("click", () => {
    const confirmed = confirm(
        "Apakah kamu yakin ingin menghapus seluruh percakapan NEX AI?"
    );

    if (!confirmed) return;

    conversation = [];

    localStorage.removeItem("nexConversation");

    renderConversation();

    alert("Percakapan berhasil dihapus.");
});

// ==========================
// INITIALIZATION
// ==========================

renderConversation();
renderProjects();
navigateTo("home");
