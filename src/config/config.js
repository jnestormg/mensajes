const path = require("path");

function loadConfig() {
    require("dotenv").config();
    return {
        port: parseInt(process.env.PORT, 10) || 3000,
        host: process.env.HOST || "0.0.0.0",
        publicDir: path.join(__dirname, "..", "..", "public")
    };
}

module.exports = loadConfig;