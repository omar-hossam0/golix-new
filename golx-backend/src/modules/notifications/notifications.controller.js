const ApiResponse = require('../../shared/api-response');
const { parsePagination, buildPaginationMeta } = require('../../shared/pagination');

class NotificationsController {
    constructor(notificationsService) {
        this.service = notificationsService;
    }

    getNotifications = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            const result = await this.service.getUserNotifications(req.user, { ...req.query, page, limit });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };

    getUnreadCount = async (req, res, next) => {
        try {
            const count = await this.service.getUnreadCount(req.user);
            res.json(ApiResponse.success({ unread: count }));
        } catch (err) { next(err); }
    };

    send = async (req, res, next) => {
        try {
            const notif = await this.service.sendNotification(req.body, req.user.academyId);
            res.status(201).json(ApiResponse.success(notif));
        } catch (err) { next(err); }
    };

    sendBulk = async (req, res, next) => {
        try {
            const result = await this.service.sendBulkNotification(req.user.academyId, req.body);
            res.status(202).json(ApiResponse.success(result));
        } catch (err) { next(err); }
    };

    markAsRead = async (req, res, next) => {
        try {
            const notif = await this.service.markAsRead(req.params.id, req.user.userId);
            res.json(ApiResponse.success(notif));
        } catch (err) { next(err); }
    };

    markAllAsRead = async (req, res, next) => {
        try {
            const result = await this.service.markAllAsRead(req.user.userId);
            res.json(ApiResponse.success(result));
        } catch (err) { next(err); }
    };

    getLogs = async (req, res, next) => {
        try {
            const { page, limit } = parsePagination(req.query);
            // req.query is already Zod-validated and stripped by logsQuerySchema
            const { channel, status } = req.query;
            const result = await this.service.getLogs({
                academyId: req.user.academyId,
                channel,
                status,
                page,
                limit,
            });
            res.json(ApiResponse.paginated(result.data, buildPaginationMeta(result.total, page, limit)));
        } catch (err) { next(err); }
    };
}

module.exports = NotificationsController;
