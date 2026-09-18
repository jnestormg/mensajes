const express = require("express");
const clientManager = require("../sockets/clientManager");
const { getUsernames } = require("../config/usernames");

const router = express.Router();

router.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

router.get("/api/clients", (req, res) => {
    res.json(clientManager.getKnownClients());
});

router.get("/api/usernames", (req, res) => {
    res.json(getUsernames());
});

module.exports = router;