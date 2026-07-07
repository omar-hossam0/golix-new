require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const { BadRequestError } = require('../src/shared/errors');
const { assertUploadSignature } = require('../src/shared/upload-validation');

describe('upload signature validation', () => {
    test('accepts a PNG signature for image/png', () => {
        const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
        expect(() => assertUploadSignature('image/png', png)).not.toThrow();
    });

    test('accepts a PDF signature for application/pdf', () => {
        expect(() => assertUploadSignature('application/pdf', Buffer.from('%PDF-1.7'))).not.toThrow();
    });

    test('rejects HTML content declared as an image', () => {
        expect(() => assertUploadSignature('image/png', Buffer.from('<script>alert(1)</script>')))
            .toThrow(BadRequestError);
    });

    test('rejects HTML content declared as a PDF', () => {
        expect(() => assertUploadSignature('application/pdf', Buffer.from('<html></html>')))
            .toThrow(BadRequestError);
    });
});
