const { Router } = require('express');
const validate = require('../../middleware/validate.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { rbac } = require('../../middleware/rbac.middleware');
const {
    uuidParam,
    createPlanSchema,
    createSubscriptionSchema,
    updateSubscriptionSchema,
    createPaymentSchema,
    subscriptionsListQuery,
    invoicesListQuery,
} = require('./payments.schema');

function paymentsRoutes(controller) {
    const router = Router();
    router.use(authMiddleware);

    // Overview / Reports
    router.get('/overview', rbac('payments:read'), controller.getOverview);
    router.get('/reports', rbac('payments:read'), controller.getOverview);

    // Plans
    router.get('/plans', rbac('payments:read'), controller.getPlans);
    router.post('/plans', rbac('manage_subscriptions'), validate({ body: createPlanSchema }), controller.createPlan);

    // Subscriptions
    router.get('/subscriptions', rbac('payments:read'), validate({ query: subscriptionsListQuery }), controller.getSubscriptions);
    router.post('/subscriptions', rbac('manage_subscriptions'), validate({ body: createSubscriptionSchema }), controller.createSubscription);
    router.get('/subscriptions/:id', rbac('payments:read'), validate({ params: uuidParam }), controller.getSubscription);
    router.put('/subscriptions/:id', rbac('manage_subscriptions'), validate({ params: uuidParam, body: updateSubscriptionSchema }), controller.updateSubscription);

    // Invoices / Payments
    router.get('/invoices', rbac('payments:read'), validate({ query: invoicesListQuery }), controller.getPayments);
    router.get('/invoices/:id', rbac('payments:read'), validate({ params: uuidParam }), controller.getPayment);
    router.post('/pay', rbac('payments:read'), validate({ body: createPaymentSchema }), controller.pay);

    return router;
}

module.exports = paymentsRoutes;
