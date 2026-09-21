const fs = require("fs");
const os = require("os");
const net = require("net");
const https = require("https");
const { spawn } = require("child_process");
const express = require("express");
const { Server } = require("socket.io");
const config = require("./config/config")();
const { ensureCert, getLanIps } = require("../scripts/generate-cert");
const routes = require("./routes/health.routes");
const socketHandler = require("./sockets/socketHandler");

const INTERNAL_HTTPS_PORT = 3443;
const TLS_HANDSHAKE_BYTE = 0x16;

function printBanner(port) {
    const ips = getLanIps();
    console.log("");
    console.log("==============================================");
    console.log("  MENSAJERÍA LAN ESTÁ EN LÍNEA");
    console.log(`  Local:    http://localhost:${port}  (redirige a https)`);
    ips.forEach((ip) => console.log(`  LAN:      http://${ip}:${port}  (redirige a https)`));
    console.log("");
    console.log("  Otros equipos escriben IP:PUERTO y entran solos.");
    console.log("  Para recibir notificaciones nativas, ejecuta");
    console.log("  una vez 'npm run trust' en cada equipo.");
    console.log("==============================================");
    console.log("");
}

function openBrowser(url) {
    const platform = os.platform();
    try {
        const child = platform === "win32"
            ? spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" })
            : spawn(platform === "darwin" ? "open" : "xdg-open", [url], { detached: true, stdio: "ignore" });
        child.unref();
    } catch (e) {}
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
    const { generated } = ensureCert();
    if (generated) {
        console.warn("Se generó un certificado nuevo (no existía o cambiaron tus IPs).");
        console.warn("Ejecuta 'npm run trust' en cada equipo de la red una vez.");
    }

    const key = fs.readFileSync(config.sslKey);
    const cert = fs.readFileSync(config.sslCert);

    const app = express();
    const inner = https.createServer({ key, cert }, app);
    const io = new Server(inner);

    app.use(express.static(config.publicDir, {
        etag: true,
        maxAge: 0,
        setHeaders(res) {
            res.setHeader("Cache-Control", "no-cache, must-revalidate");
        }
    }));
    app.use(routes);

    socketHandler.registerSocketHandlers(io);

    inner.listen(INTERNAL_HTTPS_PORT, "127.0.0.1", () => {
        createTlsSniffer(config.port);
    });
} catch (err) {
    console.error("No se pudo iniciar el servidor HTTPS.");
    console.error(err.message);
    process.exit(1);
}