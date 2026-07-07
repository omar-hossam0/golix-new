const eventBus = require("../../events/eventBus");
const NOTIFICATIONS_EVENTS = require("./notifications.events");
const env = require("../../config/env");
const { redis } = require("../../infrastructure/redis");
const { NotFoundError } = require("../../shared/errors");
const {
  deleteCacheKeys,
  getJsonCache,
  setJsonCache,
} = require("../../shared/redis-json-cache");

const unreadCountCacheKey = (userId) =>
  `goalix:notifications:${userId}:unread-count:v1`;

class NotificationsService {
  constructor(notificationsRepository, notificationsQueue) {
    this.repo = notificationsRepository;
    this.queue = notificationsQueue;
    this.dataLifecycleService = null;
  }

  setDataLifecycleService(dataLifecycleService) {
    this.dataLifecycleService = dataLifecycleService;
  }

  async getUserNotifications(user, filters) {
    return this.repo.findByUser(user.userId, filters, user);
  }

  async getUnreadCount(user) {
    const cacheKey = unreadCountCacheKey(user.userId);
    const cached = await getJsonCache(redis, cacheKey);
    if (cached !== undefined) return cached;

    const count = await this.repo.getUnreadCount(user.userId, user);
    await setJsonCache(
      redis,
      cacheKey,
      count,
      env.NOTIFICATION_UNREAD_COUNT_CACHE_TTL_SECONDS,
    );
    return count;
  }

  async _invalidateUnreadCounts(userIds) {
    await deleteCacheKeys(redis, userIds.map(unreadCountCacheKey));
  }

  async _resolveRecipients(data, academyId) {
    if (!data.userId) return this.repo.targetUsers(academyId, data.targetRole);

    const recipient = await this.repo.findTargetUser(academyId, data.userId);
    if (!recipient) throw new NotFoundError("User", data.userId);
    return [recipient];
  }

  async sendNotification(data, academyId) {
    const recipients = await this._resolveRecipients(data, academyId);

    const notificationRows = recipients.map((recipient) => ({
      user_id: recipient.user_id,
      type: data.type,
      title: data.title,
      body: data.body,
      data: data.data || {},
      is_read: false,
    }));
    let notifications = [];
    if (notificationRows.length) {
      if (typeof this.repo.createBulkWithLogs === "function") {
        notifications = await this.repo.createBulkWithLogs(
          notificationRows,
          data.channel,
        );
      } else {
        notifications = await this.repo.createBulk(notificationRows);
        if (typeof this.repo.logNotification === "function") {
          for (const notification of notifications) {
            await this.repo.logNotification({
              notification_id: notification.id,
              academy_id: academyId,
              user_id: notification.user_id,
              channel: data.channel,
              status: "sent",
              sent_at: new Date(),
            });
          }
        }
      }
    }
    await this._invalidateUnreadCounts(
      recipients.map((recipient) => recipient.user_id),
    );

    // Queue delivery via channel
    if (data.channel !== "in_app") {
      await this.queue.add("bulk-notification", {
        notificationIds: notifications.map((notification) => notification.id),
        channel: data.channel,
        academyId,
        targetRole: data.targetRole,
      });
    }

    eventBus.publish(NOTIFICATIONS_EVENTS.NOTIFICATION_SENT, {
      count: notifications.length,
      targetRole: data.targetRole || null,
      type: data.type,
    });

    return {
      count: notifications.length,
      notifications,
    };
  }

  async sendBulkNotification(academyId, data) {
    const result = await this.sendNotification(data, academyId);
    eventBus.publish(NOTIFICATIONS_EVENTS.BULK_NOTIFICATION_SENT, {
      type: data.type,
      academyId,
      count: result.count,
    });

    return { message: "Bulk notification sent", count: result.count };
  }

  async markAsRead(notificationId, userId) {
    const notif = await this.repo.markAsRead(notificationId, userId);
    if (!notif) throw new NotFoundError("Notification", notificationId);
    await this._invalidateUnreadCounts([userId]);

    eventBus.publish(NOTIFICATIONS_EVENTS.NOTIFICATION_READ, {
      notificationId,
      userId,
    });

    return notif;
  }

  async markAllAsRead(userId) {
    const count = await this.repo.markAllAsRead(userId);
    await this._invalidateUnreadCounts([userId]);
    return { markedRead: count };
  }

  async getLogs(filters) {
    return this.repo.findLogs(filters);
  }

  async cleanupExpiredNotifications({
    now = new Date(),
    retentionMonths = env.NOTIFICATION_RETENTION_MONTHS,
  } = {}) {
    if (!this.dataLifecycleService) {
      const cutoffDate = new Date(now);
      cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - retentionMonths);
      return {
        skipped: true,
        reason: "data_lifecycle_service_unavailable",
        cutoffDate: cutoffDate.toISOString(),
        retentionMonths,
        archivedNotifications: 0,
        archivedLogs: 0,
        removedHotNotifications: 0,
        removedHotLogs: 0,
        deletedNotifications: 0,
        deletedLogs: 0,
      };
    }

    const result = await this.dataLifecycleService.archiveNotifications({
      now,
      retentionMonths,
    });
    return {
      ...result,
      retentionMonths,
    };
  }
}

module.exports = NotificationsService;
module.exports.unreadCountCacheKey = unreadCountCacheKey;
