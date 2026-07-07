const PAYMENTS_EVENTS = {
    SUBSCRIPTION_CREATED: 'payments.subscription.created',   // { subscriptionId, playerId, planId }
    SUBSCRIPTION_RENEWED: 'payments.subscription.renewed',   // { subscriptionId }
    SUBSCRIPTION_EXPIRED: 'payments.subscription.expired',   // { subscriptionId, playerId }
    SUBSCRIPTION_CANCELLED: 'payments.subscription.cancelled', // { subscriptionId }
    PAYMENT_COMPLETED: 'payments.payment.completed',      // { paymentId, subscriptionId, amount }
    PAYMENT_FAILED: 'payments.payment.failed',         // { paymentId, subscriptionId }
    INVOICE_GENERATED: 'payments.invoice.generated',      // { invoiceId, subscriptionId }
    REMINDER_SENT: 'payments.reminder.sent',          // { subscriptionId, dueDate }
};

module.exports = PAYMENTS_EVENTS;
