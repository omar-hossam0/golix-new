const { Router } = require('express');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { rbac, rbacAny } = require('../../middleware/rbac.middleware');
const validate = require('../../middleware/validate.middleware');
const {
    uuidParam,
    roleUserParam,
    roleBodySchema,
    roleUpdateSchema,
    createAccessUserSchema,
    reportsOverviewQuery,
    restoreBackupSchema,
} = require('./admin.schema');

function adminRoutes(controller) {
    const router = Router();
    router.use(authMiddleware);

    router.get('/dashboard', rbac('access_admin_dashboard'), controller.getDashboard);
    router.get(
        '/reports/overview',
        rbacAny('view_financial_reports', 'payment.export', 'attendance.export'),
        validate({ query: reportsOverviewQuery }),
        controller.getReportsOverview,
    );

    router.get('/settings/access-control', rbac('manage_roles'), controller.getAccessControl);
    router.get('/settings/backups', rbac('manage_academy_settings'), controller.getBackups);
    router.post('/settings/backups', rbac('manage_academy_settings'), controller.createBackup);
    router.post('/settings/backups/restore', rbac('manage_academy_settings'), validate({ body: restoreBackupSchema }), controller.restoreBackup);
    router.get('/password-reset-requests', rbac('manage_users'), controller.listPasswordResetRequests);
    router.post('/settings/users', rbac('manage_roles'), validate({ body: createAccessUserSchema }), controller.createAccessUser);
    router.post('/settings/roles', rbac('manage_roles'), validate({ body: roleBodySchema }), controller.createRole);
    router.patch('/settings/roles/:id', rbac('manage_roles'), validate({ params: uuidParam, body: roleUpdateSchema }), controller.updateRole);
    router.delete('/settings/roles/:id', rbac('manage_roles'), validate({ params: uuidParam }), controller.deleteRole);
    router.post('/settings/roles/:id/users/:userId', rbac('manage_roles'), validate({ params: roleUserParam }), controller.assignRoleToUser);
    router.delete('/settings/roles/:id/users/:userId', rbac('manage_roles'), validate({ params: roleUserParam }), controller.revokeRoleFromUser);

    return router;
}

module.exports = adminRoutes;
