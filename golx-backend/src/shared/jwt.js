const jwt = require('jsonwebtoken');
const env = require('../config/env');

const accessSecrets = [
    { kid: env.JWT_ACTIVE_KID, secret: env.JWT_SECRET },
    env.JWT_SECRET_PREVIOUS ? { kid: 'previous', secret: env.JWT_SECRET_PREVIOUS } : null,
].filter(Boolean);

const refreshSecrets = [
    { kid: env.JWT_ACTIVE_KID, secret: env.JWT_REFRESH_SECRET },
    env.JWT_REFRESH_SECRET_PREVIOUS ? { kid: 'previous', secret: env.JWT_REFRESH_SECRET_PREVIOUS } : null,
].filter(Boolean);

function signAccessToken(payload, options = {}) {
    return jwt.sign(payload, env.JWT_SECRET, {
        ...options,
        algorithm: 'HS256',
        header: { kid: env.JWT_ACTIVE_KID, ...(options.header || {}) },
    });
}

function signRefreshToken(payload, options = {}) {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
        ...options,
        algorithm: 'HS256',
        header: { kid: env.JWT_ACTIVE_KID, ...(options.header || {}) },
    });
}

function verifyWithSecrets(token, secrets, options = {}) {
    let lastError;
    for (const { secret } of secrets) {
        try {
            return jwt.verify(token, secret, { algorithms: ['HS256'], ...options });
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError;
}

const verifyAccessToken = (token, options) => verifyWithSecrets(token, accessSecrets, options);
const verifyRefreshToken = (token, options) => verifyWithSecrets(token, refreshSecrets, options);

module.exports = {
    decode: jwt.decode,
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
};
