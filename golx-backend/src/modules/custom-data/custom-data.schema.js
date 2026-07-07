const { z } = require('zod');

const uuid = z.string().uuid();
const idParam = z.object({ id: uuid });
const categoryParam = z.object({ categoryId: uuid });
const fieldParam = z.object({ fieldId: uuid });
const optionParam = z.object({ optionId: uuid });
const playerParam = z.object({ playerId: uuid });

const targetModuleSchema = z.enum(['player_profile', 'training', 'match', 'injury', 'payment', 'evaluation']);
const visibilitySchema = z.enum(['global', 'specific_coach', 'coach_only', 'shared']);
const fieldTypeSchema = z.enum([
    'text',
    'long_text',
    'number',
    'decimal',
    'date',
    'time',
    'boolean',
    'single_select',
    'multi_select',
    'rating',
    'percentage',
    'file',
    'image',
    'url',
    'phone',
    'email',
]);

const fieldKeyPattern = /^[\p{L}][\p{L}\p{N}_]*$/u;

const normalizeKeyInput = (value) => {
    if (value === null || value === undefined) return value;
    const raw = String(value).trim();
    if (!raw) return raw;
    const normalized = raw
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_]+/gu, '_')
        .replace(/^_+|_+$/g, '');
    if (!normalized) return raw;
    const startsWithLetter = /^\p{L}/u.test(normalized);
    const safe = startsWithLetter ? normalized : `field_${normalized}`;
    return safe.slice(0, 160);
};

const fieldKeySchema = z.preprocess(
    normalizeKeyInput,
    z.string().trim().min(1).max(160).regex(fieldKeyPattern, 'Use a stable key like main_position'),
);

const listQuery = z.object({
    targetModule: targetModuleSchema.default('player_profile'),
    includeInactive: z.coerce.boolean().optional(),
});

const categorySchema = z.object({
    name: z.string().trim().min(2).max(160),
    description: z.string().max(3000).optional(),
    targetModule: targetModuleSchema.default('player_profile'),
    assignedCoachId: uuid.optional(),
    visibility: visibilitySchema.optional(),
    isEditableByCoach: z.boolean().optional(),
    isSystemDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
});

const updateCategorySchema = categorySchema.partial();

const fieldSchema = z.object({
    label: z.string().trim().min(1).max(160),
    key: fieldKeySchema,
    fieldType: fieldTypeSchema,
    isRequired: z.boolean().optional(),
    placeholder: z.string().max(255).optional(),
    defaultValue: z.string().max(3000).optional(),
    unit: z.string().max(40).optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    validationRules: z.record(z.any()).optional(),
    isEditableByCoach: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
});

const updateFieldSchema = fieldSchema.partial();

const optionSchema = z.object({
    label: z.string().trim().min(1).max(160),
    value: z.string().trim().min(1).max(160).optional(),
    isEditableByCoach: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
});

const updateOptionSchema = optionSchema.partial();

const customValueSchema = z.object({
    fieldId: uuid,
    value: z.any(),
});

const valuesSchema = z.object({
    values: z.array(customValueSchema).max(300).default([]),
    markProfileComplete: z.boolean().optional(),
});

const playerFilterQuery = z.object({
    fieldId: uuid.optional(),
    value: z.string().optional(),
    optionId: uuid.optional(),
});

module.exports = {
    idParam,
    categoryParam,
    fieldParam,
    optionParam,
    playerParam,
    listQuery,
    categorySchema,
    updateCategorySchema,
    fieldSchema,
    updateFieldSchema,
    optionSchema,
    updateOptionSchema,
    valuesSchema,
    playerFilterQuery,
};
