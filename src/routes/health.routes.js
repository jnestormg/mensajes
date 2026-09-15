const express = require("express");
const clientManager = require("../sockets/clientManager");

const router = express.Router();

router.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

router.get("/api/clients", (req, res) => {
    res.json(clientManager.getClients());
});

module.exports = router;