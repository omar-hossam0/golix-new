const { z } = require('zod');

const uuidParam = z.object({ id: z.string().uuid() });

const rankingsQuery = z.object({
    groupId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});

const createEvaluationSchema = z.object({
    playerId: z.string().uuid(),
    sessionId: z.string().uuid().optional(),
    technicalScore: z.number().min(0).max(10).optional(),
    physicalScore: z.number().min(0).max(10).optional(),
    tacticalScore: z.number().min(0).max(10).optional(),
    disciplineScore: z.number().min(0).max(10).optional(),
    notes: z.string().max(2000).optional(),
});

const createMatchSchema = z.object({
    groupId: z.string().uuid(),
    sessionId: z.string().uuid().optional(),
    opponentName: z.string().max(100),
    matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    location: z.string().max(100).optional(),
    ourScore: z.number().int().min(0).default(0),
    opponentScore: z.number().int().min(0).default(0),
    notes: z.string().max(2000).optional(),
});

const playerMatchStatsSchema = z.object({
    matchId: z.string().uuid(),
    playerId: z.string().uuid(),
    playedMinutes: z.number().int().min(0).max(120).default(0),
    goals: z.number().int().min(0).default(0),
    assists: z.number().int().min(0).default(0),
    yellowCards: z.number().int().min(0).max(2).default(0),
    redCards: z.number().int().min(0).max(1).default(0),
    performanceRating: z.number().min(1).max(10).optional(),
});

const recalculateSchema = z.object({
    groupId: z.string().uuid(),
    periodType: z.enum(['weekly', 'monthly']),
});

module.exports = {
    uuidParam,
    rankingsQuery,
    createEvaluationSchema,
    createMatchSchema,
    playerMatchStatsSchema,
    recalculateSchema,
};
