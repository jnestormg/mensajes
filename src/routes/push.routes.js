const express = require("express");
const pushManager = require("../sockets/pushManager");

function createPushRoutes(vapidPublicKey) {
    const router = express.Router();

    router.get("/api/vapid-public-key", (req, res) => {
        res.json({ publicKey: vapidPublicKey });
    });

    router.post("/api/subscribe", (req, res) => {
        const { name, subscription } = req.body || {};
        if (!name || typeof name !== "string") {
            return res.status(400).json({ error: "Nombre requerido." });
        }
        if (!subscription || typeof subscription !== "object") {
            return res.status(400).json({ error: "Suscripción requerida." });
        }

        const added = pushManager.addSubscription(name, subscription);
        if (!added) {
            return res.status(400).json({ error: "Suscripción inválida." });
        }

        res.json({ success: true });
    });

    router.post("/api/unsubscribe", (req, res) => {
        const { name, subscription } = req.body || {};
        if (!name || !subscription) {
            return res.status(400).json({ error: "Nombre y suscripción requeridos." });
        }

        pushManager.removeSubscription(name, subscription);
        res.json({ success: true });
    });

    return router;
}

module.exports = createPushRoutes;
