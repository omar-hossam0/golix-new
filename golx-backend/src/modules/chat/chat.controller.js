const ApiResponse = require("../../shared/api-response");
const {
  emitConversation,
  emitMessage,
  emitMessageDeleted,
  emitMessageUpdated,
  emitMessagesRead,
  emitSessionClosed,
} = require("../../realtime/chat.realtime");

class ChatController {
  constructor(chatService) {
    this.service = chatService;
  }

  listContacts = async (req, res, next) => {
    try {
      res.json(ApiResponse.success(await this.service.listContacts(req.user)));
    } catch (err) {
      next(err);
    }
  };

  listConversations = async (req, res, next) => {
    try {
      res.json(
        ApiResponse.success(await this.service.listConversations(req.user)),
      );
    } catch (err) {
      next(err);
    }
  };

  createConversation = async (req, res, next) => {
    try {
      const conversation = await this.service.createConversation(
        req.user,
        req.body,
      );
      emitConversation(
        conversation,
        this.service.conversationUserIds(conversation),
      );
      res.status(201).json(ApiResponse.success(conversation));
    } catch (err) {
      next(err);
    }
  };

  getMessages = async (req, res, next) => {
    try {
      const messages = await this.service.listMessages(
        req.user,
        req.params.id,
        req.query,
      );
      const readResult = await this.service.markConversationRead(
        req.user,
        req.params.id,
      );
      emitMessagesRead(
        readResult.messages,
        readResult.conversation,
        readResult.recipientUserIds,
        readResult.event,
      );
      const readById = new Map(
        readResult.messages.map((message) => [message.id, message]),
      );
      res.json(
        ApiResponse.success(
          messages.map((message) => readById.get(message.id) || message),
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  markConversationRead = async (req, res, next) => {
    try {
      const result = await this.service.markConversationRead(
        req.user,
        req.params.id,
      );
      emitMessagesRead(
        result.messages,
        result.conversation,
        result.recipientUserIds,
        result.event,
      );
      res.json(ApiResponse.success(result.messages));
    } catch (err) {
      next(err);
    }
  };

  sendMessage = async (req, res, next) => {
    try {
      const result = await this.service.sendMessage(req.user, req.params.id, {
        body: req.body.body,
        clientMessageId: req.body.clientMessageId,
        image: req.file
          ? {
              originalName: req.file.originalname,
              mimeType: req.file.mimetype,
              buffer: req.file.buffer,
            }
          : null,
      });
      if (!result.idempotent) {
        emitMessage(
          result.message,
          result.conversation,
          result.recipientUserIds,
          result.event,
        );
      }
      res.status(201).json(ApiResponse.success(result.message));
    } catch (err) {
      next(err);
    }
  };

  editMessage = async (req, res, next) => {
    try {
      const result = await this.service.editMessage(
        req.user,
        req.params.id,
        req.params.messageId,
        req.body.body,
      );
      emitMessageUpdated(
        result.message,
        result.conversation,
        result.recipientUserIds,
      );
      res.json(ApiResponse.success(result.message));
    } catch (err) {
      next(err);
    }
  };

  deleteMessage = async (req, res, next) => {
    try {
      const result = await this.service.deleteMessage(
        req.user,
        req.params.id,
        req.params.messageId,
        req.query.scope,
      );
      emitMessageDeleted(
        result.message,
        result.conversation,
        result.recipientUserIds,
      );
      res.json(ApiResponse.success(result.message));
    } catch (err) {
      next(err);
    }
  };

  closeConversation = async (req, res, next) => {
    try {
      const conversation = await this.service.closeConversation(
        req.user,
        req.params.id,
      );
      emitSessionClosed(
        conversation,
        this.service.conversationUserIds(conversation),
      );
      res.json(ApiResponse.success(conversation));
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ChatController;
