async function createNotificationLogsTable(knex) {
    await knex.schema.createTable('notification_logs', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('notification_id')
            .notNullable()
            .references('id')
            .inTable('notification_inbox')
            .onDelete('CASCADE');
        table.uuid('user_id')
            .notNullable()
            .references('id')
            .inTable('auth_users')
            .onDelete('CASCADE');
        table.string('channel', 20).notNullable();
        table.string('status', 20).notNullable().defaultTo('sent');
        table.string('provider_message_id', 255);
        table.text('error');
        table.timestamp('delivered_at');
        table.timestamps(true, true);

        table.index(['notification_id', 'created_at']);
        table.index(['user_id', 'created_at']);
        table.index(['channel', 'status', 'created_at']);
    });
}

async function createNotificationLogsArchive(knex) {
    await knex.raw(
        'CREATE TABLE ?? (LIKE ?? INCLUDING ALL)',
        ['notification_logs_archive', 'notification_logs'],
    );
    await knex.schema.alterTable('notification_logs_archive', (table) => {
        table.timestamp('archived_at').notNullable().defaultTo(knex.fn.now());
        table.uuid('archive_batch_id')
            .references('id')
            .inTable('data_lifecycle_runs')
            .onDelete('SET NULL');
    });
    await knex.raw(
        'CREATE INDEX IF NOT EXISTS ?? ON ?? (archived_at DESC)',
        ['notification_logs_archive_archived_at_idx', 'notification_logs_archive'],
    );
    await knex.raw(
        'CREATE INDEX IF NOT EXISTS ?? ON ?? (archive_batch_id)',
        ['notification_logs_archive_archive_batch_idx', 'notification_logs_archive'],
    );
}

exports.up = async function up(knex) {
    if (!(await knex.schema.hasTable('notification_logs'))) {
        await createNotificationLogsTable(knex);
    }
    if (!(await knex.schema.hasTable('notification_logs_archive'))) {
        await createNotificationLogsArchive(knex);
    }
};

exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('notification_logs_archive');
    await knex.schema.dropTableIfExists('notification_logs');
};
