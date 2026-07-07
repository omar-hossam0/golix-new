const BaseRepository = require('../../shared/base.repository');

class PaymentsRepository extends BaseRepository {
    constructor(db) {
        super('payment_subscriptions', db, { hasSoftDelete: false });
    }

    // ─── Subscriptions ──────────────────────────────────────────────────
    async findSubscriptions({ academyId, playerId, status, page = 1, limit = 20 }) {
        const query = this.db('payment_subscriptions')
            .modify((q) => {
                if (playerId) q.where('player_id', playerId);
                if (status) q.where('status', status);
                if (academyId) {
                    q.whereIn('player_id',
                        this.db('player_profiles').where('academy_id', academyId).select('id'));
                }
            })
            .select('*');

        const [{ count }] = await query.clone().clearSelect().count('id as count');
        const data = await query
            .orderBy('created_at', 'desc')
            .limit(limit)
            .offset((page - 1) * limit);

        return { data, total: +count, page, totalPages: Math.ceil(+count / limit) || 1 };
    }

    async findSubscriptionById(id) {
        return this.db('payment_subscriptions').where({ id }).first();
    }

    // Academy-scoped getter — prevents IDOR across tenants
    async findSubscriptionByIdAndAcademy(id, academyId) {
        return this.db('payment_subscriptions as ps')
            .join('player_profiles as pp', 'ps.player_id', 'pp.id')
            .where('ps.id', id)
            .where('pp.academy_id', academyId)
            .select('ps.*')
            .first();
    }

    async createSubscription(data) {
        const [row] = await this.db('payment_subscriptions').insert(data).returning('*');
        return row;
    }

    async updateSubscription(id, data) {
        const [row] = await this.db('payment_subscriptions')
            .where({ id }).update({ ...data, updated_at: new Date() }).returning('*');
        return row;
    }

    // ─── Invoices ────────────────────────────────────────────────────────
    async findPayments({ academyId, subscriptionId, status, dateFrom, dateTo, page = 1, limit = 20 }) {
        // Always JOIN through subscriptions→player_profiles to scope by academy
        const query = this.db('payment_invoices as pi')
            .join('payment_subscriptions as ps', 'pi.subscription_id', 'ps.id')
            .join('player_profiles as pp', 'ps.player_id', 'pp.id')
            .modify((q) => {
                if (academyId) q.where('pp.academy_id', academyId);
                if (subscriptionId) q.where('pi.subscription_id', subscriptionId);
                if (status) q.where('pi.status', status);
                if (dateFrom) q.where('pi.due_at', '>=', dateFrom);
                if (dateTo) q.where('pi.due_at', '<=', dateTo);
            })
            .select('pi.*');

        const [{ count }] = await query.clone().clearSelect().count('pi.id as count');
        const data = await query
            .orderBy('due_date', 'desc')
            .limit(limit)
            .offset((page - 1) * limit);

        return { data, total: +count, page, totalPages: Math.ceil(+count / limit) || 1 };
    }

    async findPaymentById(id) {
        return this.db('payment_invoices').where({ id }).first();
    }

    // Academy-scoped getter — prevents IDOR across tenants
    async findPaymentByIdAndAcademy(id, academyId) {
        return this.db('payment_invoices as pi')
            .join('payment_subscriptions as ps', 'pi.subscription_id', 'ps.id')
            .join('player_profiles as pp', 'ps.player_id', 'pp.id')
            .where('pi.id', id)
            .where('pp.academy_id', academyId)
            .select('pi.*')
            .first();
    }

    async createPayment(data) {
        const [row] = await this.db('payment_invoices').insert(data).returning('*');
        return row;
    }

    async updatePaymentStatus(id, status, paidAt) {
        const [row] = await this.db('payment_invoices')
            .where({ id })
            .update({ status, paid_at: paidAt || null })
            .returning('*');
        return row;
    }

    // ─── Reports ────────────────────────────────────────────────────────
    async getPaymentOverview(academyId) {
        return this.db('payment_invoices')
            .join('payment_subscriptions', 'payment_invoices.subscription_id', 'payment_subscriptions.id')
            .whereIn('payment_subscriptions.player_id',
                this.db('player_profiles').where('academy_id', academyId).select('id'))
            .select('payment_invoices.status')
            .sum('payment_invoices.amount as total_amount')
            .count('payment_invoices.id as count')
            .groupBy('payment_invoices.status');
    }

    async getExpiringSubscriptions(daysAhead = 7) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + daysAhead);
        return this.db('payment_subscriptions')
            .where('status', 'active')
            .where('ends_at', '<=', cutoff)
            .select('*');
    }
}

module.exports = PaymentsRepository;
