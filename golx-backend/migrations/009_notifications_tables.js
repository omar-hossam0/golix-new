/**
 * Notifications module tables:
 *   notification_inbox, notification_device_tokens
 */
exports.up = async function (knex) {
    // ─── inbox ────────────────────────────────────────────────────────
    await knex.schema.createTable('notification_inbox', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('user_id').notNullable().references('id').inTable('auth_users').onDelete('CASCADE');
        t.string('type', 20).defaultTo('info');
        t.string('title', 255).notNullable();
        t.text('body');
        t.jsonb('data').defaultTo('{}');
        t.boolean('is_read').defaultTo(false);
        t.timestamp('sent_at').defaultTo(knex.fn.now());
        t.timestamps(true, true);
        t.index('user_id');
        t.index('is_read');
    });

    // ─── device tokens ────────────────────────────────────────────────
    await knex.schema.createTable('notification_device_tokens', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('user_id').notNullable().references('id').inTable('auth_users').onDelete('CASCADE');
        t.text('token').notNullable().unique();
        t.enum('platform', ['ios', 'android', 'web'], {
            useNative: true,
            enumName: 'device_platform',
        }).notNullable();
        t.timestamps(true, true);
        t.index('user_id');
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('notification_device_tokens');
    await knex.schema.dropTableIfExists('notification_inbox');
    await knex.raw('DROP TYPE IF EXISTS device_platform');
};
