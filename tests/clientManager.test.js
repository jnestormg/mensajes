const test = require("node:test");
const assert = require("node:assert/strict");

// Cada test usa un módulo fresco para no compartir estado en memoria.
function freshManager() {
    delete require.cache[require.resolve("../src/sockets/clientManager")];
    return require("../src/sockets/clientManager");
}

test("detecta nombres en uso sin importar mayúsculas", () => {
    const cm = freshManager();
    cm.addClient("s1", "Ana");
    assert.equal(cm.isNameInUse("ana"), true);
    assert.equal(cm.isNameInUse("ANA"), true);
});

test("reconoce cliente conocido sin importar mayúsculas", () => {
    const cm = freshManager();
    cm.addClient("s1", "Pedro");
    assert.equal(cm.isKnownName("pedro"), true);
    assert.equal(cm.isKnownName("PEDRO"), true);
});

test("encola y recupera mensajes pendientes sin importar mayúsculas", () => {
    const cm = freshManager();
    cm.addClient("s1", "Luis");
    const message = { id: "m1", text: "hola" };

    assert.equal(cm.addPendingMessage("LUIS", message), true);
    const pending = cm.getPendingMessages("luis");
    assert.equal(pending.length, 1);
    assert.equal(pending[0].id, "m1");
});

test("no encola mensajes para desconocidos", () => {
    const cm = freshManager();
    const message = { id: "m1", text: "hola" };
    assert.equal(cm.addPendingMessage("Desconocido", message), false);
});

test("elimina solo los mensajes pendientes confirmados", () => {
    const cm = freshManager();
    cm.addClient("s1", "Carlos");
    cm.addPendingMessage("Carlos", { id: "m1", text: "a" });
    cm.addPendingMessage("Carlos", { id: "m2", text: "b" });

    cm.removePendingMessages("CARLOS", ["m1"]);
    const pending = cm.getPendingMessages("carlos");
    assert.equal(pending.length, 1);
    assert.equal(pending[0].id, "m2");
});

test("limpia todos los mensajes pendientes", () => {
    const cm = freshManager();
    cm.addClient("s1", "María");
    cm.addPendingMessage("María", { id: "m1", text: "a" });
    cm.clearPendingMessages("MARÍA");
    assert.equal(cm.getPendingMessages("maría").length, 0);
});

test("limita la cantidad de mensajes pendientes por cliente", () => {
    const cm = freshManager();
    cm.addClient("s1", "Juan");
    for (let i = 0; i < cm.MAX_PENDING_PER_CLIENT + 5; i++) {
        cm.addPendingMessage("Juan", { id: `m${i}`, text: String(i) });
    }
    assert.equal(cm.getPendingMessages("Juan").length, cm.MAX_PENDING_PER_CLIENT);
});

test("getKnownClients refleja reconexión con nuevo socket id", () => {
    const cm = freshManager();
    cm.addClient("old-id", "Sofia");
    cm.removeClient("old-id");
    cm.addClient("new-id", "Sofia");

    const known = cm.getKnownClients();
    const sofia = known.find((c) => c.name === "Sofia");
    assert.ok(sofia);
    assert.equal(sofia.id, "new-id");
    assert.equal(sofia.online, true);
});

test("guarda recibos de entrega para remitente offline", () => {
    const cm = freshManager();
    cm.addClient("s1", "Ana");
    cm.addPendingDeliveryReceipt("Ana", ["m1", "m2"]);

    const receipts = cm.getPendingDeliveryReceipts("ANA");
    assert.deepEqual(receipts, ["m1", "m2"]);
});

test("no duplica recibos de entrega", () => {
    const cm = freshManager();
    cm.addClient("s1", "Ana");
    cm.addPendingDeliveryReceipt("Ana", ["m1"]);
    cm.addPendingDeliveryReceipt("Ana", ["m1", "m2"]);

    const receipts = cm.getPendingDeliveryReceipts("Ana");
    assert.equal(receipts.length, 2);
});

test("elimina solo los recibos de entrega confirmados", () => {
    const cm = freshManager();
    cm.addClient("s1", "Ana");
    cm.addPendingDeliveryReceipt("Ana", ["m1", "m2", "m3"]);

    cm.removePendingDeliveryReceipts("ANA", ["m1", "m3"]);
    assert.deepEqual(cm.getPendingDeliveryReceipts("Ana"), ["m2"]);
});
