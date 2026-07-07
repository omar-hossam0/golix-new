const { z } = require('zod');

const uuidParam = z.object({ id: z.string().uuid() });
const roleUserParam = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
});

const roleBodySchema = z.object({
    name: z.string().trim().min(2).max(120),
    code: z.string()
        .trim()
        .min(2)
        .max(60)
        .regex(/^[a-z][a-z0-9_]*$/, 'Role code must start with a letter and use lowercase letters, numbers, or underscores'),
    description: z.string().trim().max(1000).optional().nullable(),
    isActive: z.boolean().optional(),
    permissionIds: z.array(z.string().uuid()).max(300).default([]),
});

const roleUpdateSchema = roleBodySchema.partial().extend({
    permissionIds: z.array(z.string().uuid()).max(300).optional(),
});

const usernameSchema = z.string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(60)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dots, underscores, and hyphens');

const passwordSchema = z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .refine((p) => /[A-Z]/.test(p), { message: 'Password must contain at least one uppercase letter' })
    .refine((p) => /[0-9]/.test(p), { message: 'Password must contain at least one digit' })
    .refine((p) => /[^A-Za-z0-9]/.test(p), { message: 'Password must contain at least one special character' });

const optionalText = (max) => z.preprocess(
    (value) => (value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value),
    z.string().trim().max(max).optional(),
);

const optionalUuid = z.preprocess(
    (value) => (value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value),
    z.string().uuid().optional(),
);

const createAccessUserSchema = z.object({
    fullName: z.string().trim().min(2).max(160),
    accountRole: z.literal('admin'),
    email: z.preprocess(
        (value) => (value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value),
        z.string().trim().email().max(255).optional(),
    ),
    phone: z.string().trim().min(8).max(20),
    username: usernameSchema,
    password: passwordSchema,
    address: optionalText(300),
    jobTitle: optionalText(120),
    department: optionalText(120),
    notes: optionalText(1000),
    roleId: optionalUuid,
});

const reportsOverviewQuery = z.object({
    branchId: z.string().uuid().optional(),
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
}).refine(
    ({ dateFrom, dateTo }) => !dateFrom || !dateTo || dateFrom <= dateTo,
    {
        message: 'dateFrom must be before or equal to dateTo',
        path: ['dateFrom'],
    },
);

const restoreBackupSchema = z.object({
    fileName: z.string().trim().min(1).max(255),
    password: z.string().min(1).max(128),
    confirmation: z.string().trim().min(1).max(80),
});

module.exports = {
    uuidParam,
    roleUserParam,
    roleBodySchema,
    roleUpdateSchema,
    createAccessUserSchema,
    reportsOverviewQuery,
    restoreBackupSchema,
};
