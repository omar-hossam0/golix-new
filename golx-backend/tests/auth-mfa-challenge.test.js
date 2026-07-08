require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const AuthService = require('../src/modules/auth/auth.service');
const { signAccessToken } = require('../src/shared/jwt');
const { UnauthorizedError } = require('../src/shared/errors');

describe('MFA login challenges', () => {
    test('rejects a challenge after it has already been consumed', async () => {
        const returning = jest.fn(async () => []);
        const update = jest.fn(() => ({ returning }));
        const whereExpires = jest.fn(() => ({ update }));
        const whereNull = jest.fn(() => ({ where: whereExpires }));
        const whereId = jest.fn(() => ({ whereNull }));
        const db = jest.fn(() => ({ where: whereId }));
        const repo = {
            db,
            findById: jest.fn(),
        };
        const redis = {
            getdel: jest.fn(async () => null),
        };
        const service = new AuthService(repo, redis);
        const tempToken = signAccessToken(
            {
                userId: 'user-1',
                purpose: '2fa',
                jti: 'dd12eb1b-365f-4ce1-86d4-014a6a3a33d4',
            },
            { expiresIn: '5m' },
        );

        await expect(
            service.completeLoginAfter2FA(tempToken, '127.0.0.1', 'jest'),
        ).rejects.toBeInstanceOf(UnauthorizedError);

        expect(redis.getdel).toHaveBeenCalledWith(
            'goalix:auth:mfa-challenge:dd12eb1b-365f-4ce1-86d4-014a6a3a33d4',
        );
        expect(db).toHaveBeenCalledWith('auth_mfa_challenges');
        expect(whereId).toHaveBeenCalledWith({ id: 'dd12eb1b-365f-4ce1-86d4-014a6a3a33d4' });
        expect(whereNull).toHaveBeenCalledWith('consumed_at');
        expect(whereExpires).toHaveBeenCalledWith('expires_at', '>', expect.any(Date));
        expect(update).toHaveBeenCalledWith({ consumed_at: expect.any(Date) });
        expect(repo.findById).not.toHaveBeenCalled();
    });

    test('stores a challenge in PostgreSQL when Redis is unavailable', async () => {
        const insert = jest.fn(async () => ({}));
        const db = jest.fn(() => ({ insert }));
        const repo = {
            db,
        };
        const redis = {
            set: jest.fn(async () => {
                throw new Error('Redis unavailable');
            }),
        };
        const service = new AuthService(repo, redis);

        await expect(service._storeMfaChallenge('challenge-1', 'user-1')).resolves.toBe(true);

        expect(db).toHaveBeenCalledWith('auth_mfa_challenges');
        expect(insert).toHaveBeenCalledWith({
            id: 'challenge-1',
            user_id: 'user-1',
            expires_at: expect.any(Date),
        });
    });

    test('consumes a PostgreSQL challenge when Redis is unavailable', async () => {
        const returning = jest.fn(async () => [{ user_id: 'user-1' }]);
        const update = jest.fn(() => ({ returning }));
        const whereExpires = jest.fn(() => ({ update }));
        const whereNull = jest.fn(() => ({ where: whereExpires }));
        const whereId = jest.fn(() => ({ whereNull }));
        const db = jest.fn(() => ({ where: whereId }));
        const repo = {
            db,
        };
        const redis = {
            getdel: jest.fn(async () => {
                throw new Error('Redis unavailable');
            }),
        };
        const service = new AuthService(repo, redis);

        await expect(
            service._consumeMfaChallenge('challenge-1'),
        ).resolves.toBe('user-1');
        expect(db).toHaveBeenCalledWith('auth_mfa_challenges');
        expect(whereId).toHaveBeenCalledWith({ id: 'challenge-1' });
        expect(whereNull).toHaveBeenCalledWith('consumed_at');
        expect(whereExpires).toHaveBeenCalledWith('expires_at', '>', expect.any(Date));
        expect(update).toHaveBeenCalledWith({ consumed_at: expect.any(Date) });
    });
});

describe('logout refresh revocation', () => {
    test('revokes the stored refresh session even when the access token expired', async () => {
        const repo = {
            findRefreshTokenByHash: jest.fn(async () => ({
                id: 'refresh-session-1',
                user_id: 'user-1',
            })),
            revokeRefreshToken: jest.fn(async () => 1),
            revokeAccessSessionByJti: jest.fn(async () => 0),
            createAuditLog: jest.fn(async () => ({})),
        };
        const redis = {
            del: jest.fn(async () => 1),
        };
        const service = new AuthService(repo, redis);

        await service.logout(
            null,
            'refresh-token-hash',
            '127.0.0.1',
            'jest',
            null,
        );

        expect(repo.revokeRefreshToken).toHaveBeenCalledWith('refresh-session-1');
        expect(repo.createAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 'user-1',
                action: 'logout',
            }),
        );
    });
});
