require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const express = require('express');
const request = require('supertest');
const authRoutes = require('../src/modules/auth/auth.routes');

function buildAuthContractApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', authRoutes({
        login: (req, res) => res.json({ allowedRoles: req.allowedLoginRoles }),
        register: (_req, res) => res.status(204).end(),
        signup: (_req, res) => res.status(204).end(),
        registrationStatus: (_req, res) => res.status(204).end(),
        logout: (_req, res) => res.status(204).end(),
        logoutAll: (_req, res) => res.status(204).end(),
        refresh: (_req, res) => res.status(204).end(),
        forgotPassword: (_req, res) => res.status(204).end(),
        resetPassword: (_req, res) => res.status(204).end(),
        me: (_req, res) => res.status(204).end(),
        permissions: (_req, res) => res.status(204).end(),
        setup2FA: (_req, res) => res.status(204).end(),
        verifySetup2FA: (_req, res) => res.status(204).end(),
        verify2FA: (_req, res) => res.status(204).end(),
        verifyBackupCode: (_req, res) => res.status(204).end(),
        disable2FA: (_req, res) => res.status(204).end(),
        list2FADevices: (_req, res) => res.status(204).end(),
        setup2FADevice: (_req, res) => res.status(204).end(),
        verify2FADevice: (_req, res) => res.status(204).end(),
        revoke2FADevice: (_req, res) => res.status(204).end(),
        regenerateBackupCodes: (_req, res) => res.status(204).end(),
    }));
    return app;
}

describe('auth route contracts', () => {
    test('public login accepts only player and parent roles', async () => {
        const res = await request(buildAuthContractApp())
            .post('/api/v1/auth/login')
            .send({ username: 'player_one', password: 'secret' })
            .expect(200);

        expect(res.body.allowedRoles).toEqual(['player', 'parent']);
    });

    test('admin login accepts only admin and coach roles', async () => {
        const res = await request(buildAuthContractApp())
            .post('/api/v1/auth/admin/login')
            .send({ username: 'admin_one', password: 'secret' })
            .expect(200);

        expect(res.body.allowedRoles).toEqual(['admin', 'coach']);
    });
});
