/**
 * AI module tables:
 *   ai_analyses, ai_recommendations, nutrition_plans
 */
exports.up = async function (knex) {
    // ─── analyses ─────────────────────────────────────────────────────
    await knex.schema.createTable('ai_analyses', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.enum('type', ['performance', 'injury_risk', 'potential', 'comparison'], {
            useNative: true,
            enumName: 'ai_analysis_type',
        }).notNullable();
        t.jsonb('input_data').defaultTo('{}');
        t.jsonb('result').defaultTo('{}');
        t.string('model_version', 50);
        t.timestamps(true, true);
        t.index('player_id');
        t.index('type');
    });

    // ─── recommendations ──────────────────────────────────────────────
    await knex.schema.createTable('ai_recommendations', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('analysis_id').notNullable().references('id').inTable('ai_analyses').onDelete('CASCADE');
        t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.text('content').notNullable();
        t.enum('priority', ['low', 'medium', 'high', 'critical'], {
            useNative: true,
            enumName: 'recommendation_priority',
        }).defaultTo('medium');
        t.boolean('is_dismissed').defaultTo(false);
        t.timestamps(true, true);
        t.index('player_id');
        t.index('analysis_id');
    });

    // ─── nutrition plans ──────────────────────────────────────────────
    await knex.schema.createTable('nutrition_plans', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.jsonb('meal_plan').defaultTo('{}');
        t.jsonb('hydration').defaultTo('{}');
        t.string('generated_by', 100); // model/version
        t.date('valid_from');
        t.date('valid_to');
        t.timestamps(true, true);
        t.index('player_id');
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('nutrition_plans');
    await knex.schema.dropTableIfExists('ai_recommendations');
    await knex.schema.dropTableIfExists('ai_analyses');
    await knex.raw('DROP TYPE IF EXISTS ai_analysis_type');
    await knex.raw('DROP TYPE IF EXISTS recommendation_priority');
};
