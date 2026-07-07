const { z } = require("zod");

const uuid = z.string().uuid();

const createConversationSchema = z
  .object({
    type: z.enum([
      "admin_coach",
      "coach_player",
      "admin_player_session",
      "parent_coach",
      "chat_group",
    ]),
    adminUserId: uuid.optional(),
    coachId: uuid.optional(),
    parentUserId: uuid.optional(),
    playerId: uuid.optional(),
    groupName: z.string().trim().min(2).max(120).optional(),
    memberUserIds: z.array(uuid).max(80).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.type === "admin_coach" && !data.coachId && !data.adminUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["coachId"],
        message: "coachId or adminUserId is required for admin-coach chat",
      });
    }
    if (data.type === "coach_player" && !data.playerId && !data.coachId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["playerId"],
        message: "playerId or coachId is required for coach-player chat",
      });
    }
    if (data.type === "admin_player_session" && !data.playerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["playerId"],
        message: "playerId is required for player chat",
      });
    }
    if (data.type === "parent_coach") {
      if (!data.playerId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["playerId"],
          message: "playerId is required for parent-coach chat",
        });
      }
      if (!data.coachId && !data.parentUserId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["coachId"],
          message: "coachId or parentUserId is required for parent-coach chat",
        });
      }
    }
    if (data.type === "chat_group") {
      if (!data.groupName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["groupName"],
          message: "Group name is required",
        });
      }
      if (!data.memberUserIds?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["memberUserIds"],
          message: "Choose at least one group member",
        });
      }
    }
  });

const idParam = z.object({
  id: uuid,
});

const messageParam = z.object({
  id: uuid,
  messageId: uuid,
});

const messagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
  includeArchive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

const messageBodySchema = z.object({
  body: z.string().trim().max(4000).optional().default(""),
  clientMessageId: z.string().trim().min(1).max(120).optional(),
});

const editMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

const deleteMessageQuery = z.object({
  scope: z.enum(["me", "everyone"]).default("everyone"),
});

module.exports = {
  createConversationSchema,
  deleteMessageQuery,
  editMessageSchema,
  idParam,
  messageParam,
  messageBodySchema,
  messagesQuery,
};
