const db = require('../infrastructure/database');
const { ForbiddenError } = require('../shared/errors');
const {
    hasPermission,
    legacyPermissions,
} = require('../shared/authorization');

const rbac = (required) => async (req, _res, next) => {
    if (!req.user) {
        return next(new ForbiddenError('Authentication required'));
    }

    try {
        if (await hasPermission(req.user, required, db)) return next();
        return next(new ForbiddenError('Insufficient permissions'));
    } catch (err) {
        return next(err);
    }
};

const rbacAny = (...requiredPermissions) => async (req, _res, next) => {
    if (!req.user) {
        return next(new ForbiddenError('Authentication required'));
    }

    try {
        for (const permission of requiredPermissions) {
            if (await hasPermission(req.user, permission, db)) return next();
        }
        return next(new ForbiddenError('Insufficient permissions'));
    } catch (err) {
        return next(err);
    }
};

const restrictTo = (...roles) => (req, _res, next) => {
    if (!req.user) {
        return next(new ForbiddenError('Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
        return next(new ForbiddenError('Insufficient permissions'));
    }
    return next();
};

module.exports = { rbac, rbacAny, restrictTo, permissions: legacyPermissions };
