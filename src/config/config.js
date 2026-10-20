const path = require("path");

function loadConfig() {
    require("dotenv").config();
    return {
        port: parseInt(process.env.PORT, 10) || 3000,
        host: process.env.HOST || "0.0.0.0",
        publicDir: path.join(__dirname, "..", "..", "public"),
        sslKey: process.env.SSL_KEY || path.join(__dirname, "..", "..", "certs", "server.key"),
        sslCert: process.env.SSL_CERT || path.join(__dirname, "..", "..", "certs", "server.crt"),
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY || "",
        vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || "",
        vapidSubject: process.env.VAPID_SUBJECT || "mailto:admin@localhost"
    };
}

module.exports = loadConfig;