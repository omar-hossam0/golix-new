const { BadRequestError } = require('./errors');

function startsWithBytes(buffer, bytes) {
    if (!Buffer.isBuffer(buffer) || buffer.length < bytes.length) return false;
    return bytes.every((byte, index) => buffer[index] === byte);
}

function isPng(buffer) {
    return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function isJpeg(buffer) {
    return startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
}

function isWebp(buffer) {
    return (
        Buffer.isBuffer(buffer) &&
        buffer.length >= 12 &&
        buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
        buffer.slice(8, 12).toString('ascii') === 'WEBP'
    );
}

function isPdf(buffer) {
    return Buffer.isBuffer(buffer) && buffer.slice(0, 5).toString('ascii') === '%PDF-';
}

function isLegacyWord(buffer) {
    return startsWithBytes(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
}

function isZipBasedDocx(buffer) {
    return startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) || startsWithBytes(buffer, [0x50, 0x4b, 0x05, 0x06]);
}

function assertUploadSignature(mimeType, buffer) {
    const normalized = String(mimeType || '').toLowerCase();
    const valid =
        (normalized === 'image/png' && isPng(buffer)) ||
        ((normalized === 'image/jpeg' || normalized === 'image/jpg') && isJpeg(buffer)) ||
        (normalized === 'image/webp' && isWebp(buffer)) ||
        (normalized === 'application/pdf' && isPdf(buffer)) ||
        (normalized === 'application/msword' && isLegacyWord(buffer)) ||
        (normalized === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && isZipBasedDocx(buffer));

    if (!valid) {
        throw new BadRequestError('Uploaded file content does not match its declared type.');
    }
}

module.exports = {
    assertUploadSignature,
    isJpeg,
    isPdf,
    isPng,
    isWebp,
};
