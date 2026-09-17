const ALL = "ALL";
const BASE_TITLE = "Mensajería LAN";
const STORAGE_KEY = "lan-history-v1";
const MAX_MESSAGES_PER_CONVERSATION = 300;
const MAX_STORED_CONVERSATIONS = 30;

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
const muteBtn = document.getElementById("mute-btn");
const installBtn = document.getElementById("install-btn");
const toastContainer = document.getElementById("toast-container");
const alertOverlay = document.getElementById("alert-overlay");
const alertTitle = document.getElementById("alert-title");
const alertSender = document.getElementById("alert-sender");
const alertBody = document.getElementById("alert-body");
const alertCloseBtn = document.getElementById("alert-close-btn");

let socket = null;
let myId = null;
let myName = null;
let clients = [];
let selectedTargetKey = ALL;
let selectedTargetId = ALL;
let conversationHistory = new Map();
let unreadCounts = new Map();
let seenMessageIds = new Set();
let saveTimer = null;
let isMuted = localStorage.getItem("lan-mute") === "1";
let audioCtx = null;
let flashInterval = null;
let overlayTimer = null;
let pendingOverlayKey = null;
let deferredPrompt = null;

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
    alertCloseBtn.addEventListener("click", () => {
        if (pendingOverlayKey) selectConversation(pendingOverlayKey);
        hideOverlay();
    });
    alertOverlay.addEventListener("click", () => hideOverlay());
    muteBtn.addEventListener("click", toggleMute);
    installBtn.addEventListener("click", installApp);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            startTitleFlash();
        } else {
            stopTitleFlash();
            updateWindowTitle();
        }
    });

    window.addEventListener("pointerdown", resumeAudio, { once: true });
    window.addEventListener("keydown", resumeAudio, { once: true });
    window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY) mergeHistoryFromStorage();
    });
    window.addEventListener("pagehide", () => {
        clearTimeout(saveTimer);
        saveHistoryToStorage();
    });
    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.classList.remove("hidden");
    });
    window.addEventListener("appinstalled", () => {
        deferredPrompt = null;
        installBtn.classList.add("hidden");
    });

    loadHistoryFromStorage();
    registerServiceWorker();
    updateMuteButton();

    const savedName = localStorage.getItem("lan-name");
    const changeNameLink = document.getElementById("change-name-link");

    if (savedName) {
        nameInput.value = savedName;
        changeNameLink.classList.remove("hidden");
        setTimeout(() => {
            if (!myId && nameInput.value.trim()) connect();
        }, 50);
    }

    changeNameLink.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("lan-name");
        location.reload();
    });
}

function registerServiceWorker() {
    if (!window.isSecureContext || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
}

async function installApp() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
        await deferredPrompt.userChoice;
    } catch (e) {}
    deferredPrompt = null;
    installBtn.classList.add("hidden");
}

function connect() {
    const name = nameInput.value.trim();

    if (!name) {
        showLoginError("El nombre no puede estar vacío.");
        return;
    }

    connectBtn.disabled = true;
    loginError.classList.add("hidden");
    unlockAudio();

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
    }

    socket = io();

    socket.on("connect", () => {
        socket.emit("register-client", { name });
    });

    socket.on("registered", (data) => {
        myId = data.id;
        myName = data.name;
        localStorage.setItem("lan-name", myName);
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

        if (selectedTargetKey !== ALL && !clients.some((c) => c.name === selectedTargetKey)) {
            selectConversation(ALL);
        }
        renderClients();
    });

    socket.on("client-connected", (client) => {
        addSystemMessage(`${client.name} se ha conectado.`);
        renderClients();
    });

    socket.on("client-disconnected", (client) => {
        if (selectedTargetKey === client.name) updateChatHeader();
        addSystemMessage(`${client.name} se ha desconectado.`);
        renderClients();
    });

    socket.on("receive-message", (message) => {
        handleIncomingMessage(message);
    });

    socket.on("broadcast-message", (message) => {
        if (message.senderId === myId) return;
        handleIncomingMessage({ ...message, isBroadcast: true });
    });

    socket.on("message-sent", (message) => {
        const key = message.targetId === ALL ? ALL : message.targetName;

        addMessageToHistory(key, message);
        if (message.queued) {
            addSystemMessage(`El mensaje se entregará cuando ${message.targetName} se conecte.`);
        }
        if (selectedTargetKey === key) renderConversation();
    });

    socket.on("send-error", (data) => {
        addSystemMessage(`Error: ${data.error}`);
    });

    socket.on("connect_error", () => {
        if (!myId) connectBtn.disabled = false;
        showConnectionLost();
    });

    socket.on("disconnect", () => {
        showConnectionLost();
    });
}

function handleIncomingMessage(message) {
    const key = message.isBroadcast ? ALL : message.senderName;
    const isOpen = selectedTargetKey === key;

    addMessageToHistory(key, message);
    if (!isOpen) {
        incrementUnread(key);
    }
    renderClients();

    if (isOpen) renderConversation();
    notifyMessage(key, message);
}

function enterApp() {
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    currentUserEl.textContent = `Conectado como ${myName}`;
    renderClients();
    selectConversation(ALL);
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

    const allItem = createClientItem({ id: ALL, name: "Todos", online: true }, ALL);
    allItem.addEventListener("click", () => selectConversation(ALL));
    clientsList.appendChild(allItem);

    const selfItem = createClientItem({ id: myId, name: myName, online: true, self: true }, null);
    clientsList.appendChild(selfItem);

    clients.forEach((client) => {
        if (client.name === myName) return;
        const item = createClientItem(client, client.name);
        item.addEventListener("click", () => selectConversation(client.name));
        clientsList.appendChild(item);
    });

    updateChatHeader();
}

function createClientItem(client, key) {
    const li = document.createElement("li");
    li.className = "client-item";
    if (key !== null && selectedTargetKey === key) li.classList.add("selected");
    if (client.self) li.classList.add("self-item");

    const status = document.createElement("span");
    status.className = "client-status";
    if (!client.online) status.classList.add("offline");

    const name = document.createElement("span");
    name.className = "client-name";
    name.textContent = client.name === ALL ? "Todos" : client.name;

    const youTag = client.self ? document.createElement("span") : null;
    if (youTag) {
        youTag.textContent = "(Tú)";
        youTag.style.color = "var(--color-success)";
    }

    const stateLabel = client.online ? null : document.createElement("span");
    if (stateLabel) {
        stateLabel.textContent = "desconectado";
        stateLabel.className = "offline-label";
    }

    const badge = (key !== null && unreadCounts.get(key) > 0)
        ? createUnreadBadge(unreadCounts.get(key))
        : null;

    li.appendChild(status);
    li.appendChild(name);
    if (stateLabel) li.appendChild(stateLabel);
    if (youTag) li.appendChild(youTag);
    if (badge) li.appendChild(badge);

    return li;
}

function createUnreadBadge(count) {
    const badge = document.createElement("span");
    badge.className = "unread-badge";
    badge.textContent = count > 99 ? "99+" : count;
    return badge;
}

function selectConversation(key) {
    selectedTargetKey = key;
    selectedTargetId = key === ALL ? ALL : null;

    const client = clients.find((c) => c.name === key);
    if (client && client.id) selectedTargetId = client.id;

    targetInput.value = selectedTargetId;

    unreadCounts.delete(key);

    updateChatHeader();
    renderClients();
    renderConversation();
    stopTitleFlash();
    updateWindowTitle();
}

function updateChatHeader() {
    if (selectedTargetKey === ALL) {
        chatHeader.textContent = "Mensaje para todos";
        return;
    }

    const client = clients.find((c) => c.name === selectedTargetKey);
    if (!client) {
        chatHeader.textContent = "Selecciona un destino";
        return;
    }
    chatHeader.textContent = `${selectedTargetKey}${client.online ? "" : " (desconectado)"}`;
}

function sendMessage() {
    const text = messageInput.value.trim();

    if (!text) return;
    if (!socket || !socket.connected) return;

    const isAll = selectedTargetKey === ALL;
    socket.emit("send-message", {
        targetId: isAll ? ALL : selectedTargetId,
        targetName: isAll ? "Todos" : selectedTargetKey,
        message: text
    });

    messageInput.value = "";
}

function getConversation(key) {
    if (!conversationHistory.has(key)) {
        conversationHistory.set(key, []);
    }
    return conversationHistory.get(key);
}

function addMessageToHistory(key, message) {
    if (!message || !message.id) return;
    if (seenMessageIds.has(message.id)) return;

    seenMessageIds.add(message.id);
    getConversation(key).push({ ...message });
    scheduleHistorySave();
}

function addSystemMessage(text) {
    getConversation(ALL).push({ type: "system", text });
    if (selectedTargetKey === ALL) renderConversation();
}

function incrementUnread(key) {
    unreadCounts.set(key, (unreadCounts.get(key) || 0) + 1);
    updateWindowTitle();
    if (document.hidden) startTitleFlash();
}

function renderConversation() {
    messagesContainer.innerHTML = "";
    const history = conversationHistory.get(selectedTargetKey) || [];

    history.forEach((entry) => {
        if (entry.type === "system") {
            appendSystemMessage(entry.text);
            return;
        }
        appendMessage(entry);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function appendSystemMessage(text) {
    const div = document.createElement("div");
    div.className = "system-message";
    div.textContent = text;
    messagesContainer.appendChild(div);
}

function appendMessage(message) {
    const isMyMessage = message.senderName === myName;
    const isGlobal = message.isBroadcast || message.targetId === ALL;

    const wrapper = document.createElement("div");
    wrapper.className = `message ${isMyMessage ? "sent" : "received"}`;

    const meta = document.createElement("div");
    meta.className = "message-meta";

    const senderLabel = document.createElement("span");
    if (isMyMessage) {
        senderLabel.textContent = "Yo";
    } else {
        senderLabel.textContent = message.senderName || "Desconocido";
    }

    const targetLabel = document.createElement("span");
    if (isGlobal) {
        targetLabel.textContent = " → Todos";
    } else {
        targetLabel.textContent = "";
    }

    const time = document.createElement("span");
    time.textContent = ` ${formatTime(message.timestamp)}`;

    meta.appendChild(senderLabel);
    meta.appendChild(targetLabel);
    meta.appendChild(time);

    if (message.queued) {
        const queuedTag = document.createElement("span");
        queuedTag.className = "queued-tag";
        queuedTag.textContent = " pendiente";
        meta.appendChild(queuedTag);
    }

    const text = document.createElement("div");
    text.className = "message-text";
    text.textContent = message.message;

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

/* ------------------- Historial persistente (localStorage) ------------------- */

function scheduleHistorySave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveHistoryToStorage, 400);
}

function serializeHistory() {
    const data = {};
    conversationHistory.forEach((entries, key) => {
        const real = entries.filter((e) => e.type !== "system");
        if (real.length > 0) {
            data[key] = real.map(stripInternalFields).slice(-MAX_MESSAGES_PER_CONVERSATION);
        }
    });
    return data;
}

function saveHistoryToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeHistory()));
    } catch (e) {
        if (e && e.name === "QuotaExceededError") {
            shrinkHistory();
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeHistory()));
            } catch (e2) {}
        }
    }
}

function stripInternalFields(message) {
    return {
        id: message.id,
        senderId: message.senderId,
        senderName: message.senderName,
        targetId: message.targetId,
        targetName: message.targetName,
        message: message.message,
        timestamp: message.timestamp,
        queued: message.queued || false
    };
}

function loadHistoryFromStorage() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        if (!data || typeof data !== "object") return;

        Object.keys(data).forEach((key) => {
            const list = Array.isArray(data[key]) ? data[key] : [];
            const entries = list
                .filter((m) => m && m.id && typeof m.message === "string")
                .slice(-MAX_MESSAGES_PER_CONVERSATION);

            if (entries.length === 0) return;
            conversationHistory.set(key, entries);
            entries.forEach((m) => seenMessageIds.add(m.id));
            sortConversation(key);
        });
    } catch (e) {}
}

function mergeHistoryFromStorage() {
    let changed = false;
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        if (!data || typeof data !== "object") return;

        Object.keys(data).forEach((key) => {
            const list = Array.isArray(data[key]) ? data[key] : [];
            let added = false;
            list.forEach((m) => {
                if (m && m.id && typeof m.message === "string" && !seenMessageIds.has(m.id)) {
                    seenMessageIds.add(m.id);
                    getConversation(key).push(m);
                    added = true;
                    changed = true;
                }
            });
            if (added) sortConversation(key);
        });
    } catch (e) {}

    if (changed) {
        renderClients();
        renderConversation();
    }
}

function sortConversation(key) {
    const conv = conversationHistory.get(key);
    if (!conv) return;
    conv.sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));
}

function shrinkHistory() {
    const currentKeys = Array.from(conversationHistory.keys());

    conversationHistory.forEach((entries, key) => {
        const real = entries.filter((e) => e.type !== "system");
        conversationHistory.set(key, real.slice(-Math.floor(MAX_MESSAGES_PER_CONVERSATION / 2)));
    });

    if (currentKeys.length > MAX_STORED_CONVERSATIONS) {
        const byLastTs = currentKeys.sort((a, b) => {
            const la = lastTimestamp(a);
            const lb = lastTimestamp(b);
            return String(la).localeCompare(String(lb));
        });
        byLastTs.slice(0, byLastTs.length - MAX_STORED_CONVERSATIONS).forEach((key) => {
            conversationHistory.delete(key);
        });
    }
}

function lastTimestamp(key) {
    const conv = conversationHistory.get(key) || [];
    const last = conv[conv.length - 1];
    return last ? (last.timestamp || "") : "";
}

/* ----------------------- Notificaciones ----------------------- */

function notifyMessage(key, message) {
    const title = key === ALL ? "Mensaje para todos" : message.senderName || key;
    const body = message.message;

    showToast(title, body);
    playAlertSound();

    if ("Notification" in window && Notification.permission === "granted") {
        try {
            new Notification(title, {
                body,
                tag: message.id || key,
                requireInteraction: true
            });
        } catch (e) {}
    }

    const needsOverlay = document.hidden || (key !== null && key !== selectedTargetKey);
    if (needsOverlay) showOverlay(title, body, key);
}

function showToast(title, body) {
    const toast = document.createElement("div");
    toast.className = "toast";

    const t = document.createElement("div");
    t.className = "toast-title";
    t.textContent = title;

    const b = document.createElement("div");
    b.className = "toast-body";
    b.textContent = body;

    toast.appendChild(t);
    toast.appendChild(b);
    toast.addEventListener("click", () => {
        toast.remove();
        if (pendingOverlayKey) selectConversation(pendingOverlayKey);
        window.focus();
    });

    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 6500);
}

function showOverlay(title, body, key) {
    pendingOverlayKey = key;
    alertTitle.textContent = "Nuevo mensaje";
    alertSender.textContent = title;
    alertBody.textContent = body;
    alertOverlay.classList.remove("hidden");
    alertOverlay.classList.add("active");

    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(hideOverlay, 8000);
}

function hideOverlay() {
    clearTimeout(overlayTimer);
    alertOverlay.classList.add("hidden");
    alertOverlay.classList.remove("active");
    pendingOverlayKey = null;
}

function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem("lan-mute", isMuted ? "1" : "0");
    updateMuteButton();
}

function updateMuteButton() {
    muteBtn.textContent = isMuted ? "🔇" : "🔔";
}

function unlockAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    resumeAudio();
}

function resumeAudio() {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

function playAlertSound() {
    if (isMuted || !audioCtx || audioCtx.state !== "running") return;

    const now = audioCtx.currentTime;
    for (let repeat = 0; repeat < 3; repeat++) {
        [[880, 0.12, 0], [1174, 0.16, 0.15]].forEach(([freq, dur, delay]) => {
            const t0 = now + repeat * 0.45 + delay;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = "square";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.22, t0);
            gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(t0);
            osc.stop(t0 + dur + 0.05);
        });
    }
}

function updateWindowTitle() {
    const total = getUnreadTotal();
    document.title = total > 0 ? `(${total}) ${BASE_TITLE}` : BASE_TITLE;
}

function getUnreadTotal() {
    let total = 0;
    unreadCounts.forEach((count) => { total += count; });
    return total;
}

function startTitleFlash() {
    if (flashInterval) return;
    flashInterval = setInterval(() => {
        document.title = document.title === BASE_TITLE
            ? `🔴 NUEVO MENSAJE (${getUnreadTotal()})`
            : BASE_TITLE;
    }, 800);
}

function stopTitleFlash() {
    if (!flashInterval) return;
    clearInterval(flashInterval);
    flashInterval = null;
}

init();