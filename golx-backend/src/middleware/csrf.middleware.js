const crypto = require('node:crypto');
const env = require('../config/env');

const COOKIE_NAME = 'csrfToken';
const HEADER_NAME = 'x-csrf-token';
const csrfSecret = env.CSRF_SECRET || env.COOKIE_SECRET;

const excludedPrefixes = [
    '/api/v1/auth/login',
    '/api/v1/auth/admin/login',
    '/api/v1/auth/signup',
    '/api/v1/auth/refresh',
    '/api/v1/auth/2fa/verify',
    '/api/v1/auth/2fa/backup-verify',
];

function signNonce(nonce) {
    return crypto.createHmac('sha256', csrfSecret).update(nonce).digest('base64url');
}

function createToken() {
    const nonce = crypto.randomBytes(24).toString('base64url');
    return `${nonce}.${signNonce(nonce)}`;
}

function isValidToken(token) {
    if (!token || typeof token !== 'string') return false;
    const [nonce, signature] = token.split('.');
    if (!nonce || !signature) return false;
    const expected = signNonce(nonce);
    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function setCsrfCookie(req, res, next) {
    const existing = req.cookies?.[COOKIE_NAME];
    const token = isValidToken(existing) ? existing : createToken();
    res.locals.csrfToken = token;

    if (token !== existing) {
        res.cookie(COOKIE_NAME, token, {
            httpOnly: false,
            secure: env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 24 * 60 * 60 * 1000,
        });
    }
    return next();
}

function requireCsrfToken(req, res, next) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (excludedPrefixes.some((prefix) => req.originalUrl.startsWith(prefix))) return next();
    if (!req.cookies?.accessToken) return next();
    if (req.get('authorization')?.startsWith('Bearer ')) return next();

    const cookieToken = req.cookies?.[COOKIE_NAME];
    const headerToken = req.get(HEADER_NAME);
    if (isValidToken(cookieToken) && headerToken === cookieToken) return next();

    return res.status(403).json({
        success: false,
        error: { code: 'CSRF_TOKEN_REJECTED', message: 'CSRF token is missing or invalid' },
    });
}

module.exports = {
    createToken,
    setCsrfCookie,
    requireCsrfToken,
};
