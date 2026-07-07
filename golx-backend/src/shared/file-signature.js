const { BadRequestError } = require('./errors');

function startsWith(buffer, bytes) {
    if (!Buffer.isBuffer(buffer) || buffer.length < bytes.length) return false;
    return bytes.every((byte, index) => buffer[index] === byte);
}

function isPng(buffer) {
    return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function isJpeg(buffer) {
    return startsWith(buffer, [0xff, 0xd8, 0xff]);
}

function isWebp(buffer) {
    return Buffer.isBuffer(buffer)
        && buffer.length >= 12
        && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
        && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
}

function isPdf(buffer) {
    return Buffer.isBuffer(buffer)
        && buffer.length >= 5
        && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

function isDoc(buffer) {
    return startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
}

function isZipBasedOfficeDocument(buffer) {
    return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])
        || startsWith(buffer, [0x50, 0x4b, 0x05, 0x06])
        || startsWith(buffer, [0x50, 0x4b, 0x07, 0x08]);
}

function matchesMimeSignature(mimeType, buffer) {
    switch (mimeType) {
        case 'image/png':
            return isPng(buffer);
        case 'image/jpeg':
        case 'image/jpg':
            return isJpeg(buffer);
        case 'image/webp':
            return isWebp(buffer);
        case 'application/pdf':
            return isPdf(buffer);
        case 'application/msword':
            return isDoc(buffer);
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            return isZipBasedOfficeDocument(buffer);
        default:
            return true;
    }
}

function assertMimeSignature(mimeType, buffer, label = 'Uploaded file') {
    if (matchesMimeSignature(mimeType, buffer)) return;
    throw new BadRequestError(`${label} content does not match its declared file type.`);
}

module.exports = {
    assertMimeSignature,
    isZipBasedOfficeDocument,
    matchesMimeSignature,
};
