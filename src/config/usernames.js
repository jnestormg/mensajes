const NAME_MAX_LENGTH = 30;

function normalizeUsername(value) {
    if (typeof value !== "string") return "";
    return value.trim().replace(/\s+/g, " ");
}

function isValidUsername(value) {
    const normalized = normalizeUsername(value);
    return normalized.length > 0 && normalized.length <= NAME_MAX_LENGTH;
}

function getUsernames() {
    return [];
}

module.exports = { NAME_MAX_LENGTH, normalizeUsername, isValidUsername, getUsernames };