const fs = require("fs");
const path = require("path");
const webpush = require("web-push");

const ENV_PATH = path.join(__dirname, "..", ".env");

function generateVapidKeys() {
    return webpush.generateVAPIDKeys();
}

function ensureVapidKeys() {
    const envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
    const publicMatch = envContent.match(/^VAPID_PUBLIC_KEY=(.+)$/m);
    const privateMatch = envContent.match(/^VAPID_PRIVATE_KEY=(.+)$/m);

    if (publicMatch && privateMatch) {
        return {
            publicKey: publicMatch[1].trim(),
            privateKey: privateMatch[1].trim(),
            generated: false
        };
    }

    const keys = generateVapidKeys();
    const publicKeyLine = `VAPID_PUBLIC_KEY=${keys.publicKey}`;
    const privateKeyLine = `VAPID_PRIVATE_KEY=${keys.privateKey}`;

    let newContent = envContent;
    if (newContent.length > 0 && !newContent.endsWith("\n")) {
        newContent += "\n";
    }
    newContent += `${publicKeyLine}\n${privateKeyLine}\n`;

    fs.writeFileSync(ENV_PATH, newContent);

    return {
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
        generated: true
    };
}

function setVapidDetails(subject) {
    const keys = ensureVapidKeys();
    webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
    return keys;
}

module.exports = { generateVapidKeys, ensureVapidKeys, setVapidDetails };

if (require.main === module) {
    const keys = ensureVapidKeys();
    if (keys.generated) {
        console.log("Se generaron nuevas claves VAPID.");
    } else {
        console.log("Las claves VAPID ya existen.");
    }
    console.log("Public Key:", keys.publicKey);
}
