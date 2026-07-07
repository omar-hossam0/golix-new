let io = null;

function setChatRealtime(server) {
  io = server;
}

function emitToUsers(userIds, event, payload) {
  if (!io) return;
  for (const userId of new Set(userIds.filter(Boolean))) {
    io.to(`user:${userId}`).emit(event, payload);
  }
}

function metadataFor(event) {
  if (!event) return {};
  return {
    eventId: event.id,
    sequence: Number(event.sequence),
    occurredAt: event.occurred_at,
    eventType: event.event_type,
  };
}

function withMetadata(payload, event) {
  const metadata = metadataFor(event);
  if (!Object.keys(metadata).length) return payload;
  if (Array.isArray(payload)) {
    return payload.map((item) => ({ ...item, ...metadata }));
  }
  return { ...payload, ...metadata };
}

function emitMessage(message, conversation, userIds, event) {
  if (!io) return;
  const payload = withMetadata(message, event);
  io.to(`chat:${message.conversation_id}`).emit("chat:message", payload);
  emitToUsers(userIds, "chat:message", payload);
  emitToUsers(userIds, "chat:conversation", withMetadata(conversation, event));
}

function emitMessageUpdated(message, conversation, userIds) {
  if (!io) return;
  io.to(`chat:${message.conversation_id}`).emit("chat:message_updated", message);
  emitToUsers(userIds, "chat:message_updated", message);
  emitToUsers(userIds, "chat:conversation", conversation);
}

function emitMessageDeleted(message, conversation, userIds) {
  if (!io) return;
  if (message.visibility === "self") {
    emitToUsers(userIds, "chat:message_deleted", message);
    emitToUsers(userIds, "chat:conversation", conversation);
    return;
  }
  io.to(`chat:${message.conversation_id}`).emit("chat:message_deleted", message);
  emitToUsers(userIds, "chat:message_deleted", message);
  emitToUsers(userIds, "chat:conversation", conversation);
}

function emitNotifications(notifications) {
  if (!io || !notifications?.length) return;
  for (const notification of notifications) {
    emitToUsers([notification.user_id], "notification:new", notification);
  }
}

function emitNotificationRead(notification) {
  if (!io || !notification?.user_id) return;
  emitToUsers([notification.user_id], "notification:read", notification);
}

function emitNotificationsReadAll(userId) {
  if (!io || !userId) return;
  emitToUsers([userId], "notification:read_all", { user_id: userId });
}

function emitMessagesRead(messages, conversation, userIds, event) {
  if (!io || !messages.length) return;
  const payload = withMetadata(messages, event);
  io.to(`chat:${conversation.id}`).emit("chat:messages_read", payload);
  emitToUsers(userIds, "chat:messages_read", payload);
}

function emitConversation(conversation, userIds) {
  if (!io) return;
  io.to(`chat:${conversation.id}`).emit("chat:conversation", conversation);
  emitToUsers(userIds, "chat:conversation", conversation);
}

function emitSessionClosed(conversation, userIds) {
  if (!io) return;
  io.to(`chat:${conversation.id}`).emit("chat:session_closed", conversation);
  emitToUsers(userIds, "chat:session_closed", conversation);
}

module.exports = {
  emitConversation,
  emitMessage,
  emitMessageDeleted,
  emitMessageUpdated,
  emitMessagesRead,
  emitNotificationRead,
  emitNotifications,
  emitNotificationsReadAll,
  emitSessionClosed,
  setChatRealtime,
};
