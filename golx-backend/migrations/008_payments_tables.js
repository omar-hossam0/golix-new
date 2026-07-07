/**
 * Payments module tables:
 *   payment_subscriptions, payment_invoices, payment_transactions
 */
exports.up = async function (knex) {
    // ─── subscriptions ────────────────────────────────────────────────
    await knex.schema.createTable('payment_subscriptions', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.uuid('group_id').references('id').inTable('academy_groups').onDelete('SET NULL');
        t.enum('plan', ['monthly', 'quarterly', 'yearly'], {
            useNative: true,
            enumName: 'subscription_plan',
        }).notNullable().defaultTo('monthly');
        t.decimal('amount', 10, 2).notNullable();
        t.string('currency', 3).defaultTo('EGP');
        t.date('starts_at').notNullable();
        t.date('ends_at').notNullable();
        t.enum('status', ['active', 'expired', 'cancelled', 'pending'], {
            useNative: true,
            enumName: 'subscription_status',
        }).defaultTo('pending');
        t.timestamps(true, true);
        t.index('player_id');
        t.index('status');
    });

    // ─── invoices ─────────────────────────────────────────────────────
    await knex.schema.createTable('payment_invoices', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('subscription_id').notNullable().references('id').inTable('payment_subscriptions').onDelete('CASCADE');
        t.decimal('amount', 10, 2).notNullable();
        t.date('due_date').notNullable();
        t.timestamp('paid_at');
        t.enum('status', ['pending', 'paid', 'overdue', 'cancelled'], {
            useNative: true,
            enumName: 'invoice_status',
        }).defaultTo('pending');
        t.timestamps(true, true);
        t.index('subscription_id');
        t.index('status');
    });

    // ─── transactions ─────────────────────────────────────────────────
    await knex.schema.createTable('payment_transactions', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('invoice_id').notNullable().references('id').inTable('payment_invoices').onDelete('CASCADE');
        t.string('gateway', 50);
        t.string('gateway_ref', 255).unique();
        t.decimal('amount', 10, 2).notNullable();
        t.enum('status', ['success', 'failed', 'pending', 'refunded'], {
            useNative: true,
            enumName: 'transaction_status',
        }).defaultTo('pending');
        t.timestamps(true, true);
        t.index('invoice_id');
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('payment_transactions');
    await knex.schema.dropTableIfExists('payment_invoices');
    await knex.schema.dropTableIfExists('payment_subscriptions');
    await knex.raw('DROP TYPE IF EXISTS subscription_plan');
    await knex.raw('DROP TYPE IF EXISTS subscription_status');
    await knex.raw('DROP TYPE IF EXISTS invoice_status');
    await knex.raw('DROP TYPE IF EXISTS transaction_status');
};
