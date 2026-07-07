/**
 * Shared tables:
 *   audit_logs, media_files
 */
exports.up = async function (knex) {
    // ─── audit logs ───────────────────────────────────────────────────
    await knex.schema.createTable('audit_logs', (t) => {
        t.bigIncrements('id').primary();
        t.uuid('user_id').references('id').inTable('auth_users').onDelete('SET NULL');
        t.string('action', 100).notNullable();
        t.string('table_name', 100);
        t.uuid('record_id');
        t.jsonb('old_data');
        t.jsonb('new_data');
        t.specificType('ip_address', 'inet');
        t.timestamps(true, true);
        t.index('user_id');
        t.index('action');
        t.index('table_name');
        t.index('created_at');
    });

    // ─── media files ──────────────────────────────────────────────────
    await knex.schema.createTable('media_files', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('uploader_id').references('id').inTable('auth_users').onDelete('SET NULL');
        t.string('entity_type', 50); // e.g. 'player', 'coach', 'academy'
        t.uuid('entity_id');
        t.text('url').notNullable();
        t.text('storage_key');
        t.bigInteger('size_bytes');
        t.string('mime_type', 100);
        t.timestamps(true, true);
        t.index(['entity_type', 'entity_id']);
        t.index('uploader_id');
    });

    // ─── Apply updated_at triggers ────────────────────────────────────
    const tablesWithUpdatedAt = [
        'academy_academies', 'academy_branches', 'academy_birth_years', 'academy_groups',
        'auth_users', 'auth_refresh_tokens', 'auth_password_resets',
        'player_profiles', 'coach_profiles',
        'attendance_sessions',
        'evaluation_coach_ratings',
        'match_records',
        'payment_subscriptions', 'payment_invoices', 'payment_transactions',
        'notification_inbox', 'notification_device_tokens',
        'ai_analyses', 'ai_recommendations', 'nutrition_plans',
        'audit_logs', 'media_files',
    ];

    for (const table of tablesWithUpdatedAt) {
        await knex.raw(`
      DROP TRIGGER IF EXISTS set_updated_at ON "${table}";
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON "${table}"
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_updated_at();
    `);
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('media_files');
    await knex.schema.dropTableIfExists('audit_logs');
};
