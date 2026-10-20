const clientManager = require("./clientManager");
const pushManager = require("./pushManager");
const { normalizeUsername, isValidUsername } = require("../config/usernames");

const MESSAGE_MAX_LENGTH = 1000;
const ALL = "ALL";

function sendEvent(io, event, payload) {
    io.emit(event, payload);
}

function registerSocketHandlers(io) {
    io.on("connection", (socket) => {
        socket.on("register-client", (data) => {
            const name = normalizeUsername(data && typeof data.name === "string" ? data.name : "");

            if (!isValidUsername(name) || !clientManager.isValidName(name)) {
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
            sendEvent(io, "clients-updated", clientManager.getKnownClients());
            socket.broadcast.emit("client-connected", { id: socket.id, name });

            const pending = clientManager.getPendingMessages(name);
            if (pending.length > 0) {
                socket.emit("pending-messages", { messages: pending });
                console.log(`[Mensajes] ${name} reconectado. Enviados ${pending.length} mensajes pendientes.`);
            }

            const deliveryReceipts = clientManager.getPendingDeliveryReceipts(name);
            if (deliveryReceipts.length > 0) {
                socket.emit("delivery-receipt", { messageIds: deliveryReceipts });
                clientManager.removePendingDeliveryReceipts(name, deliveryReceipts);
                console.log(`[Mensajes] ${name} reconectado. Enviados ${deliveryReceipts.length} delivery receipts pendientes.`);
            }
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
                socket.emit("message-sent", globalMessage);

                pushManager.broadcastNotification({
                    title: "Mensaje para todos",
                    body: `${sender.name}: ${message}`,
                    conv: ALL,
                    tag: globalMessage.id
                }, sender.name).catch(() => {});

                return;
            }

            const target = clientManager.getClient(targetId);
            const targetName = target ? target.name : (typeof data.targetName === "string" ? data.targetName : "");

            if (!targetName) {
                socket.emit("send-error", { error: "El cliente destino ya no está disponible." });
                return;
            }

            const individualMessage = {
                id: generateId(),
                senderId: sender.id,
                senderName: sender.name,
                targetId: target ? target.id : null,
                targetName,
                message,
                timestamp: new Date().toISOString()
            };

            if (!clientManager.addPendingMessage(targetName, individualMessage)) {
                socket.emit("send-error", { error: "El cliente destino ya no está disponible." });
                return;
            }

            console.log(`[Mensajes] Mensaje ${individualMessage.id} de ${sender.name} para ${targetName} encolado.`);

            const targetIsOnline = target && io.sockets.sockets.get(target.id);
            if (targetIsOnline) {
                io.to(target.id).emit("receive-message", individualMessage);
                console.log(`[Mensajes] Mensaje ${individualMessage.id} enviado en tiempo real a ${targetName} (${target.id}).`);
            } else {
                console.log(`[Mensajes] Destinatario ${targetName} offline. Mensaje ${individualMessage.id} esperando reconexión.`);
            }

            pushManager.sendNotification(targetName, {
                title: sender.name,
                body: message,
                conv: sender.name,
                tag: individualMessage.id
            }, sender.name).catch(() => {});

            socket.emit("message-sent", individualMessage);
        });

        socket.on("typing", (data) => {
            const sender = clientManager.getClient(socket.id);
            if (!sender) return;

            if (!data || typeof data.isTyping !== "boolean") return;

            if (data.targetId === ALL) {
                socket.broadcast.emit("typing", {
                    conversation: ALL,
                    fromName: sender.name,
                    isTyping: data.isTyping
                });
                return;
            }

            const targetName = typeof data.targetName === "string" ? data.targetName : "";
            const target = clientManager.getClientByName(targetName) || clientManager.getClient(data.targetId);
            if (target && io.sockets.sockets.get(target.id)) {
                io.to(target.id).emit("typing", {
                    conversation: target.name,
                    fromName: sender.name,
                    isTyping: data.isTyping
                });
            }
        });

        socket.on("message-read", (data) => {
            const reader = clientManager.getClient(socket.id);
            if (!reader) return;
            if (!data || !Array.isArray(data.messageIds) || data.messageIds.length === 0) return;

            const targetName = typeof data.targetName === "string" ? data.targetName : "";
            const target = clientManager.getClientByName(targetName);
            if (!target || !io.sockets.sockets.get(target.id)) return;

            io.to(target.id).emit("read-receipt", {
                fromName: reader.name,
                messageIds: data.messageIds
            });
        });

        socket.on("message-delivered", (data) => {
            const client = clientManager.getClient(socket.id);
            if (!client) return;
            if (!data || !Array.isArray(data.messageIds) || data.messageIds.length === 0) return;

            const senderName = typeof data.senderName === "string" ? data.senderName : "";
            if (!senderName) return;

            clientManager.removePendingMessages(client.name, data.messageIds);
            console.log(`[Mensajes] ${client.name} confirmó entrega de mensajes ${data.messageIds.join(", ")} de ${senderName}.`);

            const sender = clientManager.getClientByName(senderName);
            if (sender && io.sockets.sockets.get(sender.id)) {
                io.to(sender.id).emit("delivery-receipt", {
                    fromName: client.name,
                    messageIds: data.messageIds
                });
                console.log(`[Mensajes] Delivery receipt enviado a ${senderName}.`);
            } else {
                clientManager.addPendingDeliveryReceipt(senderName, data.messageIds);
                console.log(`[Mensajes] Remitente ${senderName} offline. Delivery receipt guardado.`);
            }
        });

        socket.on("pending-messages-acked", (data) => {
            const client = clientManager.getClient(socket.id);
            if (!client) return;
            if (!data || !Array.isArray(data.messageIds) || data.messageIds.length === 0) return;

            clientManager.removePendingMessages(client.name, data.messageIds);
            console.log(`[Mensajes] ${client.name} confirmó lote pendiente: ${data.messageIds.join(", ")}.`);
        });

        socket.on("disconnect", () => {
            const removed = clientManager.removeClient(socket.id);

            if (removed) {
                sendEvent(io, "clients-updated", clientManager.getKnownClients());
                socket.broadcast.emit("client-disconnected", { id: removed.id, name: removed.name });
            }
        });
    });
}

function generateId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = { registerSocketHandlers, ALL, MESSAGE_MAX_LENGTH };