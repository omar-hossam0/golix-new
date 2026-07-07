const { Router } = require('express');
const validate = require('../../middleware/validate.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { rbac } = require('../../middleware/rbac.middleware');
const {
    uuidParam,
    sendNotificationSchema,
    bulkNotificationSchema,
    notificationsQuery,
    logsQuerySchema,
} = require('./notifications.schema');

function notificationsRoutes(controller) {
    const router = Router();
    router.use(authMiddleware);

    router.get('/', rbac('*'), validate({ query: notificationsQuery }), controller.getNotifications);
    router.get('/unread-count', rbac('*'), controller.getUnreadCount);
    // send: admin-only — prevents any authenticated user from spamming arbitrary users
    router.post('/send', rbac('access_admin_dashboard'), validate({ body: sendNotificationSchema }), controller.send);
    router.post('/send-bulk', rbac('access_admin_dashboard'), validate({ body: bulkNotificationSchema }), controller.sendBulk);
    router.patch('/:id/read', rbac('*'), validate({ params: uuidParam }), controller.markAsRead);
    router.patch('/read-all', rbac('*'), controller.markAllAsRead);
    // Logs: admin-only with validated query params
    router.get('/logs', rbac('access_admin_dashboard'), validate({ query: logsQuerySchema }), controller.getLogs);

    return router;
}

module.exports = notificationsRoutes;
