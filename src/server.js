const fs = require("fs");
const os = require("os");
const net = require("net");
const https = require("https");
const { spawn } = require("child_process");
const express = require("express");
const { Server } = require("socket.io");
const config = require("./config/config")();
const routes = require("./routes/health.routes");
const socketHandler = require("./sockets/socketHandler");

const INTERNAL_HTTPS_PORT = 3443;
const TLS_HANDSHAKE_BYTE = 0x16;

function getLanIps() {
    const ips = new Set();
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            if (net.family === "IPv4" && !net.internal) ips.add(net.address);
        }
    }
    return [...ips];
}

function openBrowser(url) {
    const platform = os.platform();
    const args = platform === "win32" ? ["/c", "start", "", url] : [url];
    const cmd = platform === "win32" ? "cmd" : platform === "darwin" ? "open" : "xdg-open";
    try {
        const child = spawn(cmd, args, { detached: true, stdio: "ignore", shell: platform === "win32" });
        child.unref();
    } catch (e) {}
}

function printBanner(port) {
    const ips = getLanIps();
    console.log("");
    console.log("==============================================");
    console.log("  MENSAJERÍA LAN ESTÁ EN LÍNEA");
    console.log(`  Local:    https://localhost:${port}`);
    ips.forEach((ip) => console.log(`  LAN:      https://${ip}:${port}`));
    console.log("");
    console.log("  Pudes escribir IP:PUERTO sin https:// (redirige solo).");
    console.log("  La primera vez acepta el aviso del certificado");
    console.log("  o ejecuta 'npm run trust' para quitarlo.");
    console.log("==============================================");
    console.log("");
}

function writeRedirect(socket, chunk) {
    const head = chunk.toString("latin1");
    const requestLine = (head.split("\r\n")[0] || "");
    const method = (requestLine.match(/^([A-Z]+) /) || [])[1] || "";
    if (!/^(GET|POST|HEAD|PUT|DELETE|OPTIONS|PATCH)$/.test(method)) {
        socket.destroy();
        return;
    }
    const target = (requestLine.match(/^[A-Z]+ (\S+)/) || [])[1] || "/";
    const host = (head.match(/[Hh]ost: ([^\r\n]+)/) || [])[1] || "";
    const safeHost = host.trim().replace(/[^\w.:\-[\]]/g, "");
    const location = "https://" + (safeHost || "localhost") + target;

    socket.end(
        "HTTP/1.1 301 Moved Permanently\r\n" +
        "Location: " + location + "\r\n" +
        "Content-Length: 0\r\n" +
        "Connection: close\r\n\r\n"
    );
}

function createTlsSniffer(port) {
    const outer = net.createServer((socket) => {
        socket.once("data", (chunk) => {
            if (!chunk.length) {
                socket.destroy();
                return;
            }
            if (chunk[0] === TLS_HANDSHAKE_BYTE) {
                const backend = net.connect({ host: "127.0.0.1", port: INTERNAL_HTTPS_PORT });
                backend.on("connect", () => {
                    socket.pipe(backend);
                    backend.pipe(socket);
                    backend.write(chunk);
                });
                backend.on("error", () => socket.destroy());
                socket.on("error", () => backend.destroy());
                socket.on("close", () => backend.destroy());
            } else {
                writeRedirect(socket, chunk);
            }
        });
        socket.on("error", () => {});
    });

    outer.listen(port, config.host, () => {
        printBanner(port);
        if (process.env.AUTO_OPEN !== "0") {
            openBrowser(`https://localhost:${port}`);
        }
    });

    return outer;
}

try {
    const key = fs.readFileSync(config.sslKey);
    const cert = fs.readFileSync(config.sslCert);

    const app = express();
    const inner = https.createServer({ key, cert }, app);
    const io = new Server(inner);

    app.use(express.static(config.publicDir));
    app.use(routes);

    socketHandler.registerSocketHandlers(io);

    inner.listen(INTERNAL_HTTPS_PORT, "127.0.0.1", () => {
        createTlsSniffer(config.port);
    });
} catch (err) {
    console.error("No se pudo cargar el certificado SSL.");
    console.error("Ejecuta 'npm run cert' para generar un certificado autofirmado.");
    console.error(err.message);
    process.exit(1);
}