const { z } = require('zod');

const uuidParam = z.object({ id: z.string().uuid() });

const sendNotificationSchema = z.object({
    userId: z.string().uuid().optional(),
    type: z.enum(['info', 'warning', 'success', 'error', 'alert']).default('info'),
    title: z.string().min(1).max(200),
    body: z.string().max(2000),
    channel: z.enum(['in_app', 'push', 'email', 'sms']).default('in_app'),
    targetRole: z.enum(['admin', 'coach', 'player', 'parent']).optional(),
});

const bulkNotificationSchema = z.object({
    type: z.enum(['info', 'warning', 'success', 'error', 'alert']).default('info'),
    title: z.string().min(1).max(200),
    body: z.string().max(2000),
    channel: z.enum(['in_app', 'push', 'email', 'sms']).default('in_app'),
    targetRole: z.enum(['admin', 'coach', 'player', 'parent']).optional(),
});

const notificationsQuery = z.object({
    isRead: z.enum(['true', 'false']).optional(),
    type: z.enum(['info', 'warning', 'success', 'error', 'alert']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    includeArchive: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => value === 'true'),
});

const logsQuerySchema = z.object({
    channel: z.enum(['in_app', 'push', 'email', 'sms']).optional(),
    status: z.enum(['sent', 'delivered', 'failed']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    includeArchive: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => value === 'true'),
});

module.exports = {
    uuidParam,
    sendNotificationSchema,
    bulkNotificationSchema,
    notificationsQuery,
    logsQuerySchema,
};
