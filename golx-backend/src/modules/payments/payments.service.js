const eventBus = require('../../events/eventBus');
const PAYMENTS_EVENTS = require('./payments.events');
const { NotFoundError } = require('../../shared/errors');

class PaymentsService {
    constructor(paymentsRepository, paymentsQueue) {
        this.repo = paymentsRepository;
        this.queue = paymentsQueue;
    }

    // ─── Plans ──────────────────────────────────────────────────────────
    async getPlans(academyId, pagination) {
        return this.repo.findPlans(academyId, pagination);
    }

    async createPlan(academyId, data) {
        return this.repo.createPlan({
            academy_id: academyId,
            name: data.name,
            description: data.description,
            price: data.price,
            billing_cycle: data.billingCycle,
            features: data.features ? JSON.stringify(data.features) : '[]',
        });
    }

    // ─── Subscriptions ──────────────────────────────────────────────────
    async getSubscriptions(filters) {
        return this.repo.findSubscriptions(filters);
    }

    async getSubscription(id, academyId) {
        const sub = await this.repo.findSubscriptionByIdAndAcademy(id, academyId);
        if (!sub) throw new NotFoundError('Subscription', id);
        return sub;
    }

    async createSubscription(data, academyId) {
        // Verify the player belongs to this academy to prevent cross-tenant subscriptions
        const playerCheck = await this.repo.db('player_profiles')
            .where({ id: data.playerId, academy_id: academyId })
            .whereNull('deleted_at')
            .first();
        if (!playerCheck) throw new NotFoundError('Player', data.playerId);

        // Calculate expiry based on plan billing cycle
        const expiresAt = this._calculateExpiry(data.startedAt, 'monthly'); // TODO: get cycle from plan

        const sub = await this.repo.createSubscription({
            player_id: data.playerId,
            plan_id: data.planId,
            status: 'pending',
            started_at: data.startedAt,
            expires_at: expiresAt,
            auto_renew: data.autoRenew,
        });

        eventBus.publish(PAYMENTS_EVENTS.SUBSCRIPTION_CREATED, {
            subscriptionId: sub.id,
            playerId: data.playerId,
            planId: data.planId,
        });

        // Queue invoice generation
        await this.queue.add('generate-invoice', { subscriptionId: sub.id });

        return sub;
    }

    async updateSubscription(id, academyId, data) {
        const sub = await this.repo.findSubscriptionByIdAndAcademy(id, academyId);
        if (!sub) throw new NotFoundError('Subscription', id);

        const updateData = {};
        if (data.status) updateData.status = data.status;
        if (data.autoRenew !== undefined) updateData.auto_renew = data.autoRenew;

        if (data.status === 'cancelled') {
            updateData.cancelled_at = new Date();
            eventBus.publish(PAYMENTS_EVENTS.SUBSCRIPTION_CANCELLED, { subscriptionId: id });
        }

        return this.repo.updateSubscription(id, updateData);
    }

    // ─── Payments ───────────────────────────────────────────────────────
    async getPayments(filters) {
        // academyId is required — callers must always provide it from req.user
        return this.repo.findPayments(filters);
    }

    async getPayment(id, academyId) {
        const payment = await this.repo.findPaymentByIdAndAcademy(id, academyId);
        if (!payment) throw new NotFoundError('Payment', id);
        return payment;
    }

    async processPayment(data, academyId) {
        // Verify subscription belongs to this academy before charging
        const sub = await this.repo.findSubscriptionByIdAndAcademy(data.subscriptionId, academyId);
        if (!sub) throw new NotFoundError('Subscription', data.subscriptionId);

        const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

        const payment = await this.repo.createPayment({
            subscription_id: data.subscriptionId,
            amount: data.amount,
            status: 'pending',
            payment_method: data.paymentMethod || null,
            invoice_number: invoiceNumber,
            due_at: data.dueAt || null,
        });

        return payment;
    }

    async markPaymentPaid(paymentId) {
        const payment = await this.repo.updatePaymentStatus(paymentId, 'paid', new Date());

        if (payment) {
            // Activate subscription
            await this.repo.updateSubscription(payment.subscription_id, { status: 'active' });

            eventBus.publish(PAYMENTS_EVENTS.PAYMENT_COMPLETED, {
                paymentId: payment.id,
                subscriptionId: payment.subscription_id,
                amount: payment.amount,
            });
        }

        return payment;
    }

    // ─── Reports ────────────────────────────────────────────────────────
    async getPaymentOverview(academyId) {
        return this.repo.getPaymentOverview(academyId);
    }

    // ─── Helpers ────────────────────────────────────────────────────────
    _calculateExpiry(startDate, cycle) {
        const date = new Date(startDate);
        switch (cycle) {
            case 'monthly': date.setMonth(date.getMonth() + 1); break;
            case 'quarterly': date.setMonth(date.getMonth() + 3); break;
            case 'yearly': date.setFullYear(date.getFullYear() + 1); break;
            default: date.setMonth(date.getMonth() + 1);
        }
        return date.toISOString().split('T')[0];
    }
}

module.exports = PaymentsService;
