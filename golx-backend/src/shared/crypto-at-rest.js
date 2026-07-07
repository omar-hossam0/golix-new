const crypto = require('node:crypto');
const env = require('../config/env');

const PREFIX = 'enc:v1:';

function keyBuffer() {
    if (!env.TOTP_ENCRYPTION_KEY) return null;
    const raw = env.TOTP_ENCRYPTION_KEY.trim();
    if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
    const decoded = Buffer.from(raw, 'base64');
    return decoded.length === 32 ? decoded : null;
}

function encryptText(value) {
    const key = keyBuffer();
    if (!key || value === null || value === undefined) return value;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptText(value) {
    if (!value || typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
    const key = keyBuffer();
    if (!key) return value;
    const [ivValue, tagValue, encryptedValue] = value.slice(PREFIX.length).split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
    ]).toString('utf8');
}

module.exports = {
    decryptText,
    encryptText,
};
