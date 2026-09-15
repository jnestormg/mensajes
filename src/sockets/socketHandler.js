const clientManager = require("./clientManager");

const MESSAGE_MAX_LENGTH = 1000;
const ALL = "ALL";

function sendEvent(io, event, payload) {
    io.emit(event, payload);
}

function registerSocketHandlers(io) {
    io.on("connection", (socket) => {
        socket.on("register-client", (data) => {
            const name = (data && typeof data.name === "string" ? data.name : "").trim();

            if (!clientManager.isValidName(name)) {
                socket.emit("register-error", {
                    error: `El nombre debe tener entre 1 y ${clientManager.NAME_MAX_LENGTH} caracteres.`
                });
                return;
            }

            if (clientManager.isNameInUse(name)) {
                socket.emit("register-error", {
                    error: "Ese nombre ya está en uso. Elige otro."
                });
                return;
            }

            clientManager.addClient(socket.id, name);

            socket.emit("registered", { name, id: socket.id });
            sendEvent(io, "clients-updated", clientManager.getClients());
            socket.broadcast.emit("client-connected", { id: socket.id, name });
        });

        socket.on("send-message", (data) => {
            const sender = clientManager.getClient(socket.id);

            if (!sender) {
                socket.emit("send-error", { error: "No estás registrado." });
                return;
            }

            if (!data || typeof data.message !== "string" || data.message.trim().length === 0) {
                socket.emit("send-error", { error: "El mensaje no puede estar vacío." });
                return;
            }

            if (data.message.length > MESSAGE_MAX_LENGTH) {
                socket.emit("send-error", { error: `El mensaje no puede superar ${MESSAGE_MAX_LENGTH} caracteres.` });
                return;
            }

            const message = data.message.trim();
            const targetId = data.targetId;

            if (targetId === ALL) {
                const globalMessage = {
                    id: generateId(),
                    senderId: sender.id,
                    senderName: sender.name,
                    targetId: ALL,
                    targetName: "Todos",
                    message,
                    timestamp: new Date().toISOString()
                };
                sendEvent(io, "broadcast-message", globalMessage);
                return;
            }

            const target = clientManager.getClient(targetId);

            if (!target) {
                socket.emit("send-error", { error: "El cliente destino ya no está conectado." });
                return;
            }

            const individualMessage = {
                id: generateId(),
                senderId: sender.id,
                senderName: sender.name,
                targetId: target.id,
                targetName: target.name,
                message,
                timestamp: new Date().toISOString()
            };

            io.to(target.id).emit("receive-message", individualMessage);
            socket.emit("message-sent", individualMessage);
        });

        socket.on("disconnect", () => {
            const removed = clientManager.removeClient(socket.id);

            if (removed) {
                sendEvent(io, "clients-updated", clientManager.getClients());
                socket.broadcast.emit("client-disconnected", { id: removed.id, name: removed.name });
            }
        });
    });
}

function generateId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = { registerSocketHandlers, ALL, MESSAGE_MAX_LENGTH };