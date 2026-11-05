const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("http");
const express = require("express");
const createAdminRoutes = require("../src/routes/admin.routes");

function freshManager() {
    delete require.cache[require.resolve("../src/sockets/clientManager")];
    return require("../src/sockets/clientManager");
}

function createAdminApp(clientManager, emitted) {
    const io = {
        emit(event, payload) {
            emitted.push({ event, payload });
        },
        sockets: { sockets: new Map() }
    };

    const app = express();
    app.use(express.json());
    app.use(createAdminRoutes(clientManager, io));

    return { app, server: createServer(app) };
}

async function listen(server) {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
    await new Promise((resolve) => server.close(resolve));
}

function withAdminToken(t, token) {
    const previous = process.env.ADMIN_TOKEN;
    if (token === undefined) {
        delete process.env.ADMIN_TOKEN;
    } else {
        process.env.ADMIN_TOKEN = token;
    }
    t.after(() => {
        if (previous === undefined) {
            delete process.env.ADMIN_TOKEN;
        } else {
            process.env.ADMIN_TOKEN = previous;
        }
    });
}

test("removeUserByName limpia cliente, pendientes y notifica", () => {
    const cm = freshManager();
    cm.addClient("s1", "Ana");
    cm.addPendingMessage("Ana", { id: "m1" });
    cm.addPendingDeliveryReceipt("Ana", ["m1"]);

    const events = [];
    const io = {
        emit(event) {
            events.push(event);
        },
        sockets: { sockets: new Map() }
    };

    const result = cm.removeUserByName("ana", io);

    assert.equal(result.removed, true);
    assert.equal(cm.getKnownClients().length, 0);
    assert.equal(cm.getPendingMessages("Ana").length, 0);
    assert.equal(cm.getPendingDeliveryReceipts("Ana").length, 0);
    assert.ok(events.includes("clients-updated"));
});

test("rechaza el panel de admin sin token", async (t) => {
    withAdminToken(t, "clave-de-prueba");

    const emitted = [];
    const { server } = createAdminApp(freshManager(), emitted);
    t.after(() => close(server));
    const base = await listen(server);

    const response = await fetch(`${base}/api/admin/check`);
    assert.equal(response.status, 401);
});

test("acepta el panel de admin con token correcto", async (t) => {
    withAdminToken(t, "clave-de-prueba");

    const emitted = [];
    const { server } = createAdminApp(freshManager(), emitted);
    t.after(() => close(server));
    const base = await listen(server);

    const response = await fetch(`${base}/api/admin/check`, {
        headers: { "X-Admin-Token": "clave-de-prueba" }
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { isAdmin: true });

    const bearer = await fetch(`${base}/api/admin/check`, {
        headers: { Authorization: "Bearer clave-de-prueba" }
    });
    assert.equal(bearer.status, 200);
});

test("elimina un usuario con token y emite la actualización", async (t) => {
    withAdminToken(t, "clave-de-prueba");

    const cm = freshManager();
    cm.addClient("s1", "Ana");

    const emitted = [];
    const { server } = createAdminApp(cm, emitted);
    t.after(() => close(server));
    const base = await listen(server);

    const response = await fetch(`${base}/api/admin/users/Ana`, {
        method: "DELETE",
        headers: { "X-Admin-Token": "clave-de-prueba" }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, removed: "Ana" });
    assert.equal(cm.getKnownClients().length, 0);
    assert.ok(emitted.some((entry) => entry.event === "clients-updated"));
});

test("responde 503 cuando la administración está desactivada", async (t) => {
    withAdminToken(t, undefined);

    const emitted = [];
    const { server } = createAdminApp(freshManager(), emitted);
    t.after(() => close(server));
    const base = await listen(server);

    const response = await fetch(`${base}/api/admin/check`, {
        headers: { "X-Admin-Token": "cualquier-cosa" }
    });
    assert.equal(response.status, 503);
});
