const ALL = "ALL";
const BASE_TITLE = "Mensajería LAN";
const STORAGE_KEY = "lan-history-v1";
const MAX_MESSAGES_PER_CONVERSATION = 300;
const MAX_STORED_CONVERSATIONS = 30;
const CLIENT_COLORS = ["#0d9488", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#4f46e5"];

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const nameInput = document.getElementById("name-input");
const loginError = document.getElementById("login-error");
const connectBtn = document.getElementById("connect-btn");
const currentUserEl = document.getElementById("current-user");
const clientsList = document.getElementById("clients-list");
const chatHeader = document.getElementById("chat-header");
const chatHeaderText = document.getElementById("chat-header-text");
const typingIndicator = document.getElementById("typing-indicator");
const changeNameLink = document.getElementById("change-name-link");
const messagesContainer = document.getElementById("messages-container");
const messageInput = document.getElementById("message-input");
const targetInput = document.getElementById("target-input");
const sendBtn = document.getElementById("send-btn");
const connectionStatus = document.getElementById("connection-status");
const statusText = document.getElementById("status-text");
const muteBtn = document.getElementById("mute-btn");
const themeBtn = document.getElementById("theme-btn");
const installBtn = document.getElementById("install-btn");
const toastContainer = document.getElementById("toast-container");

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
let deferredPrompt = null;
let typingSent = false;
let typingStopTimer = null;
let typingHideTimer = null;
let pendingOpenConv = null;
let notifHintShown = false;

function init() {
    const openParam = new URLSearchParams(window.location.search).get("open");
    if (openParam) {
        pendingOpenConv = openParam;
        history.replaceState(null, "", "/");
    }

    connectBtn.addEventListener("click", connect);
    nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") connect();
    });

    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
            return;
        }
        handleTypingActivity();
    });
    messageInput.addEventListener("blur", stopTyping);
    sendBtn.addEventListener("click", sendMessage);
    muteBtn.addEventListener("click", toggleMute);
    installBtn.addEventListener("click", installApp);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            if (getUnreadTotal() > 0) startTitleFlash();
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
    initTheme();
    themeBtn.addEventListener("click", toggleTheme);
    window.visualViewport
        ? window.visualViewport.addEventListener("resize", keepInputVisible)
        : window.addEventListener("resize", keepInputVisible);
    restoreSavedName();

    changeNameLink.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("lan-name");
        location.reload();
    });
}

function keepInputVisible() {
    const el = document.activeElement;
    if (!el || !el.matches("input")) return;
    el.scrollIntoView({ block: "nearest" });
}

function restoreSavedName() {
    const savedName = localStorage.getItem("lan-name");
    if (!savedName) return;

    const cleaned = String(savedName).trim();
    if (!cleaned) {
        localStorage.removeItem("lan-name");
        return;
    }

    nameInput.value = cleaned;
    changeNameLink.classList.remove("hidden");
    setTimeout(() => {
        if (!myId && nameInput.value) connect();
    }, 50);
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp("(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : "";
}

function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days || 365) * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/`;
}

/* ------------------- Tema claro / oscuro ------------------- */

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
    if (themeBtn) themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
}

function initTheme() {
    const saved = getCookie("theme");
    const theme = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    applyTheme(theme);

    if (!saved && window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
            if (!getCookie("theme")) initTheme();
        });
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    setCookie("theme", next, 365);
}

/* ------------------- Notificaciones nativas ------------------- */

function registerServiceWorker() {
    if (!window.isSecureContext || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
}

function canUseNativeNotifications() {
    return Boolean(window.isSecureContext && "Notification" in window);
}

function showNativeNotification(title, body, conv, tag) {
    if (!canUseNativeNotifications()) return false;
    if (Notification.permission !== "granted") return false;

    try {
        const notification = new Notification(title, {
            body,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            tag,
            renotify: true,
            requireInteraction: true,
            data: { conv }
        });
        notification.onclick = () => {
            if (conv) selectConversation(conv);
            stopTitleFlash();
            try { window.focus(); } catch (e) {}
        };
        return true;
    } catch (e) {
        return false;
    }
}

function requestNotificationPermission() {
    if (!canUseNativeNotifications()) return;
    if (Notification.permission !== "default") return;
    Notification.requestPermission().catch(() => {});
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
    const name = String(nameInput.value || "").trim().replace(/\s+/g, " ");

    if (!name) {
        showLoginError("Escribe tu nombre para conectarte.");
        return;
    }

    if (name.length > 30) {
        showLoginError("El nombre no puede superar 30 caracteres.");
        return;
    }

    nameInput.value = name;
    connectBtn.disabled = true;
    loginError.classList.add("hidden");
    unlockAudio();
    requestNotificationPermission();

    socket = io({ transports: ["websocket"] });

    socket.on("connect", () => {
        socket.emit("register-client", { name });
    });

    socket.on("registered", (data) => {
        myId = data.id;
        myName = data.name;
        localStorage.setItem("lan-name", myName);
        enterApp();
        if (pendingOpenConv) {
            selectConversation(pendingOpenConv);
            pendingOpenConv = null;
        }
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

    socket.on("typing", (data) => {
        if (!data || data.fromName === myName) return;
        if (data.conversation !== selectedTargetKey) return;
        if (data.isTyping) {
            showTypingIndicator(data.fromName);
        } else {
            hideTypingIndicator();
        }
    });

    socket.on("read-receipt", (data) => {
        if (!data || !Array.isArray(data.messageIds)) return;
        const conv = conversationHistory.get(data.fromName);
        if (!conv) return;

        const idSet = new Set(data.messageIds);
        let changed = false;
        conv.forEach((m) => {
            if (m.type !== "system" && m.senderName === myName && idSet.has(m.id) && !m.read) {
                m.read = true;
                changed = true;
            }
        });

        if (changed) {
            scheduleHistorySave();
            if (selectedTargetKey === data.fromName) renderConversation();
        }
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
    const wasOpen = selectedTargetKey === key;

    addMessageToHistory(key, message);

    if (message.isBroadcast) {
        if (!wasOpen) incrementUnread(key);
        renderClients();
        if (wasOpen) renderConversation();
        notifyMessage(key, message);
        return;
    }

    if (!wasOpen) {
        selectConversation(key);
    } else {
        renderClients();
        renderConversation();
        sendReadReceipts(key);
    }
    notifyMessage(key, message);
}

function sendReadReceipts(conversationKey) {
    if (!socket || !socket.connected) return;
    if (!conversationKey || conversationKey === ALL) return;

    const history = conversationHistory.get(conversationKey) || [];
    const ids = history
        .filter((m) => m.type !== "system" && m.senderName && m.senderName !== myName && !m.read && m.id)
        .map((m) => m.id);

    if (ids.length === 0) return;
    socket.emit("message-read", { targetName: conversationKey, messageIds: ids });
}

/* ------------------- Color por cliente ------------------- */

function colorFor(name) {
    const s = String(name || "").toLowerCase();
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    }
    return CLIENT_COLORS[hash % CLIENT_COLORS.length];
}

/* ------------------- Indicador escribiendo… ------------------- */

function sendTyping(isTyping) {
    if (!socket || !socket.connected) return;
    if (selectedTargetKey === ALL) {
        socket.emit("typing", { targetId: ALL, isTyping });
        return;
    }
    const client = clients.find((c) => c.name === selectedTargetKey);
    if (client) {
        socket.emit("typing", { targetId: client.id, targetName: client.name, isTyping });
    }
}

function handleTypingActivity() {
    if (!typingSent) {
        typingSent = true;
        sendTyping(true);
    }
    clearTimeout(typingStopTimer);
    typingStopTimer = setTimeout(() => {
        typingSent = false;
        sendTyping(false);
    }, 2500);
}

function stopTyping() {
    if (typingSent) {
        typingSent = false;
        clearTimeout(typingStopTimer);
        sendTyping(false);
    }
}

function showTypingIndicator(name) {
    typingIndicator.textContent = `${name} está escribiendo…`;
    typingIndicator.classList.remove("hidden");
    clearTimeout(typingHideTimer);
    typingHideTimer = setTimeout(hideTypingIndicator, 2500);
}

function hideTypingIndicator() {
    clearTimeout(typingHideTimer);
    typingIndicator.classList.add("hidden");
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
    stopTyping();
    hideTypingIndicator();

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
    sendReadReceipts(key);
}

function updateChatHeader() {
    if (selectedTargetKey === ALL) {
        chatHeaderText.textContent = "Mensaje para todos";
        return;
    }

    const client = clients.find((c) => c.name === selectedTargetKey);
    if (!client) {
        chatHeaderText.textContent = "Selecciona un destino";
        return;
    }
    chatHeaderText.textContent = `${selectedTargetKey}${client.online ? "" : " (desconectado)"}`;
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

    stopTyping();
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

    const displayName = isMyMessage ? "Yo" : (message.senderName || "Desconocido");
    const displayColor = isMyMessage ? colorFor(myName) : colorFor(message.senderName);

    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.style.backgroundColor = displayColor;
    avatar.textContent = (isMyMessage ? (myName || "Yo") : (message.senderName || "?")).charAt(0).toUpperCase();

    const senderLabel = document.createElement("span");
    senderLabel.textContent = displayName;
    if (!isMyMessage) senderLabel.style.color = displayColor;

    const targetLabel = document.createElement("span");
    if (isGlobal) {
        targetLabel.textContent = " → Todos";
    } else {
        targetLabel.textContent = "";
    }

    const time = document.createElement("span");
    time.textContent = ` ${formatTime(message.timestamp)}`;

    meta.appendChild(avatar);
    meta.appendChild(senderLabel);
    meta.appendChild(targetLabel);
    meta.appendChild(time);

    if (isMyMessage && !isGlobal) {
        if (message.queued) {
            const queuedTag = document.createElement("span");
            queuedTag.className = "queued-tag";
            queuedTag.textContent = " pendiente";
            meta.appendChild(queuedTag);
        } else if (message.read) {
            const readTag = document.createElement("span");
            readTag.className = "read-tag";
            readTag.textContent = " ✓✓ Visto";
            meta.appendChild(readTag);
        } else {
            const sentTag = document.createElement("span");
            sentTag.className = "sent-tag";
            sentTag.textContent = " ✓ Enviado";
            meta.appendChild(sentTag);
        }
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
        queued: message.queued || false,
        read: message.read || false
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

    showToast(title, body, key);
    playAlertSound();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);

    if (!notifHintShown && !(canUseNativeNotifications() && Notification.permission === "granted")) {
        notifHintShown = true;
        nativeNotificationHint();
    }

    showNativeNotification(title, body, key, String(message.id || key));
}

function nativeNotificationHint() {
    if (!canUseNativeNotifications()) {
        showToast("Notificaciones nativas desactivadas", "Corre 'npm run trust' en este equipo (una vez) para ver popups nativos.");
        return;
    }
    if (Notification.permission === "denied") {
        showToast("Permiso denegado", "Actívalo en Chrome (Configuración del sitio > Notificaciones) y en Configuración de Windows.");
    }
}

function showToast(title, body, key) {
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
        if (key) {
            selectConversation(key);
            try { window.focus(); } catch (e) {}
        }
    });

    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 6500);
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
    if (getUnreadTotal() === 0) return;
    flashInterval = setInterval(() => {
        if (getUnreadTotal() === 0) {
            stopTitleFlash();
            updateWindowTitle();
            return;
        }
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