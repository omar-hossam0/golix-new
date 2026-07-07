require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { requireCsrfToken, setCsrfCookie } = require('../src/middleware/csrf.middleware');
const ApiResponse = require('../src/shared/api-response');

function cookieValue(setCookieHeader, name) {
    const cookie = setCookieHeader.find((item) => item.startsWith(`${name}=`));
    return cookie?.split(';')[0].slice(name.length + 1);
}

function buildCsrfApp() {
    const app = express();
    app.use(cookieParser(process.env.COOKIE_SECRET));
    app.use(setCsrfCookie);
    app.use(express.json());
    app.use(requireCsrfToken);

    app.get('/api/v1/csrf-token', (_req, res) => {
        res.json(ApiResponse.success({ csrfToken: res.locals.csrfToken }));
    });
    app.post('/api/v1/protected', (_req, res) => {
        res.json(ApiResponse.success({ ok: true }));
    });

    return app;
}

describe('CSRF middleware', () => {
    test('issues a readable csrf token cookie and response token', async () => {
        const res = await request(buildCsrfApp())
            .get('/api/v1/csrf-token')
            .expect(200);

        const csrfCookie = cookieValue(res.headers['set-cookie'], 'csrfToken');
        expect(csrfCookie).toBeTruthy();
        expect(res.body.data.csrfToken).toBe(csrfCookie);
    });

    test('rejects authenticated cookie mutations without a matching csrf header', async () => {
        const app = buildCsrfApp();
        const tokenRes = await request(app).get('/api/v1/csrf-token').expect(200);
        const csrfToken = cookieValue(tokenRes.headers['set-cookie'], 'csrfToken');

        const res = await request(app)
            .post('/api/v1/protected')
            .set('Cookie', [`accessToken=mock`, `csrfToken=${csrfToken}`])
            .send({ value: true })
            .expect(403);

        expect(res.body.error.code).toBe('CSRF_TOKEN_REJECTED');
    });

    test('allows authenticated cookie mutations with a matching csrf header', async () => {
        const app = buildCsrfApp();
        const tokenRes = await request(app).get('/api/v1/csrf-token').expect(200);
        const csrfToken = cookieValue(tokenRes.headers['set-cookie'], 'csrfToken');

        const res = await request(app)
            .post('/api/v1/protected')
            .set('Cookie', [`accessToken=mock`, `csrfToken=${csrfToken}`])
            .set('X-CSRF-Token', csrfToken)
            .send({ value: true })
            .expect(200);

        expect(res.body.data.ok).toBe(true);
    });
});
