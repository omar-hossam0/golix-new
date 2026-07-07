const { Router } = require('express');
const validate = require('../../middleware/validate.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { rbac } = require('../../middleware/rbac.middleware');
const { attendanceOverviewQuery } = require('./attendance.schema');

function attendanceRoutes(controller) {
    const router = Router();
    router.use(authMiddleware);

    router.get(
        '/overview',
        rbac('attendance:read'),
        validate({ query: attendanceOverviewQuery }),
        controller.getOverview,
    );

    return router;
}

module.exports = attendanceRoutes;
