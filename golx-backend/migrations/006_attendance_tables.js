/**
 * Attendance module tables:
 *   attendance_sessions, attendance_marks
 */
exports.up = async function (knex) {
    // ─── sessions ─────────────────────────────────────────────────────
    await knex.schema.createTable('attendance_sessions', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('group_id').notNullable().references('id').inTable('academy_groups').onDelete('CASCADE');
        t.uuid('coach_id').references('id').inTable('coach_profiles').onDelete('SET NULL');
        t.date('session_date').notNullable();
        t.enum('status', ['scheduled', 'active', 'completed', 'cancelled'], {
            useNative: true,
            enumName: 'session_status',
        }).defaultTo('scheduled');
        t.text('notes');
        t.timestamps(true, true);
        t.index('group_id');
        t.index('session_date');
        t.unique(['group_id', 'session_date']);
    });

    // ─── marks ────────────────────────────────────────────────────────
    await knex.schema.createTable('attendance_marks', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('session_id').notNullable().references('id').inTable('attendance_sessions').onDelete('CASCADE');
        t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.enum('status', ['present', 'absent', 'late', 'excused'], {
            useNative: true,
            enumName: 'attendance_status',
        }).notNullable().defaultTo('absent');
        t.timestamp('marked_at').defaultTo(knex.fn.now());
        t.uuid('marked_by').references('id').inTable('auth_users').onDelete('SET NULL');
        t.index('session_id');
        t.index('player_id');
        t.unique(['session_id', 'player_id']);
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('attendance_marks');
    await knex.schema.dropTableIfExists('attendance_sessions');
    await knex.raw('DROP TYPE IF EXISTS session_status');
    await knex.raw('DROP TYPE IF EXISTS attendance_status');
};
