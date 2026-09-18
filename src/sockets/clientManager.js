const NAME_MAX_LENGTH = 30;
const MAX_PENDING_PER_CLIENT = 100;

const clients = [];
const knownClients = new Map();
const pendingMessages = new Map();

function addClient(socketId, name) {
    clients.push({ id: socketId, name });
    knownClients.set(name, { name, lastSeen: new Date().toISOString() });
}

function removeClient(socketId) {
    const index = clients.findIndex((client) => client.id === socketId);
    if (index !== -1) {
        const removed = clients.splice(index, 1)[0];
        const known = knownClients.get(removed.name);
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
        const onlineClient = clients.find((client) => client.name === known.name);
        return {
            id: onlineClient ? onlineClient.id : null,
            name: known.name,
            online: !!onlineClient && onlineIds.has(onlineClient.id)
        };
    });
}

function isKnownName(name) {
    return knownClients.has(name);
}

function isNameInUse(name) {
    return clients.some((client) => client.name.toLowerCase() === name.toLowerCase());
}

function isValidName(name) {
    return typeof name === "string" && name.trim().length > 0 && name.trim().length <= NAME_MAX_LENGTH;
}

function addPendingMessage(targetName, message) {
    if (!knownClients.has(targetName)) return false;

    const list = pendingMessages.get(targetName) || [];
    list.push(message);

    if (list.length > MAX_PENDING_PER_CLIENT) {
        list.shift();
    }

    pendingMessages.set(targetName, list);
    return true;
}

function getPendingMessages(targetName) {
    return pendingMessages.get(targetName) || [];
}

function clearPendingMessages(targetName) {
    pendingMessages.delete(targetName);
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
    clearPendingMessages
};