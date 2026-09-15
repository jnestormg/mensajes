const ALL = "ALL";

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const nameInput = document.getElementById("name-input");
const loginError = document.getElementById("login-error");
const connectBtn = document.getElementById("connect-btn");
const currentUserEl = document.getElementById("current-user");
const clientsList = document.getElementById("clients-list");
const chatHeader = document.getElementById("chat-header");
const messagesContainer = document.getElementById("messages-container");
const messageInput = document.getElementById("message-input");
const targetInput = document.getElementById("target-input");
const sendBtn = document.getElementById("send-btn");
const connectionStatus = document.getElementById("connection-status");
const statusText = document.getElementById("status-text");

let socket = null;
let myId = null;
let myName = null;
let clients = [];
let selectedTargetId = ALL;
let conversationHistory = [];

function init() {
    connectBtn.addEventListener("click", connect);
    nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") connect();
    });

    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    sendBtn.addEventListener("click", sendMessage);
}

function connect() {
    const name = nameInput.value.trim();

    if (!name) {
        showLoginError("El nombre no puede estar vacío.");
        return;
    }

    connectBtn.disabled = true;
    loginError.classList.add("hidden");

    socket = io();

    socket.on("connect", () => {
        socket.emit("register-client", { name });
    });

    socket.on("registered", (data) => {
        myId = data.id;
        myName = data.name;
        enterApp();
    });

    socket.on("register-error", (data) => {
        showLoginError(data.error);
        connectBtn.disabled = false;
        socket.disconnect();
        socket = null;
    });

    socket.on("clients-updated", (list) => {
        clients = list;

        const targetStillExists = clients.some((c) => c.id === selectedTargetId);
        if (selectedTargetId !== ALL && !targetStillExists) {
            selectedTargetId = ALL;
            targetInput.value = ALL;
        }
        renderClients();
    });

    socket.on("client-connected", (client) => {
        addToConversation("system", `${client.name} se ha conectado.`);
    });

    socket.on("client-disconnected", (client) => {
        if (selectedTargetId === client.id) {
            selectedTargetId = ALL;
            targetInput.value = ALL;
            updateChatHeader();
        }
        addToConversation("system", `${client.name} se ha desconectado.`);
    });

    socket.on("receive-message", (message) => {
        addToConversation("received", message);
    });

    socket.on("broadcast-message", (message) => {
        if (message.senderId === myId) return;
        addToConversation("received", message);
    });

    socket.on("message-sent", (message) => {
        addToConversation("sent", message);
    });

    socket.on("send-error", (data) => {
        showLoginError("");
        addToConversation("system", `Error: ${data.error}`);
    });

    socket.on("connect_error", () => {
        showConnectionLost();
    });

    socket.on("disconnect", () => {
        showConnectionLost();
    });
}

function enterApp() {
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    currentUserEl.textContent = `Conectado como ${myName}`;
    renderClients();
}

function showLoginError(message) {
    loginError.textContent = message;
    loginError.classList.remove("hidden");
}

function showConnectionLost() {
    statusText.textContent = "Sin conexión";
    connectionStatus.classList.remove("connected");
    connectionStatus.classList.add("disconnected");
}

function renderClients() {
    clientsList.innerHTML = "";

    const allItem = createClientItem({ id: ALL, name: "Todos" }, selectedTargetId === ALL);
    const selfItem = createClientItem({ id: myId, name: myName }, false);
    clientsList.appendChild(allItem);
    clientsList.appendChild(selfItem);

    clients.forEach((client) => {
        if (client.id === myId) return;

        const item = createClientItem(client, selectedTargetId === client.id);
        item.addEventListener("click", () => selectTarget(client.id));
        clientsList.appendChild(item);
    });

    updateChatHeader();
}

function createClientItem(client, isSelected) {
    const li = document.createElement("li");
    li.className = "client-item";
    if (isSelected) li.classList.add("selected");
    li.dataset.id = client.id;

    const status = document.createElement("span");
    status.className = "client-status";

    const name = document.createElement("span");
    name.className = "client-name";
    name.textContent = client.name === ALL ? "Todos" : client.name;

    const youTag = client.id === myId ? document.createElement("span") : null;
    if (youTag) {
        youTag.textContent = "(Tú)";
        youTag.style.color = "var(--color-success)";
    }

    li.appendChild(status);
    li.appendChild(name);
    if (youTag) li.appendChild(youTag);

    return li;
}

function selectTarget(targetId) {
    selectedTargetId = targetId;
    targetInput.value = targetId;
    renderClients();
}

function updateChatHeader() {
    if (selectedTargetId === ALL) {
        chatHeader.textContent = "Mensaje para todos";
    } else {
        const target = clients.find((c) => c.id === selectedTargetId);
        chatHeader.textContent = target ? `Conversación con ${target.name}` : "Selecciona un destino";
    }
}

function sendMessage() {
    const text = messageInput.value.trim();

    if (!text) return;
    if (!socket || !socket.connected) return;

    socket.emit("send-message", {
        targetId: selectedTargetId,
        message: text
    });

    messageInput.value = "";
}

function addToConversation(kind, data) {
    if (kind === "system") {
        const div = document.createElement("div");
        div.className = "system-message";
        div.textContent = data;
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return;
    }

    const isMyMessage = kind === "sent";

    const wrapper = document.createElement("div");
    wrapper.className = `message ${isMyMessage ? "sent" : "received"}`;

    const meta = document.createElement("div");
    meta.className = "message-meta";

    const senderLabel = document.createElement("span");
    if (isMyMessage) {
        senderLabel.textContent = "Yo";
    } else {
        senderLabel.textContent = data.senderName;
    }

    const targetLabel = document.createElement("span");
    if (data.targetId === ALL) {
        targetLabel.textContent = " → Todos";
    } else {
        targetLabel.textContent = "";
    }

    const time = document.createElement("span");
    time.textContent = ` ${formatTime(data.timestamp)}`;

    meta.appendChild(senderLabel);
    meta.appendChild(targetLabel);
    meta.appendChild(time);

    const text = document.createElement("div");
    text.className = "message-text";
    text.textContent = data.message;

    wrapper.appendChild(meta);
    wrapper.appendChild(text);

    messagesContainer.appendChild(wrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

init();