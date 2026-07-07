exports.up = async function up(knex) {
    const exists = await knex.schema.hasTable('notification_logs');
    if (exists) return;

    await knex.schema.createTable('notification_logs', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('notification_id')
            .references('id')
            .inTable('notification_inbox')
            .onDelete('SET NULL');
        t.uuid('academy_id')
            .references('id')
            .inTable('academy_academies')
            .onDelete('SET NULL');
        t.uuid('user_id')
            .references('id')
            .inTable('auth_users')
            .onDelete('SET NULL');
        t.string('channel', 20).notNullable().defaultTo('in_app');
        t.string('status', 20).notNullable().defaultTo('sent');
        t.text('provider_message_id');
        t.text('error_message');
        t.jsonb('metadata').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
        t.timestamp('sent_at');
        t.timestamp('delivered_at');
        t.timestamp('failed_at');
        t.timestamps(true, true);

        t.index(['academy_id', 'created_at'], 'notification_logs_academy_created_idx');
        t.index(['academy_id', 'status', 'created_at'], 'notification_logs_academy_status_created_idx');
        t.index(['notification_id'], 'notification_logs_notification_idx');
        t.index(['user_id', 'created_at'], 'notification_logs_user_created_idx');
        t.index(['channel', 'status'], 'notification_logs_channel_status_idx');
    });

    await knex.raw(`
        ALTER TABLE notification_logs
        ADD CONSTRAINT notification_logs_channel_check
        CHECK (channel IN ('in_app', 'push', 'email', 'sms'))
    `);
    await knex.raw(`
        ALTER TABLE notification_logs
        ADD CONSTRAINT notification_logs_status_check
        CHECK (status IN ('sent', 'delivered', 'failed'))
    `);
};

exports.down = async function down() {
    // Kept as a compatibility no-op. Migration 095 owns notification_logs in
    // the merged sequence, so rolling this migration back must not drop it.
};
