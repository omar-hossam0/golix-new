require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const express = require('express');
const request = require('supertest');
const {
    noStoreApiResponses,
    rejectCrossSiteMutations,
    setSecureUploadHeaders,
} = require('../src/middleware/security.middleware');

function buildApp() {
    const app = express();
    app.use(noStoreApiResponses);
    app.use(rejectCrossSiteMutations);
    app.post('/write', (_req, res) => res.json({ ok: true }));
    app.get('/read', (_req, res) => res.json({ ok: true }));
    app.get('/upload/:name', (req, res) => {
        setSecureUploadHeaders(res, req.params.name);
        res.send('file');
    });
    return app;
}

describe('security hardening middleware', () => {
    test('rejects cross-site browser mutation requests', async () => {
        const res = await request(buildApp())
            .post('/write')
            .set('Sec-Fetch-Site', 'cross-site')
            .send({ ok: true })
            .expect(403);

        expect(res.body.error.code).toBe('FETCH_METADATA_REJECTED');
    });

    test('allows same-site mutation requests and disables API caching', async () => {
        const res = await request(buildApp())
            .post('/write')
            .set('Sec-Fetch-Site', 'same-site')
            .send({ ok: true })
            .expect(200);

        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body.ok).toBe(true);
    });

    test('sets restrictive upload headers and downloads non-image files', async () => {
        const res = await request(buildApp())
            .get('/upload/report.docx')
            .expect(200);

        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['content-security-policy']).toContain('sandbox');
        expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
        expect(res.headers['content-disposition']).toContain('attachment');
    });

    test('allows image uploads to render inline with nosniff headers', async () => {
        const res = await request(buildApp())
            .get('/upload/photo.webp')
            .expect(200);

        expect(res.headers['content-disposition']).toContain('inline');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
});
