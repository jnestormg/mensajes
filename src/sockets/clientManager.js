const NAME_MAX_LENGTH = 30;

const clients = [];

function addClient(socketId, name) {
    clients.push({ id: socketId, name });
}

function removeClient(socketId) {
    const index = clients.findIndex((client) => client.id === socketId);
    if (index !== -1) {
        return clients.splice(index, 1)[0];
    }
    return null;
}

function getClient(socketId) {
    return clients.find((client) => client.id === socketId) || null;
}

function getClients() {
    return clients.map((client) => ({ ...client }));
}

function isNameInUse(name) {
    return clients.some((client) => client.name.toLowerCase() === name.toLowerCase());
}

function isValidName(name) {
    return typeof name === "string" && name.trim().length > 0 && name.trim().length <= NAME_MAX_LENGTH;
}

module.exports = {
    NAME_MAX_LENGTH,
    addClient,
    removeClient,
    getClient,
    getClients,
    isNameInUse,
    isValidName
};