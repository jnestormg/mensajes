const NAME_MAX_LENGTH = 30;
const MAX_PENDING_PER_CLIENT = 100;

const clients = [];
const knownClients = new Map();
const pendingMessages = new Map();
const pendingDeliveryReceipts = new Map();

function nameKey(name) {
    return String(name || "").toLowerCase();
}

function addClient(socketId, name) {
    clients.push({ id: socketId, name });
    knownClients.set(nameKey(name), { name, lastSeen: new Date().toISOString() });
}

function removeClient(socketId) {
    const index = clients.findIndex((client) => client.id === socketId);
    if (index !== -1) {
        const removed = clients.splice(index, 1)[0];
        const known = knownClients.get(nameKey(removed.name));
        if (known) known.lastSeen = new Date().toISOString();
        return removed;
    }
    return null;
}

function getClient(socketId) {
    return clients.find((client) => client.id === socketId) || null;
}

function getClientByName(name) {
    return clients.find((client) => client.name.toLowerCase() === name.toLowerCase()) || null;
}

function getClients() {
    return clients.map((client) => ({ ...client }));
}

function getKnownClients() {
    const onlineIds = new Set(clients.map((client) => client.id));
    return Array.from(knownClients.values()).map((known) => {
        const onlineClient = clients.find((client) => nameKey(client.name) === nameKey(known.name));
        return {
            id: onlineClient ? onlineClient.id : null,
            name: known.name,
            online: !!onlineClient && onlineIds.has(onlineClient.id)
        };
    });
}

function isKnownName(name) {
    return knownClients.has(nameKey(name));
}

function isNameInUse(name) {
    return clients.some((client) => client.name.toLowerCase() === name.toLowerCase());
}

function isValidName(name) {
    return typeof name === "string" && name.trim().length > 0 && name.trim().length <= NAME_MAX_LENGTH;
}

function addPendingMessage(targetName, message) {
    const key = nameKey(targetName);
    if (!knownClients.has(key)) return false;

    const list = pendingMessages.get(key) || [];
    list.push(message);

    if (list.length > MAX_PENDING_PER_CLIENT) {
        list.shift();
    }

    pendingMessages.set(key, list);
    return true;
}

function getPendingMessages(targetName) {
    return pendingMessages.get(nameKey(targetName)) || [];
}

function removePendingMessages(targetName, messageIds) {
    const key = nameKey(targetName);
    const list = pendingMessages.get(key);
    if (!list || !Array.isArray(messageIds) || messageIds.length === 0) return;

    const idSet = new Set(messageIds);
    const filtered = list.filter((message) => !idSet.has(message.id));

    if (filtered.length === 0) {
        pendingMessages.delete(key);
    } else {
        pendingMessages.set(key, filtered);
    }
}

function clearPendingMessages(targetName) {
    pendingMessages.delete(nameKey(targetName));
}

function addPendingDeliveryReceipt(senderName, messageIds) {
    const key = nameKey(senderName);
    if (!knownClients.has(key)) return;

    const list = pendingDeliveryReceipts.get(key) || [];
    const existingIds = new Set(list);
    messageIds.forEach((id) => {
        if (!existingIds.has(id)) {
            list.push(id);
            existingIds.add(id);
        }
    });

    if (list.length > MAX_PENDING_PER_CLIENT) {
        list.splice(0, list.length - MAX_PENDING_PER_CLIENT);
    }

    pendingDeliveryReceipts.set(key, list);
}

function getPendingDeliveryReceipts(senderName) {
    return pendingDeliveryReceipts.get(nameKey(senderName)) || [];
}

function removePendingDeliveryReceipts(senderName, messageIds) {
    const key = nameKey(senderName);
    const list = pendingDeliveryReceipts.get(key);
    if (!list || !Array.isArray(messageIds) || messageIds.length === 0) return;

    const idSet = new Set(messageIds);
    const filtered = list.filter((id) => !idSet.has(id));

    if (filtered.length === 0) {
        pendingDeliveryReceipts.delete(key);
    } else {
        pendingDeliveryReceipts.set(key, filtered);
    }
}

module.exports = {
    NAME_MAX_LENGTH,
    MAX_PENDING_PER_CLIENT,
    addClient,
    removeClient,
    getClient,
    getClientByName,
    getClients,
    getKnownClients,
    isKnownName,
    isNameInUse,
    isValidName,
    addPendingMessage,
    getPendingMessages,
    removePendingMessages,
    clearPendingMessages,
    addPendingDeliveryReceipt,
    getPendingDeliveryReceipts,
    removePendingDeliveryReceipts
};