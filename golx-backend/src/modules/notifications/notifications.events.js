const NOTIFICATIONS_EVENTS = {
    NOTIFICATION_SENT: 'notifications.sent',      // { notificationId, userId, type }
    NOTIFICATION_READ: 'notifications.read',      // { notificationId, userId }
    BULK_NOTIFICATION_SENT: 'notifications.bulk.sent', // { count, type, academyId }
};

module.exports = NOTIFICATIONS_EVENTS;
