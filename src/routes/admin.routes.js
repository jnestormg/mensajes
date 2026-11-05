const express = require("express");
const { isAdminConfigured, isValidAdminToken } = require("../config/admin");
const pushManager = require("../sockets/pushManager");

function getRequestToken(req) {
    const headerToken = req.headers["x-admin-token"];
    if (typeof headerToken === "string" && headerToken.trim()) {
        return headerToken.trim();
    }

    const authorization = req.headers.authorization;
    if (typeof authorization === "string" && /^Bearer\s+/i.test(authorization)) {
        return authorization.replace(/^Bearer\s+/i, "").trim();
    }

    return "";
}

module.exports = function createAdminRoutes(clientManager, io) {
    const router = express.Router();

    function requireAdmin(req, res, next) {
        if (!isAdminConfigured()) {
            return res.status(503).json({
                error: "La administración está desactivada. Configura ADMIN_TOKEN en el archivo .env."
            });
        }
        if (!isValidAdminToken(getRequestToken(req))) {
            return res.status(401).json({ error: "Clave de administrador incorrecta." });
        }
        return next();
    }

    // Comprobación de la clave desde el frontend
    router.get("/api/admin/check", requireAdmin, (req, res) => {
        res.json({ isAdmin: true });
    });

    // Expulsar y olvidar a un usuario hasta el próximo reinicio
    router.delete("/api/admin/users/:name", requireAdmin, (req, res) => {
        const name = String(req.params.name || "").trim();
        if (!name) {
            return res.status(400).json({ error: "Nombre inválido" });
        }

        const result = clientManager.removeUserByName(name, io);
        if (!result.removed) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        pushManager.removeAllSubscriptions(result.name);
        return res.json({ success: true, removed: result.name });
    });

    return router;
};
