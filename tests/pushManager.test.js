const test = require("node:test");
const assert = require("node:assert/strict");

function freshPushManager() {
    delete require.cache[require.resolve("../src/sockets/pushManager")];
    return require("../src/sockets/pushManager");
}

function createSubscription(endpoint) {
    return {
        endpoint: endpoint || "https://fcm.googleapis.com/fcm/send/test-1",
        keys: {
            p256dh: "BHRJ...",
            auth: "abc123"
        }
    };
}

test("agrega y recupera suscripciones por nombre", () => {
    const pm = freshPushManager();
    const subscription = createSubscription();

    assert.equal(pm.addSubscription("Ana", subscription), true);
    const list = pm.getSubscriptions("ANA");
    assert.equal(list.length, 1);
    assert.equal(list[0].endpoint, subscription.endpoint);
});

test("rechaza suscripciones inválidas", () => {
    const pm = freshPushManager();
    assert.equal(pm.addSubscription("Ana", null), false);
    assert.equal(pm.addSubscription("Ana", { keys: {} }), false);
});

test("actualiza suscripción existente con mismo endpoint", () => {
    const pm = freshPushManager();
    const sub1 = createSubscription("https://example.com/1");
    const sub2 = { ...sub1, keys: { p256dh: "nueva", auth: "nueva" } };

    pm.addSubscription("Ana", sub1);
    pm.addSubscription("Ana", sub2);

    const list = pm.getSubscriptions("Ana");
    assert.equal(list.length, 1);
    assert.equal(list[0].keys.p256dh, "nueva");
});

test("elimina suscripción por endpoint", () => {
    const pm = freshPushManager();
    const sub1 = createSubscription("https://example.com/1");
    const sub2 = createSubscription("https://example.com/2");

    pm.addSubscription("Ana", sub1);
    pm.addSubscription("Ana", sub2);
    pm.removeSubscription("Ana", sub1);

    const list = pm.getSubscriptions("Ana");
    assert.equal(list.length, 1);
    assert.equal(list[0].endpoint, sub2.endpoint);
});

test("mantiene suscripciones de diferentes usuarios separadas", () => {
    const pm = freshPushManager();
    pm.addSubscription("Ana", createSubscription("https://example.com/ana"));
    pm.addSubscription("Pedro", createSubscription("https://example.com/pedro"));

    assert.equal(pm.getSubscriptions("Ana").length, 1);
    assert.equal(pm.getSubscriptions("Pedro").length, 1);
});
