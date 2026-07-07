const env = require("../../config/env");
const { redis } = require("../../infrastructure/redis");
const {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} = require("../../shared/errors");
const {
  deleteCacheKeys,
  getJsonCache,
  setJsonCache,
} = require("../../shared/redis-json-cache");
const {
  canAccessAttachment,
  canAccessConversation,
} = require("../../shared/access-policy");
const { auditAccessDenied } = require("../../shared/access-audit");
const storage = require("../../shared/storage");
const { assertMimeSignature } = require("../../shared/file-signature");

const chatImageTypes = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
};

const conversationsCacheKey = (userId) =>
  `goalix:chat:${userId}:conversations:v1`;

function sanitizeFileName(name) {
  return String(name || "chat-image")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

class ChatService {
  constructor(repo) {
    this.repo = repo;
  }

  _assertChatRole(user) {
    if (!["admin", "coach", "player", "parent"].includes(user.role)) {
      throw new ForbiddenError(
        "Chat is available for admins, coaches, players, and parents",
      );
    }
  }

  _targetFor(conversation, viewer) {
    if (conversation.type === "chat_group") {
      return {
        type: "group",
        name: conversation.group_name || "Chat group",
        memberCount: Number(conversation.group_member_count || 0),
      };
    }

    if (conversation.type === "admin_coach") {
      return viewer.role === "coach"
        ? {
            type: "admin",
            userId: conversation.admin_user_id,
            name: conversation.admin_name || "Admin",
          }
        : {
            type: "coach",
            id: conversation.coach_id,
            userId: conversation.coach_user_id,
            name: conversation.coach_name || "Coach",
          };
    }

    if (conversation.type === "coach_player") {
      return viewer.role === "player"
        ? {
            type: "coach",
            id: conversation.coach_id,
            userId: conversation.coach_user_id,
            name: conversation.coach_name || "Coach",
          }
        : {
            type: "player",
            id: conversation.player_id,
            userId: conversation.player_user_id,
            name: conversation.player_name || "Player",
          };
    }

    if (conversation.type === "parent_coach") {
      return viewer.role === "parent"
        ? {
            type: "coach",
            id: conversation.coach_id,
            userId: conversation.coach_user_id,
            name: conversation.coach_name || "Coach",
          }
        : {
            type: "parent",
            userId: conversation.parent_user_id,
            name: conversation.parent_name || "Parent",
          };
    }

    return viewer.role === "player"
      ? {
          type: "admin",
          userId: conversation.admin_user_id,
          name: conversation.admin_name || "Admin",
        }
      : {
          type: "player",
          id: conversation.player_id,
          userId: conversation.player_user_id,
          name: conversation.player_name || "Player",
        };
  }

  _decorateConversation(conversation, viewer) {
    return {
      ...conversation,
      target: this._targetFor(conversation, viewer),
      context: conversation.player_id
        ? {
            playerId: conversation.player_id,
            playerName: conversation.player_name || "Player",
          }
        : null,
      canSend: conversation.status === "open",
      canClose:
        viewer.role === "admin" &&
        conversation.type === "admin_player_session" &&
        conversation.status === "open",
    };
  }

  _canAccessConversation(user, conversation) {
    return canAccessConversation(user, conversation);
  }

  async _allowedGroupMemberUserIds(user) {
    if (user.role === "admin") {
      const contacts = await this.repo.listAdminContacts(user.academyId);
      return new Set([
        user.userId,
        ...(contacts.coaches || []).map((contact) => contact.user_id),
        ...(contacts.players || []).map((contact) => contact.user_id),
      ]);
    }

    if (user.role === "coach") {
      const coach = await this.repo.findCoachByUserId(
        user.userId,
        user.academyId,
      );
      if (!coach) throw new NotFoundError("Coach profile");
      const contacts = await this.repo.listCoachContacts(
        coach.id,
        user.academyId,
      );
      return new Set([
        user.userId,
        ...(contacts.admins || []).map((contact) => contact.user_id),
        ...(contacts.coaches || []).map((contact) => contact.user_id),
        ...(contacts.players || []).map((contact) => contact.user_id),
        ...(contacts.parents || []).map((contact) => contact.user_id),
      ]);
    }

    throw new ForbiddenError("Only admins and coaches can create chat groups");
  }

  async _assertCurrentCoachPlayerAccess(conversation) {
    if (!["coach_player", "parent_coach"].includes(conversation.type)) return;
    const player = await this.repo.findCoachScopedPlayerById(
      conversation.coach_id,
      conversation.academy_id,
      conversation.player_id,
    );
    if (!player) {
      throw new ForbiddenError("Coach no longer has access to this player");
    }
  }

  async _requireConversation(user, conversationId) {
    this._assertChatRole(user);
    const conversation = await this.repo.findConversationById(conversationId);
    if (!conversation || !this._canAccessConversation(user, conversation)) {
      await auditAccessDenied(this.repo.db, user, {
        action: "chat_access_denied",
        entityType: "chat_conversations",
        entityId: conversationId,
        reason: conversation ? "policy_denied" : "not_found",
      });
      throw new NotFoundError("Conversation", conversationId);
    }
    return conversation;
  }

  async listContacts(user) {
    this._assertChatRole(user);

    if (user.role === "admin") {
      return this.repo.listAdminContacts(user.academyId);
    }

    if (user.role === "coach") {
      const coach = await this.repo.findCoachByUserId(
        user.userId,
        user.academyId,
      );
      if (!coach) throw new NotFoundError("Coach profile");
      return this.repo.listCoachContacts(coach.id, user.academyId);
    }

    if (user.role === "player") {
      const player = await this.repo.findPlayerByUserId(
        user.userId,
        user.academyId,
      );
      if (!player) throw new NotFoundError("Player profile");
      return this.repo.listPlayerContacts(player, user.academyId);
    }

    return this.listParentContacts(user);
  }

  async listParentContacts(user) {
    const parent = await this.repo.findParentByUserId(
      user.userId,
      user.academyId,
    );
    if (!parent) throw new NotFoundError("Parent profile");
    return this.repo.listParentContacts(user.userId, user.academyId);
  }

  async listConversations(user) {
    this._assertChatRole(user);
    const cacheKey = conversationsCacheKey(user.userId);
    const cached = await getJsonCache(redis, cacheKey);
    if (cached !== undefined) return cached;

    const rows = await this.repo.listConversationsForUser(user);
    const conversations = rows.map((row) =>
      this._decorateConversation(row, user),
    );
    await setJsonCache(
      redis,
      cacheKey,
      conversations,
      env.CHAT_CONVERSATIONS_CACHE_TTL_SECONDS,
    );
    return conversations;
  }

  async _invalidateConversationCaches(userIds) {
    await deleteCacheKeys(redis, userIds.map(conversationsCacheKey));
  }

  async _decorateNewConversation(conversation, user) {
    await this._invalidateConversationCaches(
      this.repo.conversationUserIds(conversation),
    );
    return this._decorateConversation(conversation, user);
  }

  async getConversation(user, conversationId) {
    const conversation = await this._requireConversation(user, conversationId);
    return this._decorateConversation(conversation, user);
  }

  async createConversation(user, data) {
    this._assertChatRole(user);

    if (data.type === "chat_group") {
      if (!["admin", "coach"].includes(user.role)) {
        throw new ForbiddenError(
          "Only admins and coaches can create chat groups",
        );
      }

      const groupName = String(data.groupName || "").trim();
      if (groupName.length < 2) {
        throw new BadRequestError("Group name is required");
      }

      const requestedMemberUserIds = [
        ...new Set(
          (data.memberUserIds || []).filter((id) => id !== user.userId),
        ),
      ];
      const allowedUserIds = await this._allowedGroupMemberUserIds(user);
      const blockedUserIds = requestedMemberUserIds.filter(
        (userId) => !allowedUserIds.has(userId),
      );
      if (blockedUserIds.length) {
        throw new ForbiddenError(
          "You can only add people available in your chat contacts",
        );
      }

      const activeUsers = await this.repo.findActiveUsersByIds(
        [user.userId, ...requestedMemberUserIds],
        user.academyId,
      );
      const activeUserIds = new Set(activeUsers.map((member) => member.id));
      const missingUserIds = requestedMemberUserIds.filter(
        (userId) => !activeUserIds.has(userId),
      );
      if (missingUserIds.length) {
        throw new NotFoundError("Chat group member");
      }

      const memberUserIds = [user.userId, ...requestedMemberUserIds];
      if (memberUserIds.length < 2) {
        throw new BadRequestError("Choose at least one group member");
      }

      const conversation = await this.repo.createGroupConversation({
        academyId: user.academyId,
        name: groupName,
        createdByUserId: user.userId,
        memberUserIds,
      });
      return this._decorateNewConversation(conversation, user);
    }

    if (data.type === "admin_coach") {
      if (user.role === "admin") {
        if (!data.coachId) {
          throw new BadRequestError("coachId is required for admin-coach chat");
        }
        const coach = await this.repo.findCoachById(
          data.coachId,
          user.academyId,
        );
        if (!coach?.user_id) throw new NotFoundError("Coach", data.coachId);
        const existing = await this.repo.findOpenConversation({
          academyId: user.academyId,
          type: "admin_coach",
          adminUserId: user.userId,
          coachUserId: coach.user_id,
        });
        if (existing) return this._decorateConversation(existing, user);
        const conversation = await this.repo.createConversation({
          academy_id: user.academyId,
          type: "admin_coach",
          status: "open",
          admin_user_id: user.userId,
          coach_user_id: coach.user_id,
          coach_id: coach.id,
          opened_by_user_id: user.userId,
        });
        return this._decorateNewConversation(conversation, user);
      }

      if (user.role === "coach") {
        if (!data.adminUserId) {
          throw new BadRequestError(
            "adminUserId is required for coach-admin chat",
          );
        }
        const coach = await this.repo.findCoachByUserId(
          user.userId,
          user.academyId,
        );
        if (!coach) throw new NotFoundError("Coach profile");
        const admin = await this.repo.findAdminByUserId(
          data.adminUserId,
          user.academyId,
        );
        if (!admin?.user_id) throw new NotFoundError("Admin", data.adminUserId);
        const existing = await this.repo.findOpenConversation({
          academyId: user.academyId,
          type: "admin_coach",
          adminUserId: admin.user_id,
          coachUserId: user.userId,
        });
        if (existing) return this._decorateConversation(existing, user);
        const conversation = await this.repo.createConversation({
          academy_id: user.academyId,
          type: "admin_coach",
          status: "open",
          admin_user_id: admin.user_id,
          coach_user_id: user.userId,
          coach_id: coach.id,
          opened_by_user_id: user.userId,
        });
        return this._decorateNewConversation(conversation, user);
      }

      throw new ForbiddenError("Players cannot open admin chats");
    }

    if (data.type === "parent_coach") {
      if (!data.playerId) {
        throw new BadRequestError("playerId is required for parent-coach chat");
      }

      if (user.role === "parent") {
        if (!data.coachId) {
          throw new BadRequestError(
            "coachId is required for parent-coach chat",
          );
        }
        const parent = await this.repo.findParentByUserId(
          user.userId,
          user.academyId,
        );
        if (!parent) throw new NotFoundError("Parent profile");
        const player = await this.repo.findParentLinkedPlayer(
          user.userId,
          data.playerId,
          user.academyId,
        );
        if (!player) {
          throw new ForbiddenError(
            "Parent can only chat about linked children",
          );
        }
        const coach = await this.repo.findCoachById(
          data.coachId,
          user.academyId,
        );
        if (!coach?.user_id) throw new NotFoundError("Coach", data.coachId);
        const accessiblePlayer = await this.repo.findCoachScopedPlayerById(
          coach.id,
          user.academyId,
          player.id,
        );
        if (!accessiblePlayer) {
          throw new ForbiddenError("This coach cannot access your child");
        }
        const existing = await this.repo.findOpenConversation({
          academyId: user.academyId,
          type: "parent_coach",
          parentUserId: user.userId,
          coachUserId: coach.user_id,
          playerId: player.id,
        });
        if (existing) return this._decorateConversation(existing, user);
        const conversation = await this.repo.createConversation({
          academy_id: user.academyId,
          type: "parent_coach",
          status: "open",
          parent_user_id: user.userId,
          coach_user_id: coach.user_id,
          coach_id: coach.id,
          player_id: player.id,
          opened_by_user_id: user.userId,
        });
        return this._decorateConversation(conversation, user);
      }

      if (user.role === "coach") {
        if (!data.parentUserId) {
          throw new BadRequestError(
            "parentUserId is required for coach-parent chat",
          );
        }
        const coach = await this.repo.findCoachByUserId(
          user.userId,
          user.academyId,
        );
        if (!coach) throw new NotFoundError("Coach profile");
        const parent = await this.repo.findParentByUserId(
          data.parentUserId,
          user.academyId,
        );
        if (!parent) throw new NotFoundError("Parent", data.parentUserId);
        const player = await this.repo.findParentLinkedPlayer(
          data.parentUserId,
          data.playerId,
          user.academyId,
        );
        if (!player) {
          throw new ForbiddenError("Parent is not linked to this player");
        }
        const accessiblePlayer = await this.repo.findCoachScopedPlayerById(
          coach.id,
          user.academyId,
          player.id,
        );
        if (!accessiblePlayer) {
          throw new ForbiddenError("Coach cannot access this player");
        }
        const existing = await this.repo.findOpenConversation({
          academyId: user.academyId,
          type: "parent_coach",
          parentUserId: parent.id,
          coachUserId: user.userId,
          playerId: player.id,
        });
        if (existing) return this._decorateConversation(existing, user);
        const conversation = await this.repo.createConversation({
          academy_id: user.academyId,
          type: "parent_coach",
          status: "open",
          parent_user_id: parent.id,
          coach_user_id: user.userId,
          coach_id: coach.id,
          player_id: player.id,
          opened_by_user_id: user.userId,
        });
        return this._decorateConversation(conversation, user);
      }

      throw new ForbiddenError(
        "Parent-coach chat is only for parents and coaches",
      );
    }

    if (data.type === "admin_player_session") {
      if (user.role !== "admin") {
        throw new ForbiddenError(
          "Only admins can open player support sessions",
        );
      }
      const player = await this.repo.findPlayerById(
        data.playerId,
        user.academyId,
      );
      if (!player?.user_id) throw new NotFoundError("Player", data.playerId);
      const existing = await this.repo.findOpenConversation({
        academyId: user.academyId,
        type: "admin_player_session",
        adminUserId: user.userId,
        playerUserId: player.user_id,
      });
      if (existing) return this._decorateConversation(existing, user);
      const conversation = await this.repo.createConversation({
        academy_id: user.academyId,
        type: "admin_player_session",
        status: "open",
        admin_user_id: user.userId,
        player_user_id: player.user_id,
        player_id: player.id,
        opened_by_user_id: user.userId,
      });
      return this._decorateNewConversation(conversation, user);
    }

    if (data.type !== "coach_player") {
      throw new BadRequestError("Unsupported conversation type");
    }

    if (user.role === "coach") {
      const coach = await this.repo.findCoachByUserId(
        user.userId,
        user.academyId,
      );
      if (!coach) throw new NotFoundError("Coach profile");
      const player = await this.repo.findCoachScopedPlayerById(
        coach.id,
        user.academyId,
        data.playerId,
      );
      if (!player?.user_id) throw new NotFoundError("Player", data.playerId);
      const existing = await this.repo.findOpenConversation({
        academyId: user.academyId,
        type: "coach_player",
        coachUserId: user.userId,
        playerUserId: player.user_id,
      });
      if (existing) return this._decorateConversation(existing, user);
      const conversation = await this.repo.createConversation({
        academy_id: user.academyId,
        type: "coach_player",
        status: "open",
        coach_user_id: user.userId,
        player_user_id: player.user_id,
        coach_id: coach.id,
        player_id: player.id,
        opened_by_user_id: user.userId,
      });
      return this._decorateNewConversation(conversation, user);
    }

    if (user.role === "player") {
      const player = await this.repo.findPlayerByUserId(
        user.userId,
        user.academyId,
      );
      if (!player) throw new NotFoundError("Player profile");
      const coach = await this.repo.findCoachById(data.coachId, user.academyId);
      if (!coach?.user_id) throw new NotFoundError("Coach", data.coachId);
      const accessiblePlayer = await this.repo.findCoachScopedPlayerById(
        coach.id,
        user.academyId,
        player.id,
      );
      if (!accessiblePlayer) {
        throw new ForbiddenError("This coach cannot access your profile");
      }
      const existing = await this.repo.findOpenConversation({
        academyId: user.academyId,
        type: "coach_player",
        coachUserId: coach.user_id,
        playerUserId: user.userId,
      });
      if (existing) return this._decorateConversation(existing, user);
      const conversation = await this.repo.createConversation({
        academy_id: user.academyId,
        type: "coach_player",
        status: "open",
        coach_user_id: coach.user_id,
        player_user_id: user.userId,
        coach_id: coach.id,
        player_id: player.id,
        opened_by_user_id: user.userId,
      });
      return this._decorateNewConversation(conversation, user);
    }

    throw new ForbiddenError(
      "Admins must open an admin-player session for players",
    );
  }

  async closeConversation(user, conversationId) {
    const conversation = await this._requireConversation(user, conversationId);
    if (user.role !== "admin" || conversation.type !== "admin_player_session") {
      throw new ForbiddenError("Only admins can close player support sessions");
    }
    if (conversation.status === "closed") {
      return this._decorateConversation(conversation, user);
    }
    const closed = await this.repo.closeConversation(
      conversationId,
      user.userId,
    );
    await this._invalidateConversationCaches(
      this.repo.conversationUserIds(closed),
    );
    return this._decorateConversation(closed, user);
  }

  async listMessages(user, conversationId, filters) {
    const conversation = await this._requireConversation(user, conversationId);
    const rows = await this.repo.listMessages(conversation.id, user.userId, {
      ...filters,
      includeArchive:
        filters?.includeArchive === true ||
        filters?.includeArchive === "true" ||
        Boolean(filters?.before),
    });
    return rows.reverse();
  }

  async markConversationRead(user, conversationId) {
    const conversation = await this._requireConversation(user, conversationId);
    const readResult = await this.repo.markConversationRead(
      conversation.id,
      user.userId,
    );
    return {
      messages: readResult.messages,
      conversation: this._decorateConversation(conversation, user),
      recipientUserIds: this.repo.conversationUserIds(conversation),
      event: readResult.event,
    };
  }

  async sendMessage(
    user,
    conversationId,
    { body = "", image = null, clientMessageId = null } = {},
  ) {
    const conversation = await this._requireConversation(user, conversationId);
    await this._assertCurrentCoachPlayerAccess(conversation);

    if (conversation.status !== "open") {
      throw new ForbiddenError("This chat session is closed");
    }

    const trimmedBody = String(body || "").trim();
    const attachment = image
      ? await this.storeChatImageUpload(user, image)
      : null;

    if (!trimmedBody && !attachment) {
      throw new BadRequestError("Message text or image is required");
    }

    const result = await this.repo.insertMessage(conversation, {
      senderUserId: user.userId,
      clientMessageId,
      body: trimmedBody,
      attachmentUrl: attachment?.attachmentUrl,
      attachmentOriginalName: attachment?.fileName,
      attachmentMimeType: attachment?.mimeType,
      attachmentSize: attachment?.sizeBytes,
    });
    const updatedConversation = await this.repo.findConversationById(
      conversation.id,
    );
    if (!result.idempotent) {
      await this._invalidateConversationCaches(
        this.repo.conversationUserIds(conversation),
      );
    }
    return {
      message: result.message,
      conversation: this._decorateConversation(updatedConversation, user),
      recipientUserIds: this.repo.conversationUserIds(conversation),
      event: result.event,
      idempotent: result.idempotent,
    };
  }

  async editMessage(user, conversationId, messageId, body) {
    const conversation = await this._requireConversation(user, conversationId);
    await this._assertCurrentCoachPlayerAccess(conversation);
    if (conversation.status !== "open") {
      throw new ForbiddenError("This chat session is closed");
    }

    const message = await this.repo.findMessageForMutation(
      messageId,
      conversation.id,
    );
    if (!message) throw new NotFoundError("Message", messageId);
    if (message.sender_user_id !== user.userId) {
      throw new ForbiddenError("You can only edit your own messages");
    }

    const updated = await this.repo.updateMessageBody(
      messageId,
      String(body || "").trim(),
    );
    const updatedConversation = await this.repo.findConversationById(
      conversation.id,
    );
    await this._invalidateConversationCaches(
      this.repo.conversationUserIds(conversation),
    );

    return {
      message: updated,
      conversation: this._decorateConversation(updatedConversation, user),
      recipientUserIds: this.repo.conversationUserIds(conversation),
    };
  }

  async deleteMessage(user, conversationId, messageId, scope = "everyone") {
    const conversation = await this._requireConversation(user, conversationId);
    await this._assertCurrentCoachPlayerAccess(conversation);
    if (conversation.status !== "open") {
      throw new ForbiddenError("This chat session is closed");
    }

    const message = await this.repo.findMessageForMutation(
      messageId,
      conversation.id,
    );
    if (!message) throw new NotFoundError("Message", messageId);

    if (scope === "me") {
      await this.repo.hideMessageForUser(messageId, user.userId);
      await this._invalidateConversationCaches([user.userId]);
      return {
        message: {
          id: message.id,
          conversation_id: message.conversation_id,
          visibility: "self",
        },
        conversation: this._decorateConversation(conversation, user),
        recipientUserIds: [user.userId],
      };
    }

    if (message.sender_user_id !== user.userId) {
      throw new ForbiddenError("You can only delete your own messages");
    }

    const deleted = await this.repo.softDeleteMessage(messageId, user.userId);
    const deletedMessage = await this.repo.findMessageById(deleted.id, {
      includeDeleted: true,
    });
    const updatedConversation =
      await this.repo.refreshConversationLastMessageAt(conversation.id);
    await this._invalidateConversationCaches(
      this.repo.conversationUserIds(conversation),
    );
    return {
      message: deletedMessage,
      conversation: this._decorateConversation(updatedConversation, user),
      recipientUserIds: this.repo.conversationUserIds(conversation),
    };
  }

  async storeChatImageUpload(user, { originalName, mimeType, buffer }) {
    const normalizedMimeType = String(mimeType || "").toLowerCase();
    const extension = chatImageTypes[normalizedMimeType];
    if (!extension) {
      throw new BadRequestError("Chat image must be PNG, JPG, JPEG, or WEBP.");
    }
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new BadRequestError("Uploaded image is empty.");
    }
    if (buffer.length > 8 * 1024 * 1024) {
      throw new BadRequestError("Chat image must be 8MB or smaller.");
    }
    assertMimeSignature(normalizedMimeType, buffer, "Chat image");

    const upload = await storage.putUpload({
      scope: "chat",
      academyId: user.academyId,
      extension,
      buffer,
      contentType: normalizedMimeType,
      uploaderId: user.userId,
      entityType: "chat_message",
      isSensitive: true,
    });

    return {
      fileName: sanitizeFileName(originalName || "chat-image"),
      attachmentUrl: upload.url,
      mimeType: normalizedMimeType,
      sizeBytes: buffer.length,
    };
  }

  conversationUserIds(conversation) {
    return this.repo.conversationUserIds(conversation);
  }

  async canUserAccessAttachment(user, attachmentUrl) {
    if (!user) return false;
    const message = await this.repo.findMessageByAttachmentUrl(attachmentUrl);
    if (!message) return false;
    const conversation = await this.repo.findConversationById(
      message.conversation_id,
    );
    const allowed = canAccessAttachment(user, message, conversation);
    if (!allowed) {
      await auditAccessDenied(this.repo.db, user, {
        action: "chat_attachment_access_denied",
        entityType: "chat_messages",
        entityId: message.id,
        reason: "policy_denied",
      });
    }
    return allowed;
  }
}

module.exports = ChatService;
module.exports.conversationsCacheKey = conversationsCacheKey;
