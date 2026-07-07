const { matchesMimeSignature, assertMimeSignature } = require('../src/shared/file-signature');

describe('file signature validation', () => {
    test('accepts matching common upload signatures', () => {
        expect(matchesMimeSignature('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
        expect(matchesMimeSignature('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xdb]))).toBe(true);
        expect(matchesMimeSignature('application/pdf', Buffer.from('%PDF-1.7'))).toBe(true);
        expect(matchesMimeSignature(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        )).toBe(true);
    });

    test('rejects mismatched upload signatures', () => {
        expect(() => assertMimeSignature('image/png', Buffer.from('%PDF-1.7'), 'Chat image'))
            .toThrow('Chat image content does not match its declared file type.');
    });
});
