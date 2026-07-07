const UNIT_TO_MS = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
};

function durationToMilliseconds(value, fallbackMs) {
    if (value === undefined || value === null || value === '') return fallbackMs;
    if (typeof value === 'number' && Number.isFinite(value)) return value * 1000;

    const raw = String(value).trim();
    if (/^\d+$/.test(raw)) return Number(raw) * 1000;

    const match = raw.match(/^(\d+)(ms|s|m|h|d)$/i);
    if (!match) return fallbackMs;

    return Number(match[1]) * UNIT_TO_MS[match[2].toLowerCase()];
}

function durationToSeconds(value, fallbackSeconds) {
    return Math.max(1, Math.ceil(durationToMilliseconds(value, fallbackSeconds * 1000) / 1000));
}

module.exports = {
    durationToMilliseconds,
    durationToSeconds,
};
