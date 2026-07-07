const { z } = require('zod');

const uuidParam = z.object({ id: z.string().uuid() });

const archiveQuery = z.object({
    includeArchive: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => value === 'true'),
});

const performanceScoreQuery = z.object({
    playerId: z.string().uuid(),
});

const injuryRiskSchema = z.object({
    playerId: z.string().uuid(),
});

const nutritionPlanSchema = z.object({
    playerId: z.string().uuid(),
    goals: z.array(z.string()).optional(),
    restrictions: z.array(z.string()).optional(),
});

const chatSchema = z.object({
    prompt: z.string().min(1).max(2000),
    context: z.string().max(1000).optional(),
});

module.exports = {
    uuidParam,
    archiveQuery,
    performanceScoreQuery,
    injuryRiskSchema,
    nutritionPlanSchema,
    chatSchema,
};
