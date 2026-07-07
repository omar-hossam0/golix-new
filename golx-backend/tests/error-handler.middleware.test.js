require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const express = require('express');
const request = require('supertest');
const errorHandler = require('../src/middleware/errorHandler.middleware');
const { BadRequestError } = require('../src/shared/errors');

function buildApp(error) {
    const app = express();
    app.use((req, res, next) => {
        req.id = 'request-test-123';
        res.setHeader('X-Request-ID', req.id);
        next();
    });
    app.get('/fail', (_req, _res, next) => next(error));
    app.use(errorHandler);
    return app;
}

describe('global error handler contract', () => {
    test('returns operational errors with the request reference', async () => {
        const response = await request(buildApp(new BadRequestError('Invalid input')))
            .get('/fail')
            .expect(400);

        expect(response.body).toMatchObject({
            success: false,
            error: {
                code: 'BAD_REQUEST',
                message: 'Invalid input',
            },
            meta: { requestId: 'request-test-123' },
        });
    });

    test('never exposes raw SQL details for unexpected database errors', async () => {
        const databaseError = new Error(
            'insert into "notification_logs" values ($1) - relation "notification_logs" does not exist',
        );
        databaseError.code = '42P01';

        const response = await request(buildApp(databaseError))
            .get('/fail')
            .expect(500);

        expect(response.body.error).toEqual({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            details: [],
        });
        expect(JSON.stringify(response.body)).not.toContain('notification_logs');
        expect(response.body.meta.requestId).toBe('request-test-123');
    });

    test('maps database availability failures to a retryable 503', async () => {
        const databaseError = new Error('connect ECONNREFUSED 127.0.0.1');
        databaseError.code = 'ECONNREFUSED';

        const response = await request(buildApp(databaseError))
            .get('/fail')
            .expect(503);

        expect(response.body.error).toMatchObject({
            code: 'SERVICE_UNAVAILABLE',
            message: 'The service is temporarily unavailable. Please try again.',
            details: [{ retryable: true }],
        });
    });

    test('does not expose database constraint names', async () => {
        const databaseError = new Error('duplicate key');
        databaseError.code = '23505';
        databaseError.constraint = 'auth_users_email_unique';

        const response = await request(buildApp(databaseError))
            .get('/fail')
            .expect(409);

        expect(response.body.error.code).toBe('DUPLICATE_ENTRY');
        expect(JSON.stringify(response.body)).not.toContain('auth_users_email_unique');
    });
});
