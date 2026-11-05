const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", ".env");
const FORCE = process.argv.includes("--force");

function readEnv() {
    return fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
}

function main() {
    let content = readEnv();

    if (/^ADMIN_TOKEN=.+/m.test(content) && !FORCE) {
        console.log("Ya existe un ADMIN_TOKEN en .env.");
        console.log("Si quieres cambiarlo, ejecuta: npm run admin-token -- --force");
        return;
    }

    const token = crypto.randomBytes(24).toString("base64url");

    if (/^ADMIN_TOKEN=.*$/m.test(content)) {
        content = content.replace(/^ADMIN_TOKEN=.*$/m, `ADMIN_TOKEN=${token}`);
    } else {
        if (content.length > 0 && !content.endsWith("\n")) content += "\n";
        content += `ADMIN_TOKEN=${token}\n`;
    }

    fs.writeFileSync(ENV_PATH, content);
    console.log("Clave de administrador creada en .env:");
    console.log(`  ${token}`);
    console.log("");
    console.log("Guárdala. La necesitarás para abrir el panel de administración.");
}

main();
