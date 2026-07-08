require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const AuthService = require('../src/modules/auth/auth.service');
const { signAccessToken } = require('../src/shared/jwt');
const { UnauthorizedError } = require('../src/shared/errors');

describe('MFA login challenges', () => {
    test('rejects a challenge after it has already been consumed', async () => {
        const repo = {
            consumeMfaChallenge: jest.fn(async () => null),
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
        expect(repo.consumeMfaChallenge).toHaveBeenCalledWith(
            'dd12eb1b-365f-4ce1-86d4-014a6a3a33d4',
            'user-1',
        );
        expect(repo.findById).not.toHaveBeenCalled();
    });

    test('stores a challenge in PostgreSQL when Redis is unavailable', async () => {
        const repo = {
            createMfaChallenge: jest.fn(async () => ({})),
        };
        const redis = {
            set: jest.fn(async () => {
                throw new Error('Redis unavailable');
            }),
        };
        const service = new AuthService(repo, redis);

        await expect(service._storeMfaChallenge('challenge-1', 'user-1')).resolves.toBe(true);

        expect(repo.createMfaChallenge).toHaveBeenCalledWith(
            'challenge-1',
            'user-1',
            expect.any(Date),
        );
    });

    test('returns true when Redis stores a challenge', async () => {
        const repo = {
            createMfaChallenge: jest.fn(),
        };
        const redis = {
            set: jest.fn(async () => 'OK'),
        };
        const service = new AuthService(repo, redis);

        await expect(service._storeMfaChallenge('challenge-1', 'user-1')).resolves.toBe(true);
        expect(redis.set).toHaveBeenCalledWith(
            'goalix:auth:mfa-challenge:challenge-1',
            'user-1',
            'EX',
            300,
            'NX',
        );
        expect(repo.createMfaChallenge).not.toHaveBeenCalled();
    });

    test('consumes a PostgreSQL challenge when Redis is unavailable', async () => {
        const repo = {
            consumeMfaChallenge: jest.fn(async () => 'user-1'),
        };
        const redis = {
            getdel: jest.fn(async () => {
                throw new Error('Redis unavailable');
            }),
        };
        const service = new AuthService(repo, redis);

        await expect(
            service._consumeMfaChallenge('challenge-1', 'user-1'),
        ).resolves.toBe('user-1');
        expect(repo.consumeMfaChallenge).toHaveBeenCalledWith('challenge-1', 'user-1');
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
