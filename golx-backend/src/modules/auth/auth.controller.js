const crypto = require('node:crypto');
const ApiResponse = require('../../shared/api-response');
const env = require('../../config/env');
const { durationToMilliseconds } = require('../../shared/duration');

const DEFAULT_ACCESS_COOKIE_MS = 15 * 60 * 1000;
const DEFAULT_REFRESH_COOKIE_MS = 7 * 24 * 60 * 60 * 1000;

class AuthController {
    constructor(authService, totpService) {
        this.authService = authService;
        this.totpService = totpService;
    }

    register = async (req, res, next) => {
        try {
            const result = await this.authService.register(req.body, req.user);
            res.status(201).json(ApiResponse.success({
                user: result.user,
            }));
        } catch (err) {
            next(err);
        }
    };

    signup = async (req, res, next) => {
        try {
            const result = await this.authService.signup(req.body);
            res.status(201).json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    registrationStatus = async (req, res, next) => {
        try {
            const result = await this.authService.getRegistrationStatus(req.query.email);
            res.json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    login = async (req, res, next) => {
        try {
            const ip = req.ip;
            const userAgent = req.get('user-agent');
            const result = await this.authService.login({
                ...req.body,
                allowedRoles: req.allowedLoginRoles,
            }, ip, userAgent);

            if (result.requires2FA) {
                return res.json(ApiResponse.success({
                    requires2FA: true,
                    tempToken: result.tempToken,
                }));
            }

            const rememberMe = req.body.rememberMe !== false;
            this._setAuthCookies(res, result.accessToken, result.refreshToken, rememberMe);

            res.json(ApiResponse.success({
                user: result.user,
                mfaSetupRequired: result.mfaSetupRequired || false,
            }));
        } catch (err) {
            next(err);
        }
    };

    // ─── 2FA Endpoints ──────────────────────────────────────────────────

    setup2FA = async (req, res, next) => {
        try {
            const result = await this.totpService.setup(req.user.userId);
            res.json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    verifySetup2FA = async (req, res, next) => {
        try {
            const result = await this.totpService.verifyAndEnable(req.user.userId, req.body.token);
            res.json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    verify2FA = async (req, res, next) => {
        try {
            const { tempToken, token } = req.body;
            // Verify TOTP first
            const { verifyAccessToken } = require('../../shared/jwt');
            let decoded;
            try {
                decoded = verifyAccessToken(tempToken);
            } catch {
                return res.status(401).json(ApiResponse.error('UNAUTHORIZED', 'Invalid or expired 2FA token'));
            }

            if (decoded.purpose !== '2fa') {
                return res.status(401).json(ApiResponse.error('UNAUTHORIZED', 'Invalid token purpose'));
            }

            await this.totpService.verify(decoded.userId, token);

            const ip = req.ip;
            const userAgent = req.get('user-agent');
            const result = await this.authService.completeLoginAfter2FA(tempToken, ip, userAgent);

            this._setAuthCookies(res, result.accessToken, result.refreshToken);

            res.json(ApiResponse.success({
                user: result.user,
            }));
        } catch (err) {
            next(err);
        }
    };

    verifyBackupCode = async (req, res, next) => {
        try {
            const { tempToken, code } = req.body;
            const { verifyAccessToken } = require('../../shared/jwt');
            let decoded;
            try {
                decoded = verifyAccessToken(tempToken);
            } catch {
                return res.status(401).json(ApiResponse.error('UNAUTHORIZED', 'Invalid or expired 2FA token'));
            }

            if (decoded.purpose !== '2fa') {
                return res.status(401).json(ApiResponse.error('UNAUTHORIZED', 'Invalid token purpose'));
            }

            await this.totpService.verifyBackupCode(decoded.userId, code);

            const ip = req.ip;
            const userAgent = req.get('user-agent');
            const result = await this.authService.completeLoginAfter2FA(tempToken, ip, userAgent);

            this._setAuthCookies(res, result.accessToken, result.refreshToken);

            res.json(ApiResponse.success({
                user: result.user,
            }));
        } catch (err) {
            next(err);
        }
    };

    disable2FA = async (req, res, next) => {
        try {
            const result = await this.totpService.disable(req.user.userId, req.body.password);
            res.json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    list2FADevices = async (req, res, next) => {
        try {
            const result = await this.totpService.listDevices(req.user.userId);
            res.json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    setup2FADevice = async (req, res, next) => {
        try {
            const result = await this.totpService.setupDevice(req.user.userId, req.body);
            res.json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    verify2FADevice = async (req, res, next) => {
        try {
            const result = await this.totpService.verifyDevice(
                req.user.userId,
                req.body.deviceId,
                req.body.token,
            );
            res.json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    revoke2FADevice = async (req, res, next) => {
        try {
            const result = await this.totpService.revokeDevice(req.user.userId, req.params.id);
            res.json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    regenerateBackupCodes = async (req, res, next) => {
        try {
            const result = await this.totpService.regenerateBackupCodes(
                req.user.userId,
                req.body.password,
            );
            res.json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    logout = async (req, res, next) => {
        try {
            const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
            let tokenHash = null;
            if (refreshToken) {
                tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
            }

            if (req.user?.userId) {
                await this.authService.logout(
                    req.user.userId,
                    tokenHash,
                    req.ip,
                    req.get('user-agent'),
                    req.user.sessionId,
                );
            }

            this._clearAuthCookies(res);
            res.json(ApiResponse.success({ message: 'Logged out successfully' }));
        } catch (err) {
            next(err);
        }
    };

    logoutAll = async (req, res, next) => {
        try {
            const result = await this.authService.logoutAllDevices(
                req.user.userId, req.ip, req.get('user-agent'),
            );
            this._clearAuthCookies(res);
            res.json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    refresh = async (req, res, next) => {
        try {
            const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
            if (!refreshToken) {
                return res.status(401).json(
                    ApiResponse.error('UNAUTHORIZED', 'Refresh token required'),
                );
            }

            const result = await this.authService.refreshToken(refreshToken);

            this._setAuthCookies(res, result.accessToken, result.refreshToken);

            res.json(ApiResponse.success({
                user: result.user,
            }));
        } catch (err) {
            next(err);
        }
    };

    forgotPassword = async (req, res, next) => {
        try {
            const result = await this.authService.forgotPassword(req.body);
            res.json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    resetPassword = async (req, res, next) => {
        try {
            const result = await this.authService.resetPassword(req.body.token, req.body.password);
            res.json(ApiResponse.success(result));
        } catch (err) {
            next(err);
        }
    };

    me = async (req, res, next) => {
        try {
            const user = await this.authService.getCurrentUser(req.user.userId);
            if (!user) {
                return res.status(404).json(ApiResponse.error('RESOURCE_NOT_FOUND', 'User not found'));
            }
            res.json(ApiResponse.success({
                ...user,
                user,
            }, { requestId: req.id }));
        } catch (err) {
            next(err);
        }
    };

    permissions = async (req, res, next) => {
        try {
            const data = await this.authService.getCurrentPermissions(req.user);
            res.json(ApiResponse.success(data, { requestId: req.id }));
        } catch (err) {
            next(err);
        }
    };

    _cookieOptions(maxAge, path = '/') {
        const options = {
            httpOnly: true,
            secure: env.ENABLE_HTTPS === true,
            sameSite: 'strict',
            maxAge,
            path,
        };

        return options;
    }

    _setAuthCookies(res, accessToken, refreshToken, rememberMe = true) {
        res.cookie(
            'accessToken',
            accessToken,
            this._cookieOptions(durationToMilliseconds(env.JWT_ACCESS_EXPIRY, DEFAULT_ACCESS_COOKIE_MS)),
        );
        res.cookie(
            'refreshToken',
            refreshToken,
            this._cookieOptions(
                rememberMe
                    ? durationToMilliseconds(env.JWT_REFRESH_EXPIRY, DEFAULT_REFRESH_COOKIE_MS)
                    : undefined,
                '/api/v1/auth',
            ),
        );
    }

    _clearAuthCookies(res) {
        res.clearCookie('accessToken', this._cookieOptions(0));
        res.clearCookie('refreshToken', this._cookieOptions(0, '/api/v1/auth'));
    }
}

module.exports = AuthController;
