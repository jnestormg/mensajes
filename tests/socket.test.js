const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("http");
const { Server } = require("socket.io");
const io = require("socket.io-client");
const socketHandler = require("../src/sockets/socketHandler");

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextEvent(socket, event) {
    return new Promise((resolve) => {
        socket.once(event, (data) => resolve(data));
    });
}

test("mensaje privado se entrega después de desconexión del destinatario", async (t) => {
    const httpServer = createServer();
    const ioServer = new Server(httpServer, {
        transports: ["websocket"],
        pingTimeout: 100,
        pingInterval: 50
    });
    socketHandler.registerSocketHandlers(ioServer);

    await new Promise((resolve) => httpServer.listen(0, resolve));
    const port = httpServer.address().port;
    const url = `http://localhost:${port}`;

    const sender = io(url, { transports: ["websocket"], reconnection: false });
    const target = io(url, { transports: ["websocket"], reconnection: false });

    t.after(() => {
        sender.disconnect();
        target.disconnect();
        ioServer.close();
        httpServer.close();
    });

    // Registro de ambos clientes
    sender.emit("register-client", { name: "Remitente" });
    target.emit("register-client", { name: "Destinatario" });

    const senderReg = await nextEvent(sender, "registered");
    const targetReg = await nextEvent(target, "registered");

    assert.equal(senderReg.name, "Remitente");
    assert.equal(targetReg.name, "Destinatario");

    // Esperar a que la lista de clientes se actualice en ambos
    await wait(100);

    // Forzar desconexión del destinatario en el servidor
    const targetServerSocket = ioServer.sockets.sockets.get(target.id);
    assert.ok(targetServerSocket, "El socket del destinatario debería existir en el servidor");
    targetServerSocket.disconnect(true);

    await wait(200);

    // El remitente envía un mensaje mientras el destinatario está offline
    sender.emit("send-message", {
        targetId: targetReg.id,
        targetName: "Destinatario",
        message: "hola"
    });

    const sentConfirmation = await nextEvent(sender, "message-sent");
    assert.equal(sentConfirmation.message, "hola");

    // Reconectar un nuevo cliente con el mismo nombre
    const target2 = io(url, { transports: ["websocket"], reconnection: false });

    const pendingPromise = nextEvent(target2, "pending-messages");
    target2.emit("register-client", { name: "Destinatario" });

    const pendingData = await pendingPromise;
    assert.ok(pendingData, "El destinatario debería recibir pending-messages");
    assert.equal(pendingData.messages.length, 1);
    assert.equal(pendingData.messages[0].message, "hola");
    assert.equal(pendingData.messages[0].senderName, "Remitente");

    target2.disconnect();
});

test("delivery receipt se guarda cuando el remitente está offline", async (t) => {
    const httpServer = createServer();
    const ioServer = new Server(httpServer, {
        transports: ["websocket"],
        pingTimeout: 100,
        pingInterval: 50
    });
    socketHandler.registerSocketHandlers(ioServer);

    await new Promise((resolve) => httpServer.listen(0, resolve));
    const port = httpServer.address().port;
    const url = `http://localhost:${port}`;

    const sender = io(url, { transports: ["websocket"], reconnection: false });
    const target = io(url, { transports: ["websocket"], reconnection: false });

    t.after(() => {
        sender.disconnect();
        target.disconnect();
        ioServer.close();
        httpServer.close();
    });

    sender.emit("register-client", { name: "Remitente" });
    target.emit("register-client", { name: "Destinatario" });

    await nextEvent(sender, "registered");
    await nextEvent(target, "registered");
    await wait(100);

    // Desconectar al remitente
    const senderServerSocket = ioServer.sockets.sockets.get(sender.id);
    senderServerSocket.disconnect(true);
    await wait(200);

    // El destinatario envía delivery receipt (simulando que recibió un mensaje previo)
    target.emit("message-delivered", { senderName: "Remitente", messageIds: ["m1"] });

    await wait(100);

    // Reconectar un nuevo cliente con el mismo nombre de remitente
    const sender2 = io(url, { transports: ["websocket"], reconnection: false });
    const deliveryPromise = nextEvent(sender2, "delivery-receipt");
    sender2.emit("register-client", { name: "Remitente" });

    const deliveryData = await deliveryPromise;
    assert.ok(deliveryData);
    assert.deepEqual(deliveryData.messageIds, ["m1"]);

    sender2.disconnect();
});
