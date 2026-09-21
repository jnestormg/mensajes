const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const CERT_PATH = path.join(__dirname, "..", "certs", "server.crt");

if (!fs.existsSync(CERT_PATH)) {
    console.error("No existe el certificado. Ejecuta primero 'npm run cert'.");
    process.exit(1);
}

const platform = os.platform();

try {
    if (platform === "win32") {
        execFileSync("certutil", ["-user", "-addstore", "Root", CERT_PATH], { stdio: "inherit" });
        console.log("Certificado instalado como raíz de confianza (usuario).");
        console.log("Reinicia el navegador y entra a la app para recibir notificaciones nativas.");
    } else if (platform === "darwin") {
        const keychain = path.join(os.homedir(), "Library", "Keychains", "login.keychain-db");
        execFileSync("security", ["add-trusted-cert", "-d", "-r", "trustRoot", "-k", keychain, CERT_PATH], { stdio: "inherit" });
        console.log("Certificado instalado en el llavero de confianza.");
    } else {
        console.log("Linux: copia el certificado y actualiza el almacén:");
        console.log(`  sudo cp "${CERT_PATH}" /usr/local/share/ca-certificates/lan-messenger.crt`);
        console.log("  sudo update-ca-certificates");
    }
} catch (err) {
    console.error("No se pudo instalar el certificado automáticamente.");
    console.error("Ejecuta 'npm run trust' en la máquina con permisos de administrador.");
    console.error(err.stderr ? err.stderr.toString() : err.message);
    process.exit(1);
}