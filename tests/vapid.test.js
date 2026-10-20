const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { generateVapidKeys, ensureVapidKeys } = require("../scripts/generate-vapid");

const ENV_PATH = path.join(__dirname, "..", ".env");

test("genera un par de claves VAPID válidas", () => {
    const keys = generateVapidKeys();
    assert.equal(typeof keys.publicKey, "string");
    assert.equal(typeof keys.privateKey, "string");
    assert.ok(keys.publicKey.length > 0);
    assert.ok(keys.privateKey.length > 0);
});

test("ensureVapidKeys lee claves existentes o genera nuevas", () => {
    const originalContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";

    const keys = ensureVapidKeys();
    assert.equal(typeof keys.publicKey, "string");
    assert.equal(typeof keys.privateKey, "string");

    const newContent = fs.readFileSync(ENV_PATH, "utf8");
    assert.ok(newContent.includes(`VAPID_PUBLIC_KEY=${keys.publicKey}`));
    assert.ok(newContent.includes(`VAPID_PRIVATE_KEY=${keys.privateKey}`));

    if (originalContent) {
        fs.writeFileSync(ENV_PATH, originalContent);
    } else {
        fs.unlinkSync(ENV_PATH);
    }
});
