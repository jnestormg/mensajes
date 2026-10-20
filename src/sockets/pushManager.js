const webpush = require("web-push");

const subscriptions = new Map();

function nameKey(name) {
    return String(name || "").toLowerCase();
}

function normalizeSubscription(subscription) {
    if (!subscription || typeof subscription !== "object") return null;
    const endpoint = typeof subscription.endpoint === "string" ? subscription.endpoint : "";
    if (!endpoint) return null;
    return {
        endpoint,
        keys: subscription.keys || {}
    };
}

function addSubscription(name, subscription) {
    const key = nameKey(name);
    const normalized = normalizeSubscription(subscription);
    if (!normalized) return false;

    const list = subscriptions.get(key) || [];
    const existingIndex = list.findIndex((s) => s.endpoint === normalized.endpoint);
    if (existingIndex !== -1) {
        list[existingIndex] = normalized;
    } else {
        list.push(normalized);
    }

    subscriptions.set(key, list);
    return true;
}

function removeSubscription(name, subscription) {
    const key = nameKey(name);
    const endpoint = subscription && typeof subscription.endpoint === "string" ? subscription.endpoint : "";
    if (!endpoint) return;

    const list = subscriptions.get(key);
    if (!list) return;

    const filtered = list.filter((s) => s.endpoint !== endpoint);
    if (filtered.length === 0) {
        subscriptions.delete(key);
    } else {
        subscriptions.set(key, filtered);
    }
}

function getSubscriptions(name) {
    return subscriptions.get(nameKey(name)) || [];
}

function removeSubscriptionByEndpoint(endpoint) {
    subscriptions.forEach((list, key) => {
        const filtered = list.filter((s) => s.endpoint !== endpoint);
        if (filtered.length === 0) {
            subscriptions.delete(key);
        } else {
            subscriptions.set(key, filtered);
        }
    });
}

async function sendNotification(targetName, payload, excludeName) {
    const targetKey = nameKey(targetName);
    const excludeKey = nameKey(excludeName);
    const list = subscriptions.get(targetKey);
    if (!list || list.length === 0) return;

    const data = {
        title: payload.title || "Mensajería LAN",
        body: payload.body || "",
        conv: payload.conv || null,
        tag: payload.tag || "lan-message"
    };

    const results = await Promise.allSettled(
        list.map(async (subscription) => {
            try {
                await webpush.sendNotification(subscription, JSON.stringify(data));
                return { ok: true };
            } catch (err) {
                return { ok: false, endpoint: subscription.endpoint, statusCode: err.statusCode };
            }
        })
    );

    results.forEach((result) => {
        if (result.status === "fulfilled" && !result.value.ok) {
            const { statusCode, endpoint } = result.value;
            if (statusCode === 404 || statusCode === 410) {
                removeSubscriptionByEndpoint(endpoint);
            }
        }
    });
}

async function broadcastNotification(payload, excludeName) {
    const excludeKey = nameKey(excludeName);
    const promises = [];
    subscriptions.forEach((list, key) => {
        if (key === excludeKey) return;
        list.forEach((subscription) => {
            promises.push(
                webpush.sendNotification(subscription, JSON.stringify(payload)).catch((err) => ({ err, endpoint: subscription.endpoint }))
            );
        });
    });

    const results = await Promise.allSettled(promises);
    results.forEach((result) => {
        if (result.status === "fulfilled" && result.value && result.value.err) {
            const { err, endpoint } = result.value;
            if (err.statusCode === 404 || err.statusCode === 410) {
                removeSubscriptionByEndpoint(endpoint);
            }
        }
    });
}

module.exports = {
    addSubscription,
    removeSubscription,
    getSubscriptions,
    sendNotification,
    broadcastNotification
};
