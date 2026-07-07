const env = require('./env');

const configuredOrigins = env.CORS_ORIGINS
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

function isPrivateLanHost(hostname) {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
}

function isAllowedOrigin(origin) {
    if (!origin) return true;
    if (configuredOrigins.includes(origin)) return true;

    if (env.NODE_ENV === 'development') {
        try {
            const url = new URL(origin);
            return ['http:', 'https:'].includes(url.protocol) &&
                url.port === '3001' &&
                isPrivateLanHost(url.hostname);
        } catch {
            return false;
        }
    }

    return false;
}

function corsOrigin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
}

module.exports = {
    configuredOrigins,
    corsOrigin,
    isAllowedOrigin,
};
