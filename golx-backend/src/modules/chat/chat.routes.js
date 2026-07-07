const { Router } = require("express");
const multer = require("multer");
const validate = require("../../middleware/validate.middleware");
const { authMiddleware } = require("../../middleware/auth.middleware");
const { restrictTo } = require("../../middleware/rbac.middleware");
const { chatWriteLimiter, uploadLimiter } = require("../../middleware/rateLimit.middleware");
const { BadRequestError } = require("../../shared/errors");
const schema = require("./chat.schema");

function chatRoutes(controller) {
  const router = Router();
  const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (
        ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(
          file.mimetype,
        )
      ) {
        return cb(null, true);
      }
      return cb(new BadRequestError("Chat image must be PNG, JPG, JPEG, or WEBP."));
    },
  }).single("image");

  const handleImageUpload = (req, res, next) => {
    imageUpload(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        return next(
          new BadRequestError(
            err.code === "LIMIT_FILE_SIZE"
              ? "Chat image must be 8MB or smaller."
              : err.message,
          ),
        );
      }
      return next(err);
    });
  };

  router.use(authMiddleware, restrictTo("admin", "coach", "player", "parent"));

  router.get("/contacts", controller.listContacts);
  router.get("/conversations", controller.listConversations);
  router.post(
    "/conversations",
    validate({ body: schema.createConversationSchema }),
    controller.createConversation,
  );
  router.get(
    "/conversations/:id/messages",
    validate({ params: schema.idParam, query: schema.messagesQuery }),
    controller.getMessages,
  );
  router.patch(
    "/conversations/:id/read",
    chatWriteLimiter,
    validate({ params: schema.idParam }),
    controller.markConversationRead,
  );
  router.post(
    "/conversations/:id/messages",
    chatWriteLimiter,
    uploadLimiter,
    handleImageUpload,
    validate({ params: schema.idParam, body: schema.messageBodySchema }),
    controller.sendMessage,
  );
  router.patch(
    "/conversations/:id/messages/:messageId",
    validate({
      params: schema.messageParam,
      body: schema.editMessageSchema,
    }),
    controller.editMessage,
  );
  router.delete(
    "/conversations/:id/messages/:messageId",
    validate({ params: schema.messageParam, query: schema.deleteMessageQuery }),
    controller.deleteMessage,
  );
  router.patch(
    "/conversations/:id/close",
    validate({ params: schema.idParam }),
    controller.closeConversation,
  );

  return router;
}

module.exports = chatRoutes;
