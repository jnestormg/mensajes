const fs = require("fs");
const os = require("os");
const path = require("path");
const selfsigned = require("selfsigned");

const CERTS_DIR = path.join(__dirname, "..", "certs");
const KEY_PATH = path.join(CERTS_DIR, "server.key");
const CERT_PATH = path.join(CERTS_DIR, "server.crt");
const IPS_MARKER = path.join(CERTS_DIR, ".ips");

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

function getAltNames() {
    const altNames = [
        { type: 2, value: "localhost" },
        { type: 7, ip: "127.0.0.1" }
    ];
    for (const ip of getLanIps()) {
        if (ip !== "127.0.0.1") {
            altNames.push({ type: 7, ip });
        }
    }
    return altNames;
}

function generateCert() {
    fs.mkdirSync(CERTS_DIR, { recursive: true });

    const altNames = getAltNames();
    const pems = selfsigned.generate([
        { name: "commonName", value: "Mensajeria LAN" },
        { name: "organizationName", value: "Mensajeria LAN" }
    ], {
        days: 3650,
        keySize: 2048,
        algorithm: "sha256",
        extensions: [
            { name: "basicConstraints", cA: true },
            { name: "keyUsage", digitalSignature: true, keyEncipherment: true, keyCertSign: true },
            { name: "subjectAltName", altNames }
        ]
    });

    fs.writeFileSync(KEY_PATH, pems.private);
    fs.writeFileSync(CERT_PATH, pems.cert);
    fs.writeFileSync(IPS_MARKER, JSON.stringify(getLanIps(), null, 2));
}

function certExists() {
    return fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH);
}

function ipMarkerOutdated() {
    let saved = [];
    try {
        saved = JSON.parse(fs.readFileSync(IPS_MARKER, "utf8"));
    } catch (e) {}
    if (!Array.isArray(saved)) return true;
    const current = getLanIps().slice().sort();
    const previous = saved.slice().sort();
    return current.length !== previous.length || current.some((ip, i) => ip !== previous[i]);
}

function ensureCert({ force = false } = {}) {
    if (!certExists() || force || ipMarkerOutdated()) {
        generateCert();
        return { generated: true };
    }
    return { generated: false };
}

if (require.main === module) {
    const { generated } = ensureCert({ force: true });
    console.log("Certificado autofirmado generado:");
    console.log(`  Clave:   ${KEY_PATH}`);
    console.log(`  Cert:    ${CERT_PATH}`);
    console.log(`  IPs LAN: ${getLanIps().join(", ") || "(ninguna detectada)"}`);
    console.log("Cada máquina debe confiarlo una vez con 'npm run trust'.");
    if (!generated) process.exit(0);
}

module.exports = { generateCert, ensureCert, certExists, getLanIps };