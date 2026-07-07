const { z } = require('zod');

const uuidParam = z.object({ id: z.string().uuid() });

const createPlanSchema = z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(1000).optional(),
    price: z.number().min(0),
    billingCycle: z.enum(['monthly', 'quarterly', 'yearly']),
    features: z.array(z.string()).optional(),
});

const updatePlanSchema = createPlanSchema.partial();

const createSubscriptionSchema = z.object({
    playerId: z.string().uuid(),
    planId: z.string().uuid(),
    startedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    autoRenew: z.boolean().default(true),
});

const updateSubscriptionSchema = z.object({
    status: z.enum(['active', 'expired', 'cancelled', 'pending']).optional(),
    autoRenew: z.boolean().optional(),
});

const createPaymentSchema = z.object({
    subscriptionId: z.string().uuid(),
    amount: z.number().positive(),
    paymentMethod: z.string().max(30).optional(),
    dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const paymentOverviewQuery = z.object({
    status: z.enum(['paid', 'pending', 'failed', 'refunded']).optional(),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});

// Whitelist-validated query for GET /subscriptions — prevents academyId override via query string
const subscriptionsListQuery = z.object({
    playerId: z.string().uuid().optional(),
    status: z.enum(['active', 'expired', 'cancelled', 'pending']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});

// Whitelist-validated query for GET /invoices
const invoicesListQuery = z.object({
    status: z.enum(['paid', 'pending', 'failed', 'refunded']).optional(),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});

module.exports = {
    uuidParam,
    createPlanSchema,
    updatePlanSchema,
    createSubscriptionSchema,
    updateSubscriptionSchema,
    createPaymentSchema,
    paymentOverviewQuery,
    subscriptionsListQuery,
    invoicesListQuery,
};
