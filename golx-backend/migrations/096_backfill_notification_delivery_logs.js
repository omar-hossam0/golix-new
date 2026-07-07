exports.up = async function up(knex) {
    if (
        !(await knex.schema.hasTable('notification_inbox')) ||
        !(await knex.schema.hasTable('notification_logs'))
    ) {
        return;
    }

    await knex.raw(`
        INSERT INTO notification_logs (
            notification_id,
            user_id,
            channel,
            status,
            created_at,
            updated_at
        )
        SELECT
            notification.id,
            notification.user_id,
            'in_app',
            'sent',
            notification.created_at,
            notification.updated_at
        FROM notification_inbox AS notification
        WHERE NOT EXISTS (
            SELECT 1
            FROM notification_logs AS log
            WHERE log.notification_id = notification.id
        )
    `);
};

exports.down = async function down() {
    // Historical delivery rows are retained because they cannot be distinguished
    // safely from application-created in-app logs after the backfill.
};
