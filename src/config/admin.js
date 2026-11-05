const crypto = require("crypto");

function getAdminToken() {
    return String(process.env.ADMIN_TOKEN || "").trim();
}

function isAdminConfigured() {
    return getAdminToken().length > 0;
}

function isValidAdminToken(candidate) {
    const expected = getAdminToken();
    if (!expected || typeof candidate !== "string") return false;

    const provided = candidate.trim();
    if (!provided) return false;

    const a = crypto.createHash("sha256").update(provided).digest();
    const b = crypto.createHash("sha256").update(expected).digest();
    return crypto.timingSafeEqual(a, b);
}

module.exports = { getAdminToken, isAdminConfigured, isValidAdminToken };
