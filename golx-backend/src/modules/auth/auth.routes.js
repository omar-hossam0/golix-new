const { Router } = require('express');
const validate = require('../../middleware/validate.middleware');
const { authMiddleware, optionalAuth } = require('../../middleware/auth.middleware');
const { rbacAny } = require('../../middleware/rbac.middleware');
const { authLimiter, adminAuthLimiter, mfaAuthLimiter } = require('../../middleware/rateLimit.middleware');
const {
    registerSchema,
    signupSchema,
    registrationStatusSchema,
    loginSchema,
    refreshSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    verify2FASchema,
    verifySetup2FASchema,
    setup2FADeviceSchema,
    verify2FADeviceSchema,
    totpDeviceParamSchema,
    backupCodeSchema,
    disable2FASchema,
    regenerateBackupCodesSchema,
} = require('./auth.schema');

/**
 * Auth Routes — HTTP layer only, no logic.
 * @param {import('./auth.controller')} controller
 */
function authRoutes(controller) {
    const router = Router();
    const allowLoginRoles = (...roles) => (req, _res, next) => {
        req.allowedLoginRoles = roles;
        next();
    };
    const allow2FASelfService = (req, res, next) => {
        if (['admin', 'coach'].includes(req.user?.role)) return next();
        return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: '2FA management is available to administrators and coaches only' },
        });
    };
    const adminLoginLimiter = process.env.NODE_ENV === 'development'
        ? (_req, _res, next) => next()
        : adminAuthLimiter;

    // Admins create any account. Coaches may create player/parent accounts.
    router.post(
        '/register',
        authMiddleware,
        rbacAny('manage_users', 'manage_training_sessions'),
        validate({ body: registerSchema }),
        controller.register,
    );

    router.post(
        '/login',
        authLimiter,
        allowLoginRoles('player', 'parent'),
        validate({ body: loginSchema }),
        controller.login,
    );

    router.post(
        '/signup',
        authLimiter,
        validate({ body: signupSchema }),
        controller.signup,
    );

    router.get(
        '/registration-status',
        authLimiter,
        validate({ query: registrationStatusSchema }),
        controller.registrationStatus,
    );

    // Dedicated admin login with stricter rate limiting
    router.post(
        '/admin/login',
        adminLoginLimiter,
        allowLoginRoles('admin', 'coach'),
        validate({ body: loginSchema }),
        controller.login,
    );

    router.post(
        '/logout',
        optionalAuth,
        controller.logout,
    );

    router.post(
        '/logout-all',
        authMiddleware,
        controller.logoutAll,
    );

    router.post(
        '/refresh',
        validate({ body: refreshSchema.optional() }),
        controller.refresh,
    );

    router.post(
        '/forgot-password',
        authLimiter,
        validate({ body: forgotPasswordSchema }),
        controller.forgotPassword,
    );

    router.post(
        '/reset-password',
        authLimiter,
        validate({ body: resetPasswordSchema }),
        controller.resetPassword,
    );

    router.get(
        '/me',
        authMiddleware,
        controller.me,
    );

    router.get(
        '/permissions',
        authMiddleware,
        controller.permissions,
    );

    // ─── 2FA Routes ─────────────────────────────────────────────────────

    router.post(
        '/2fa/setup',
        authMiddleware,
        allow2FASelfService,
        controller.setup2FA,
    );

    router.post(
        '/2fa/verify-setup',
        authMiddleware,
        allow2FASelfService,
        validate({ body: verifySetup2FASchema }),
        controller.verifySetup2FA,
    );

    router.post(
        '/2fa/verify',
        mfaAuthLimiter,
        validate({ body: verify2FASchema }),
        controller.verify2FA,
    );

    router.post(
        '/2fa/backup-verify',
        mfaAuthLimiter,
        validate({ body: backupCodeSchema }),
        controller.verifyBackupCode,
    );

    router.post(
        '/2fa/backup-codes/regenerate',
        authMiddleware,
        allow2FASelfService,
        validate({ body: regenerateBackupCodesSchema }),
        controller.regenerateBackupCodes,
    );

    router.post(
        '/2fa/disable',
        authMiddleware,
        allow2FASelfService,
        validate({ body: disable2FASchema }),
        controller.disable2FA,
    );

    router.get(
        '/2fa/devices',
        authMiddleware,
        allow2FASelfService,
        controller.list2FADevices,
    );

    router.post(
        '/2fa/devices/setup',
        authMiddleware,
        allow2FASelfService,
        validate({ body: setup2FADeviceSchema }),
        controller.setup2FADevice,
    );

    router.post(
        '/2fa/devices/verify',
        authMiddleware,
        allow2FASelfService,
        validate({ body: verify2FADeviceSchema }),
        controller.verify2FADevice,
    );

    router.delete(
        '/2fa/devices/:id',
        authMiddleware,
        allow2FASelfService,
        validate({ params: totpDeviceParamSchema }),
        controller.revoke2FADevice,
    );

    return router;
}

module.exports = authRoutes;
