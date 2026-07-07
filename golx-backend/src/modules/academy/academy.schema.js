const { z } = require('zod');

const uuidParam = z.object({ id: z.string().uuid() });

const createAcademySchema = z.object({
    name: z.string().min(2).max(100),
    logoUrl: z.string().url()
        .refine((u) => u.startsWith('https://') || u.startsWith('http://'), {
            message: 'Logo URL must use HTTP or HTTPS',
        }).nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    phone: z.string().max(20).nullable().optional(),
    email: z.string().email().max(255).nullable().optional(),
    settings: z.record(z.unknown()).optional(),
});

const updateAcademySchema = createAcademySchema.partial();

const createBranchSchema = z.object({
    name: z.string().min(2).max(100),
    address: z.string().max(500).optional(),
    city: z.string().max(100).optional(),
    capacity: z.number().int().positive().optional(),
    isActive: z.boolean().optional(),
});

const updateBranchSchema = createBranchSchema.partial();

const labelSchema = z.string().trim().min(1).max(100);
const playerCodeSchema = z.string().trim().min(1).max(80);

const createGroupSchema = z.object({
    branchId: z.string().uuid(),
    assignmentMode: z.enum(['birth_year', 'players']).default('birth_year'),
    birthYearIds: z.array(z.string().uuid()).min(1).max(20).optional(),
    birthYearId: z.string().uuid().optional(),
    playerIds: z.array(z.string().uuid()).min(1).max(200).optional(),
    playerCodeFrom: playerCodeSchema.optional(),
    playerCodeTo: playerCodeSchema.optional(),
    labels: z.array(labelSchema).min(1).max(20).optional(),
    name: z.string().min(1).max(50),
    description: z.string().trim().max(1000).optional(),
    maxPlayers: z.number().int().positive().max(100).default(25),
}).superRefine((data, ctx) => {
    if (data.assignmentMode === 'players') {
        const hasPlayerRange = Boolean(data.playerCodeFrom && data.playerCodeTo);
        if (!data.playerIds?.length && !hasPlayerRange) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['playerIds'], message: 'Select players or enter a player ID range' });
        }
        if ((data.playerCodeFrom && !data.playerCodeTo) || (!data.playerCodeFrom && data.playerCodeTo)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['playerCodeFrom'], message: 'Both start and end player IDs are required for a range' });
        }
        return;
    }
    if (!data.birthYearIds?.length && !data.birthYearId && !data.labels?.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['birthYearIds'], message: 'At least one birth year is required' });
    }
});

const updateGroupSchema = z.object({
    name: z.string().min(1).max(50).optional(),
    description: z.string().trim().max(1000).optional(),
    maxPlayers: z.number().int().positive().max(100).optional(),
    isActive: z.boolean().optional(),
    assignmentMode: z.enum(['birth_year', 'players']).optional(),
    birthYearIds: z.array(z.string().uuid()).min(1).max(20).optional(),
    birthYearId: z.string().uuid().optional(),
    playerIds: z.array(z.string().uuid()).min(1).max(200).optional(),
    playerCodeFrom: playerCodeSchema.optional(),
    playerCodeTo: playerCodeSchema.optional(),
    labels: z.array(labelSchema).min(1).max(20).optional(),
}).superRefine((data, ctx) => {
    if ((data.playerCodeFrom && !data.playerCodeTo) || (!data.playerCodeFrom && data.playerCodeTo)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['playerCodeFrom'], message: 'Both start and end player IDs are required for a range' });
    }
});

const createBirthYearSchema = z.object({
    branchId: z.string().uuid(),
    label: labelSchema.optional(),
    fromYear: z.number().int().min(2000).max(2030),
    toYear: z.number().int().min(2000).max(2030),
}).refine((data) => data.fromYear <= data.toYear, {
    message: 'fromYear must be less than or equal to toYear',
    path: ['toYear'],
});

const updateBirthYearSchema = z.object({
    label: labelSchema.optional(),
    fromYear: z.number().int().min(2000).max(2030).optional(),
    toYear: z.number().int().min(2000).max(2030).optional(),
}).refine((data) => {
    if (data.fromYear === undefined || data.toYear === undefined) return true;
    return data.fromYear <= data.toYear;
}, {
    message: 'fromYear must be less than or equal to toYear',
    path: ['toYear'],
});

const deleteBirthYearSchema = z.object({
    transferBirthYearId: z.string().uuid().optional(),
}).optional().default({});

const groupsQuerySchema = z.object({
    branchId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});

const birthYearsQuerySchema = z.object({
    branchId: z.string().uuid(),
});

const createScheduleSchema = z.object({
    groupId: z.string().uuid(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time format must be HH:MM'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time format must be HH:MM'),
    location: z.string().max(100).optional(),
});

module.exports = {
    uuidParam,
    createAcademySchema,
    updateAcademySchema,
    createBranchSchema,
    updateBranchSchema,
    createGroupSchema,
    updateGroupSchema,
    createBirthYearSchema,
    updateBirthYearSchema,
    deleteBirthYearSchema,
    groupsQuerySchema,
    birthYearsQuerySchema,
    createScheduleSchema,
};
