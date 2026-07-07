/**
 * Extended player profile module.
 *
 * Existing tables already cover the player identity, group assignment, attendance,
 * match records, injuries, payments, and coach ratings. This migration only adds
 * the missing profile fields and normalized child tables for data that changes
 * over time.
 */
exports.up = async function (knex) {
    await knex.raw(`
        DO $$ BEGIN
            CREATE TYPE player_gender AS ENUM ('male', 'female', 'other');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
            CREATE TYPE current_injury_status AS ENUM ('none', 'injured', 'rehab', 'recovered');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
            CREATE TYPE player_fitness_status AS ENUM ('fit', 'limited', 'unfit', 'medical_hold');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    `);

    await knex.schema.alterTable('player_profiles', (t) => {
        t.specificType('gender', 'player_gender');
        t.string('phone', 30);
        t.text('address');
        t.string('nationality', 100);
        t.jsonb('secondary_positions').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
        t.string('current_team', 120);
        t.smallint('shirt_number');
        t.text('playing_style');
        t.smallint('years_experience');
        t.string('previous_club_academy', 255);
        t.string('parent_email', 255);
        t.string('emergency_contact', 50);
        t.string('guardian_relation', 50);
        t.index('phone');
        t.index('gender');
        t.index('nationality');
    });

    await knex.schema.alterTable('player_measurements', (t) => {
        t.decimal('bmi', 5, 2);
        t.decimal('sprint_speed', 6, 2);
        t.decimal('acceleration', 6, 2);
        t.smallint('stamina');
        t.smallint('strength');
        t.smallint('agility');
        t.smallint('balance');
        t.decimal('jump_height_cm', 6, 2);
        t.smallint('flexibility');
    });

    await knex.schema.createTable('player_skill_assessments', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.uuid('group_id').references('id').inTable('academy_groups').onDelete('SET NULL');
        t.uuid('recorded_by').references('id').inTable('auth_users').onDelete('SET NULL');
        t.date('assessed_at').notNullable().defaultTo(knex.fn.now());

        // Technical skills, scored from 1 to 100 by application validation.
        t.smallint('ball_control');
        t.smallint('first_touch');
        t.smallint('passing');
        t.smallint('shooting');
        t.smallint('dribbling');
        t.smallint('crossing');
        t.smallint('heading');
        t.smallint('tackling');
        t.smallint('weak_foot');
        t.smallint('finishing');
        t.smallint('long_passing');
        t.smallint('short_passing');

        // Tactical skills, scored from 1 to 100 by application validation.
        t.smallint('positioning');
        t.smallint('decision_making');
        t.smallint('off_ball_movement');
        t.smallint('pressing');
        t.smallint('defensive_awareness');
        t.smallint('teamwork');
        t.smallint('game_reading');
        t.smallint('tracking_back');
        t.smallint('creating_space');
        t.smallint('tactical_discipline');

        t.timestamps(true, true);
        t.index(['player_id', 'assessed_at']);
        t.index('recorded_by');
    });

    await knex.schema.createTable('player_training_summaries', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.uuid('group_id').references('id').inTable('academy_groups').onDelete('SET NULL');
        t.uuid('recorded_by').references('id').inTable('auth_users').onDelete('SET NULL');
        t.date('recorded_at').notNullable().defaultTo(knex.fn.now());
        t.integer('training_sessions_count').defaultTo(0);
        t.integer('attendance_count').defaultTo(0);
        t.integer('absence_count').defaultTo(0);
        t.integer('late_arrivals').defaultTo(0);
        t.decimal('attendance_rate', 5, 2);
        t.smallint('training_performance_rating');
        t.text('coach_notes');
        t.text('improvement_notes');
        t.timestamps(true, true);
        t.index(['player_id', 'recorded_at']);
    });

    await knex.schema.createTable('player_match_summaries', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.uuid('group_id').references('id').inTable('academy_groups').onDelete('SET NULL');
        t.uuid('recorded_by').references('id').inTable('auth_users').onDelete('SET NULL');
        t.date('recorded_at').notNullable().defaultTo(knex.fn.now());
        t.integer('matches_played').defaultTo(0);
        t.integer('minutes_played').defaultTo(0);
        t.integer('goals').defaultTo(0);
        t.integer('assists').defaultTo(0);
        t.integer('shots').defaultTo(0);
        t.integer('shots_on_target').defaultTo(0);
        t.decimal('pass_accuracy', 5, 2);
        t.integer('key_passes').defaultTo(0);
        t.integer('successful_dribbles').defaultTo(0);
        t.integer('tackles').defaultTo(0);
        t.integer('interceptions').defaultTo(0);
        t.integer('fouls').defaultTo(0);
        t.integer('yellow_cards').defaultTo(0);
        t.integer('red_cards').defaultTo(0);
        t.integer('man_of_the_match_count').defaultTo(0);
        t.decimal('match_rating', 5, 2);
        t.timestamps(true, true);
        t.index(['player_id', 'recorded_at']);
    });

    await knex.schema.createTable('player_health_profiles', (t) => {
        t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        t.uuid('player_id').notNullable().unique().references('id').inTable('player_profiles').onDelete('CASCADE');
        t.text('medical_notes');
        t.text('injury_history');
        t.specificType('current_injury_status', 'current_injury_status').defaultTo('none');
        t.string('injury_type', 100);
        t.date('injury_date');
        t.date('recovery_date');
        t.specificType('fitness_status', 'player_fitness_status').defaultTo('fit');
        t.text('allergies');
        t.text('chronic_problems');
        t.timestamps(true, true);
    });

    await knex.schema.alterTable('evaluation_coach_ratings', (t) => {
        t.decimal('potential_rating', 5, 2);
        t.text('strengths');
        t.text('weaknesses');
        t.string('recommended_position', 50);
        t.text('development_plan');
        t.text('final_notes');
    });

    await knex.schema.alterTable('match_player_stats', (t) => {
        t.integer('shots').defaultTo(0);
        t.integer('shots_on_target').defaultTo(0);
        t.decimal('pass_accuracy', 5, 2);
        t.integer('key_passes').defaultTo(0);
        t.integer('successful_dribbles').defaultTo(0);
        t.integer('tackles').defaultTo(0);
        t.integer('interceptions').defaultTo(0);
        t.integer('fouls').defaultTo(0);
        t.integer('yellow_cards').defaultTo(0);
        t.integer('red_cards').defaultTo(0);
        t.boolean('man_of_the_match').defaultTo(false);
    });

    await knex.schema.alterTable('payment_subscriptions', (t) => {
        t.decimal('discount_amount', 10, 2).defaultTo(0);
        t.decimal('penalty_amount', 10, 2).defaultTo(0);
        t.date('last_payment_date');
        t.date('next_payment_due');
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable('payment_subscriptions', (t) => {
        t.dropColumn('next_payment_due');
        t.dropColumn('last_payment_date');
        t.dropColumn('penalty_amount');
        t.dropColumn('discount_amount');
    });

    await knex.schema.alterTable('match_player_stats', (t) => {
        t.dropColumn('man_of_the_match');
        t.dropColumn('red_cards');
        t.dropColumn('yellow_cards');
        t.dropColumn('fouls');
        t.dropColumn('interceptions');
        t.dropColumn('tackles');
        t.dropColumn('successful_dribbles');
        t.dropColumn('key_passes');
        t.dropColumn('pass_accuracy');
        t.dropColumn('shots_on_target');
        t.dropColumn('shots');
    });

    await knex.schema.alterTable('evaluation_coach_ratings', (t) => {
        t.dropColumn('final_notes');
        t.dropColumn('development_plan');
        t.dropColumn('recommended_position');
        t.dropColumn('weaknesses');
        t.dropColumn('strengths');
        t.dropColumn('potential_rating');
    });

    await knex.schema.dropTableIfExists('player_health_profiles');
    await knex.schema.dropTableIfExists('player_match_summaries');
    await knex.schema.dropTableIfExists('player_training_summaries');
    await knex.schema.dropTableIfExists('player_skill_assessments');

    await knex.schema.alterTable('player_measurements', (t) => {
        t.dropColumn('flexibility');
        t.dropColumn('jump_height_cm');
        t.dropColumn('balance');
        t.dropColumn('agility');
        t.dropColumn('strength');
        t.dropColumn('stamina');
        t.dropColumn('acceleration');
        t.dropColumn('sprint_speed');
        t.dropColumn('bmi');
    });

    await knex.schema.alterTable('player_profiles', (t) => {
        t.dropColumn('guardian_relation');
        t.dropColumn('emergency_contact');
        t.dropColumn('parent_email');
        t.dropColumn('previous_club_academy');
        t.dropColumn('years_experience');
        t.dropColumn('playing_style');
        t.dropColumn('shirt_number');
        t.dropColumn('current_team');
        t.dropColumn('secondary_positions');
        t.dropColumn('nationality');
        t.dropColumn('address');
        t.dropColumn('phone');
        t.dropColumn('gender');
    });

    await knex.raw('DROP TYPE IF EXISTS player_fitness_status');
    await knex.raw('DROP TYPE IF EXISTS current_injury_status');
    await knex.raw('DROP TYPE IF EXISTS player_gender');
};
