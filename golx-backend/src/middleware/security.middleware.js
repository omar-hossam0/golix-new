const path = require('node:path');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const INLINE_UPLOAD_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function rejectCrossSiteMutations(req, res, next) {
    if (!MUTATING_METHODS.has(req.method)) return next();

    const fetchSite = String(req.get('sec-fetch-site') || '').toLowerCase();
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site' && fetchSite !== 'none') {
        return res.status(403).json({
            success: false,
            error: {
                code: 'FETCH_METADATA_REJECTED',
                message: 'Cross-site browser requests are not allowed',
            },
        });
    }

    return next();
}

function noStoreApiResponses(_req, res, next) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return next();
}

function safeAsciiFilename(value) {
    return String(value || 'download')
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/[\\/:*?"<>|]+/g, '-')
        .trim()
        .slice(0, 120) || 'download';
}

function setSecureUploadHeaders(res, relativePath) {
    const extension = path.extname(String(relativePath || '').toLowerCase());
    const disposition = INLINE_UPLOAD_EXTENSIONS.has(extension) ? 'inline' : 'attachment';
    const filename = safeAsciiFilename(path.basename(String(relativePath || 'download')));

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data: blob:");
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
}

module.exports = {
    noStoreApiResponses,
    rejectCrossSiteMutations,
    setSecureUploadHeaders,
};
