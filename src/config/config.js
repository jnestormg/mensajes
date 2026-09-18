const path = require("path");

function loadConfig() {
    require("dotenv").config();
    return {
        port: parseInt(process.env.PORT, 10) || 3000,
        host: process.env.HOST || "0.0.0.0",
        publicDir: path.join(__dirname, "..", "..", "public"),
        sslKey: process.env.SSL_KEY || path.join(__dirname, "..", "..", "certs", "server.key"),
        sslCert: process.env.SSL_CERT || path.join(__dirname, "..", "..", "certs", "server.crt")
    };
}

module.exports = loadConfig;