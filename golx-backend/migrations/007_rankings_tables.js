/**
 * Evaluations & Rankings module tables:
 *   evaluation_coach_ratings, evaluation_discipline_scores,
 *   match_records, match_player_stats,
 *   ranking_snapshots, ranking_score_breakdown
 */
exports.up = async function (knex) {
    // ─── coach ratings ────────────────────────────────────────────────
    await knex.schema.createTable('evaluation_coach_ratings', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('coach_id').notNullable().references('id').inTable('coach_profiles').onDelete('CASCADE');
        t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.uuid('group_id').references('id').inTable('academy_groups').onDelete('SET NULL');
        t.decimal('score', 5, 2).notNullable();
        t.text('notes');
        t.date('eval_date').notNullable();
        t.timestamps(true, true);
        t.index(['player_id', 'eval_date']);
        t.index('coach_id');
    });

    // ─── discipline scores ────────────────────────────────────────────
    await knex.schema.createTable('evaluation_discipline_scores', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.uuid('group_id').references('id').inTable('academy_groups').onDelete('SET NULL');
        t.decimal('score', 5, 2).notNullable();
        t.text('reason');
        t.date('eval_date').notNullable();
        t.uuid('recorded_by').references('id').inTable('auth_users').onDelete('SET NULL');
        t.index(['player_id', 'eval_date']);
    });

    // ─── match records ────────────────────────────────────────────────
    await knex.schema.createTable('match_records', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('group_id').notNullable().references('id').inTable('academy_groups').onDelete('CASCADE');
        t.string('opponent', 255).notNullable();
        t.date('match_date').notNullable();
        t.smallint('goals_for').defaultTo(0);
        t.smallint('goals_against').defaultTo(0);
        t.enum('result', ['win', 'draw', 'loss'], {
            useNative: true,
            enumName: 'match_result',
        });
        t.timestamps(true, true);
        t.index('group_id');
        t.index('match_date');
    });

    // ─── match player stats ───────────────────────────────────────────
    await knex.schema.createTable('match_player_stats', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('match_id').notNullable().references('id').inTable('match_records').onDelete('CASCADE');
        t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.smallint('minutes_played').defaultTo(0);
        t.smallint('goals').defaultTo(0);
        t.smallint('assists').defaultTo(0);
        t.decimal('performance_score', 5, 2);
        t.index('match_id');
        t.index('player_id');
        t.unique(['match_id', 'player_id']);
    });

    // ─── ranking snapshots ────────────────────────────────────────────
    await knex.schema.createTable('ranking_snapshots', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.uuid('group_id').references('id').inTable('academy_groups').onDelete('SET NULL');
        t.decimal('total_score', 7, 2).defaultTo(0);
        t.smallint('rank');
        t.string('period', 20).notNullable(); // "2024-W12" or "2024-03"
        t.enum('trend', ['up', 'down', 'same', 'new'], {
            useNative: true,
            enumName: 'ranking_trend',
        }).defaultTo('new');
        t.timestamp('calculated_at').defaultTo(knex.fn.now());
        t.index(['player_id', 'period']);
        t.index(['group_id', 'period']);
        t.unique(['player_id', 'period']);
    });

    // ─── ranking score breakdown ──────────────────────────────────────
    await knex.schema.createTable('ranking_score_breakdown', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('ranking_id').notNullable().unique().references('id').inTable('ranking_snapshots').onDelete('CASCADE');
        t.decimal('coach_eval_score', 5, 2).defaultTo(0);
        t.decimal('attendance_score', 5, 2).defaultTo(0);
        t.decimal('discipline_score', 5, 2).defaultTo(0);
        t.decimal('match_score', 5, 2).defaultTo(0);
        t.decimal('ai_score', 5, 2).defaultTo(0);
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('ranking_score_breakdown');
    await knex.schema.dropTableIfExists('ranking_snapshots');
    await knex.schema.dropTableIfExists('match_player_stats');
    await knex.schema.dropTableIfExists('match_records');
    await knex.schema.dropTableIfExists('evaluation_discipline_scores');
    await knex.schema.dropTableIfExists('evaluation_coach_ratings');
    await knex.raw('DROP TYPE IF EXISTS match_result');
    await knex.raw('DROP TYPE IF EXISTS ranking_trend');
};
