const { z } = require('zod');

const usernameSchema = z.string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(80)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dots, underscores, and hyphens');

const registerSchema = z.object({
    username: usernameSchema,
    email: z.string().trim().email('Valid email is required').max(255).optional(),
    phone: z.string().min(8).max(20).optional(),
    // Minimum 8 chars + at least one uppercase + one digit + one special character
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128)
        .refine((p) => /[A-Z]/.test(p), { message: 'Password must contain at least one uppercase letter' })
        .refine((p) => /[0-9]/.test(p), { message: 'Password must contain at least one digit' })
        .refine((p) => /[^A-Za-z0-9]/.test(p), { message: 'Password must contain at least one special character' }),
    // Admins are seeded or promoted by an existing admin — never self-registerable
    role: z.enum(['coach', 'player', 'parent']),
    academyId: z.string().uuid().optional(),
    fullName: z.string().min(2).max(100).optional(),
}).refine((data) => data.role !== 'coach' || !!data.email, {
    message: 'Email is required for coach accounts',
    path: ['email'],
});

const loginSchema = z.object({
    username: usernameSchema.optional(),
    email: z.string().email().max(255).optional(),
    password: z.string().min(1, 'Password is required'),
    role: z.enum(['coach', 'player', 'parent']).optional(),
}).refine((data) => data.username || data.email, {
    message: 'Username or email is required',
});

const refreshSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required').optional(),
});

const forgotPasswordSchema = z.object({
    email: z.string().email('Invalid email format').optional(),
    username: usernameSchema.optional(),
}).refine((data) => data.email || data.username, {
    message: 'Email or username is required',
    path: ['email'],
});

const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Reset token is required'),
    // Same complexity rules as registration — prevents policy bypass via reset flow
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128)
        .refine((p) => /[A-Z]/.test(p), { message: 'Password must contain at least one uppercase letter' })
        .refine((p) => /[0-9]/.test(p), { message: 'Password must contain at least one digit' })
        .refine((p) => /[^A-Za-z0-9]/.test(p), { message: 'Password must contain at least one special character' }),
});

const verify2FASchema = z.object({
    tempToken: z.string().min(1, 'Temp token is required'),
    token: z.string().length(6, 'TOTP code must be 6 digits').regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});

const verifySetup2FASchema = z.object({
    token: z.string().length(6, 'TOTP code must be 6 digits').regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});

const setup2FADeviceSchema = z.object({
    deviceName: z.string().trim().min(2).max(120).optional(),
});

const verify2FADeviceSchema = z.object({
    deviceId: z.string().uuid('Invalid device ID'),
    token: z.string().length(6, 'TOTP code must be 6 digits').regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});

const totpDeviceParamSchema = z.object({
    id: z.string().uuid('Invalid device ID'),
});

const backupCodeSchema = z.object({
    tempToken: z.string().min(1, 'Temp token is required'),
    code: z.string().min(1, 'Backup code is required'),
});

const disable2FASchema = z.object({
    password: z.string().min(1, 'Password is required'),
});

const regenerateBackupCodesSchema = z.object({
    password: z.string().min(1, 'Password is required'),
});

// Signup schema — player or parent only (admins/coaches created by admin directly)
const signupSchema = z.object({
    email: z.string().email('Invalid email format').max(255).optional(),
    phone: z.string().min(8).max(20).optional(),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128)
        .refine((p) => /[A-Z]/.test(p), { message: 'Password must contain at least one uppercase letter' })
        .refine((p) => /[0-9]/.test(p), { message: 'Password must contain at least one digit' })
        .refine((p) => /[^A-Za-z0-9]/.test(p), { message: 'Password must contain at least one special character' }),
    role: z.enum(['player', 'parent'], { errorMap: () => ({ message: 'Role must be player or parent' }) }),
    fullName: z.string().min(2, 'Full name is required').max(100),
    linkedPlayerId: z.string().uuid('Invalid player ID format').optional(),
    academyId: z.string().uuid().optional(),
}).refine((data) => data.email || data.phone, {
    message: 'Either email or phone is required',
}).refine((data) => data.role !== 'parent' || !!data.linkedPlayerId, {
    message: 'Player ID is required for parent accounts',
    path: ['linkedPlayerId'],
});

const registrationStatusSchema = z.object({
    email: z.string().email('Invalid email format'),
});

module.exports = {
    registerSchema,
    loginSchema,
    refreshSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    verify2FASchema,
    verifySetup2FASchema,
    setup2FADeviceSchema,
    verify2FADeviceSchema,
    totpDeviceParamSchema,
    backupCodeSchema,
    disable2FASchema,
    regenerateBackupCodesSchema,
    signupSchema,
    registrationStatusSchema,
};
