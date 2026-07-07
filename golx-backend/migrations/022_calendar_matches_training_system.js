/**
 * Calendar, training, matches, player evaluations, and coach scoping support.
 */
exports.up = async function (knex) {
    await knex.raw(`
        DO $$ BEGIN CREATE TYPE calendar_event_type AS ENUM ('training', 'match', 'fitness_test', 'meeting', 'rest_day', 'tournament', 'medical_check', 'assessment_day');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE calendar_event_status AS ENUM ('scheduled', 'completed', 'cancelled', 'postponed');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE calendar_event_visibility AS ENUM ('all_assigned_groups', 'selected_groups', 'coaches_only');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE calendar_event_creator_role AS ENUM ('admin', 'coach');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE training_focus AS ENUM ('fitness', 'tactics', 'shooting', 'passing', 'defense', 'recovery', 'technical', 'physical');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE training_intensity_level AS ENUM ('low', 'medium', 'high');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE academy_match_type AS ENUM ('official', 'friendly', 'training', 'training_match');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE academy_venue_type AS ENUM ('home', 'away', 'neutral');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE academy_match_status AS ENUM ('scheduled', 'first_half', 'second_half', 'finished', 'cancelled', 'postponed');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE match_core_status AS ENUM ('scheduled', 'postponed', 'cancelled', 'finished');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE match_squad_role AS ENUM ('starter', 'substitute', 'reserve');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE event_attendance_status AS ENUM ('present', 'absent', 'late', 'excused', 'injured');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE match_attendance_status AS ENUM ('present', 'absent', 'late', 'injured');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE player_evaluation_visibility AS ENUM ('private', 'player_and_parent', 'admin_only');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE opponent_level AS ENUM ('weak', 'medium', 'strong');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE friendly_request_status AS ENUM ('pending', 'approved', 'rejected');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        DO $$ BEGIN CREATE TYPE player_option_field AS ENUM ('position', 'secondary_position', 'playing_style');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    const coachAssignmentsHasCreateTraining = await knex.schema.hasColumn('coach_group_assignments', 'can_create_training');
    const coachAssignmentsHasAttendance = await knex.schema.hasColumn('coach_group_assignments', 'can_take_attendance');
    const coachAssignmentsHasEvaluate = await knex.schema.hasColumn('coach_group_assignments', 'can_evaluate_players');

    await knex.schema.alterTable('coach_group_assignments', (t) => {
        if (!coachAssignmentsHasCreateTraining) t.boolean('can_create_training').notNullable().defaultTo(true);
        if (!coachAssignmentsHasAttendance) t.boolean('can_take_attendance').notNullable().defaultTo(true);
        if (!coachAssignmentsHasEvaluate) t.boolean('can_evaluate_players').notNullable().defaultTo(true);
    });

    const hasCoachBranches = await knex.schema.hasTable('coach_branch_assignments');
    if (!hasCoachBranches) {
        await knex.schema.createTable('coach_branch_assignments', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('coach_id').notNullable().references('id').inTable('coach_profiles').onDelete('CASCADE');
            t.uuid('branch_id').notNullable().references('id').inTable('academy_branches').onDelete('CASCADE');
            t.uuid('assigned_by_admin_id').references('id').inTable('auth_users').onDelete('SET NULL');
            t.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
            t.timestamps(true, true);
            t.unique(['coach_id', 'branch_id']);
            t.index('coach_id');
            t.index('branch_id');
        });

        await knex.raw(`
            INSERT INTO coach_branch_assignments (coach_id, branch_id)
            SELECT id, branch_id
            FROM coach_profiles
            WHERE branch_id IS NOT NULL
            ON CONFLICT (coach_id, branch_id) DO NOTHING
        `);
    }

    const hasPlayerOptions = await knex.schema.hasTable('player_field_options');
    if (!hasPlayerOptions) {
        await knex.schema.createTable('player_field_options', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('academy_id').notNullable().references('id').inTable('academy_academies').onDelete('CASCADE');
            t.specificType('field_key', 'player_option_field').notNullable();
            t.string('label', 120).notNullable();
            t.string('value', 120).notNullable();
            t.uuid('created_by_user_id').references('id').inTable('auth_users').onDelete('SET NULL');
            t.specificType('created_by_role', 'calendar_event_creator_role').notNullable();
            t.uuid('created_by_coach_id').references('id').inTable('coach_profiles').onDelete('SET NULL');
            t.boolean('is_active').notNullable().defaultTo(true);
            t.timestamps(true, true);
            t.timestamp('deleted_at');
            t.unique(['academy_id', 'field_key', 'value']);
            t.index(['academy_id', 'field_key']);
            t.index('created_by_coach_id');
        });
    }

    const hasAgeGroups = await knex.schema.hasTable('age_groups');
    if (!hasAgeGroups) {
        await knex.schema.createTable('age_groups', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('academy_id').notNullable().references('id').inTable('academy_academies').onDelete('CASCADE');
            t.string('name', 120).notNullable();
            t.smallint('min_age');
            t.smallint('max_age');
            t.smallint('birth_year');
            t.text('description');
            t.boolean('is_active').notNullable().defaultTo(true);
            t.timestamps(true, true);
            t.unique(['academy_id', 'name']);
            t.index('academy_id');
        });
    }

    const hasCalendarEvents = await knex.schema.hasTable('calendar_events');
    if (!hasCalendarEvents) {
        await knex.schema.createTable('calendar_events', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('academy_id').notNullable().references('id').inTable('academy_academies').onDelete('CASCADE');
            t.string('title', 255).notNullable();
            t.specificType('event_type', 'calendar_event_type').notNullable();
            t.timestamp('start_datetime').notNullable();
            t.timestamp('end_datetime').notNullable();
            t.string('location', 255);
            t.specificType('status', 'match_core_status').notNullable().defaultTo('scheduled');
            t.specificType('visibility', 'calendar_event_visibility').notNullable().defaultTo('selected_groups');
            t.uuid('created_by_user_id').references('id').inTable('auth_users').onDelete('SET NULL');
            t.specificType('created_by_role', 'calendar_event_creator_role').notNullable();
            t.text('notes');
            t.timestamps(true, true);
            t.timestamp('deleted_at');
            t.index('academy_id');
            t.index('event_type');
            t.index('status');
            t.index('start_datetime');
            t.index('created_by_user_id');
        });
    }

    const hasCalendarEventGroups = await knex.schema.hasTable('calendar_event_groups');
    if (!hasCalendarEventGroups) {
        await knex.schema.createTable('calendar_event_groups', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('event_id').notNullable().references('id').inTable('calendar_events').onDelete('CASCADE');
            t.uuid('group_id').notNullable().references('id').inTable('academy_groups').onDelete('CASCADE');
            t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            t.unique(['event_id', 'group_id']);
            t.index('event_id');
            t.index('group_id');
        });
    }

    const hasTrainingSessions = await knex.schema.hasTable('training_sessions');
    if (!hasTrainingSessions) {
        await knex.schema.createTable('training_sessions', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('event_id').notNullable().unique().references('id').inTable('calendar_events').onDelete('CASCADE');
            t.uuid('coach_id').references('id').inTable('coach_profiles').onDelete('SET NULL');
            t.specificType('training_focus', 'training_focus').notNullable();
            t.specificType('intensity_level', 'training_intensity_level').notNullable().defaultTo('medium');
            t.text('objectives');
            t.text('session_plan');
            t.text('equipment_needed');
            t.text('coach_notes');
            t.timestamps(true, true);
            t.index('coach_id');
        });
    }

    const hasMatches = await knex.schema.hasTable('matches');
    if (!hasMatches) {
        await knex.schema.createTable('matches', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('event_id').references('id').inTable('calendar_events').onDelete('CASCADE');
            t.uuid('team_id').references('id').inTable('academy_groups').onDelete('SET NULL');
            t.uuid('age_group_id').references('id').inTable('academy_groups').onDelete('SET NULL');
            t.string('opponent_name', 255).notNullable();
            t.specificType('match_type', 'academy_match_type').notNullable();
            t.date('match_date').notNullable();
            t.time('match_time').notNullable();
            t.string('location', 255);
            t.specificType('venue_type', 'academy_venue_type').notNullable();
            t.string('referee_name', 255);
            t.specificType('status', 'calendar_event_status').notNullable().defaultTo('scheduled');
            t.specificType('match_status', 'academy_match_status').notNullable().defaultTo('scheduled');
            t.text('organizer_notes');
            t.text('match_notes');
            t.smallint('our_score');
            t.smallint('opponent_score');
            t.uuid('created_by_admin_id').references('id').inTable('auth_users').onDelete('SET NULL');
            t.timestamps(true, true);
            t.timestamp('deleted_at');
            t.index('event_id');
            t.index('team_id');
            t.index('age_group_id');
            t.index('match_date');
            t.index('match_type');
            t.index('status');
        });
    }

    const hasSquads = await knex.schema.hasTable('match_squads');
    if (!hasSquads) {
        await knex.schema.createTable('match_squads', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
            t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
            t.uuid('selected_by_coach_id').references('id').inTable('coach_profiles').onDelete('SET NULL');
            t.specificType('squad_role', 'match_squad_role').notNullable();
            t.string('position', 50);
            t.smallint('shirt_number');
            t.timestamps(true, true);
            t.unique(['match_id', 'player_id']);
            t.index('match_id');
            t.index('player_id');
        });
    }

    const hasTactics = await knex.schema.hasTable('match_tactics');
    if (!hasTactics) {
        await knex.schema.createTable('match_tactics', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('match_id').notNullable().unique().references('id').inTable('matches').onDelete('CASCADE');
            t.uuid('coach_id').notNullable().references('id').inTable('coach_profiles').onDelete('CASCADE');
            t.string('formation', 20).notNullable();
            t.text('tactical_notes');
            t.timestamps(true, true);
            t.index('coach_id');
        });
    }

    const hasMatchAttendance = await knex.schema.hasTable('match_attendance');
    if (!hasMatchAttendance) {
        await knex.schema.createTable('match_attendance', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
            t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
            t.specificType('status', 'match_attendance_status').notNullable();
            t.uuid('marked_by_coach_id').references('id').inTable('coach_profiles').onDelete('SET NULL');
            t.text('notes');
            t.timestamps(true, true);
            t.unique(['match_id', 'player_id']);
            t.index('match_id');
            t.index('player_id');
        });
    }

    const hasEventAttendance = await knex.schema.hasTable('event_attendance');
    if (!hasEventAttendance) {
        await knex.schema.createTable('event_attendance', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('event_id').notNullable().references('id').inTable('calendar_events').onDelete('CASCADE');
            t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
            t.specificType('status', 'event_attendance_status').notNullable();
            t.time('arrival_time');
            t.uuid('marked_by_coach_id').references('id').inTable('coach_profiles').onDelete('SET NULL');
            t.text('reason');
            t.text('notes');
            t.timestamps(true, true);
            t.unique(['event_id', 'player_id']);
            t.index('event_id');
            t.index('player_id');
        });
    }

    const hasEventEvaluations = await knex.schema.hasTable('player_event_evaluations');
    if (!hasEventEvaluations) {
        await knex.schema.createTable('player_event_evaluations', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('event_id').notNullable().references('id').inTable('calendar_events').onDelete('CASCADE');
            t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
            t.uuid('coach_id').notNullable().references('id').inTable('coach_profiles').onDelete('CASCADE');
            t.decimal('overall_rating', 5, 2);
            t.decimal('technical_rating', 5, 2);
            t.decimal('tactical_rating', 5, 2);
            t.decimal('physical_rating', 5, 2);
            t.decimal('mentality_rating', 5, 2);
            t.decimal('discipline_rating', 5, 2);
            t.decimal('teamwork_rating', 5, 2);
            t.decimal('impact_rating', 5, 2);
            t.text('strengths');
            t.text('weaknesses');
            t.text('coach_notes');
            t.text('improvement_plan');
            t.specificType('visibility', 'player_evaluation_visibility').notNullable().defaultTo('player_and_parent');
            t.timestamps(true, true);
            t.unique(['event_id', 'player_id', 'coach_id']);
            t.index('event_id');
            t.index('player_id');
            t.index('coach_id');
        });
    }

    const hasFriendlyRequests = await knex.schema.hasTable('friendly_match_requests');
    if (!hasFriendlyRequests) {
        await knex.schema.createTable('friendly_match_requests', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('coach_id').notNullable().references('id').inTable('coach_profiles').onDelete('CASCADE');
            t.uuid('team_id').references('id').inTable('academy_groups').onDelete('SET NULL');
            t.uuid('age_group_id').references('id').inTable('academy_groups').onDelete('SET NULL');
            t.date('preferred_date').notNullable();
            t.time('preferred_time').notNullable();
            t.specificType('opponent_level', 'opponent_level').notNullable();
            t.string('suggested_opponent_name', 255);
            t.text('reason').notNullable();
            t.text('notes');
            t.specificType('status', 'friendly_request_status').notNullable().defaultTo('pending');
            t.text('admin_response');
            t.uuid('reviewed_by_admin_id').references('id').inTable('auth_users').onDelete('SET NULL');
            t.timestamp('reviewed_at');
            t.uuid('converted_match_id').references('id').inTable('matches').onDelete('SET NULL');
            t.timestamps(true, true);
            t.index('coach_id');
            t.index('team_id');
            t.index('status');
            t.index('preferred_date');
        });
    }

    const matchStatsHasCreatedAt = await knex.schema.hasColumn('match_player_stats', 'created_at');
    const matchStatsHasUpdatedAt = await knex.schema.hasColumn('match_player_stats', 'updated_at');
    const matchStatsHasShots = await knex.schema.hasColumn('match_player_stats', 'shots');
    const matchStatsHasShotsOnTarget = await knex.schema.hasColumn('match_player_stats', 'shots_on_target');
    const matchStatsHasPassesCompleted = await knex.schema.hasColumn('match_player_stats', 'passes_completed');
    const matchStatsHasTackles = await knex.schema.hasColumn('match_player_stats', 'tackles');
    const matchStatsHasInterceptions = await knex.schema.hasColumn('match_player_stats', 'interceptions');
    const matchStatsHasSaves = await knex.schema.hasColumn('match_player_stats', 'saves');
    const matchStatsHasYellowCards = await knex.schema.hasColumn('match_player_stats', 'yellow_cards');
    const matchStatsHasRedCards = await knex.schema.hasColumn('match_player_stats', 'red_cards');
    const matchStatsHasFouls = await knex.schema.hasColumn('match_player_stats', 'fouls');
    const matchStatsHasInjuries = await knex.schema.hasColumn('match_player_stats', 'injuries');
    const matchStatsHasRating = await knex.schema.hasColumn('match_player_stats', 'performance_rating');
    const matchStatsHasCoachNotes = await knex.schema.hasColumn('match_player_stats', 'coach_notes');
    const matchStatsHasCreatedBy = await knex.schema.hasColumn('match_player_stats', 'created_by_coach_id');

    await knex.schema.alterTable('match_player_stats', (t) => {
        if (!matchStatsHasShots) t.integer('shots').notNullable().defaultTo(0);
        if (!matchStatsHasShotsOnTarget) t.integer('shots_on_target').notNullable().defaultTo(0);
        if (!matchStatsHasPassesCompleted) t.integer('passes_completed').notNullable().defaultTo(0);
        if (!matchStatsHasTackles) t.integer('tackles').notNullable().defaultTo(0);
        if (!matchStatsHasInterceptions) t.integer('interceptions').notNullable().defaultTo(0);
        if (!matchStatsHasSaves) t.integer('saves').notNullable().defaultTo(0);
        if (!matchStatsHasYellowCards) t.integer('yellow_cards').notNullable().defaultTo(0);
        if (!matchStatsHasRedCards) t.integer('red_cards').notNullable().defaultTo(0);
        if (!matchStatsHasFouls) t.integer('fouls').notNullable().defaultTo(0);
        if (!matchStatsHasInjuries) t.text('injuries');
        if (!matchStatsHasRating) t.decimal('performance_rating', 5, 2);
        if (!matchStatsHasCoachNotes) t.text('coach_notes');
        if (!matchStatsHasCreatedBy) t.uuid('created_by_coach_id').references('id').inTable('coach_profiles').onDelete('SET NULL');
        if (!matchStatsHasCreatedAt) t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        if (!matchStatsHasUpdatedAt) t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    });

    await knex.raw('ALTER TABLE match_player_stats DROP CONSTRAINT IF EXISTS match_player_stats_match_id_foreign');
    await knex.raw(`
        DO $$ BEGIN
            ALTER TABLE match_player_stats
            ADD CONSTRAINT match_player_stats_match_id_foreign
            FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE NOT VALID;
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    const tablesWithUpdatedAt = [
        'coach_branch_assignments',
        'player_field_options',
        'age_groups',
        'calendar_events',
        'training_sessions',
        'matches',
        'match_squads',
        'match_tactics',
        'match_attendance',
        'event_attendance',
        'player_event_evaluations',
        'friendly_match_requests',
        'match_player_stats',
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
    await knex.raw('ALTER TABLE match_player_stats DROP CONSTRAINT IF EXISTS match_player_stats_match_id_foreign');
    await knex.schema.dropTableIfExists('friendly_match_requests');
    await knex.schema.dropTableIfExists('player_event_evaluations');
    await knex.schema.dropTableIfExists('event_attendance');
    await knex.schema.dropTableIfExists('match_attendance');
    await knex.schema.dropTableIfExists('match_tactics');
    await knex.schema.dropTableIfExists('match_squads');
    await knex.schema.dropTableIfExists('matches');
    await knex.schema.dropTableIfExists('training_sessions');
    await knex.schema.dropTableIfExists('calendar_event_groups');
    await knex.schema.dropTableIfExists('calendar_events');
    await knex.schema.dropTableIfExists('age_groups');
    await knex.schema.dropTableIfExists('player_field_options');
    await knex.schema.dropTableIfExists('coach_branch_assignments');

    await knex.raw(`
        DROP TYPE IF EXISTS player_option_field;
        DROP TYPE IF EXISTS friendly_request_status;
        DROP TYPE IF EXISTS opponent_level;
        DROP TYPE IF EXISTS player_evaluation_visibility;
        DROP TYPE IF EXISTS match_attendance_status;
        DROP TYPE IF EXISTS event_attendance_status;
        DROP TYPE IF EXISTS match_squad_role;
        DROP TYPE IF EXISTS academy_match_status;
        DROP TYPE IF EXISTS match_core_status;
        DROP TYPE IF EXISTS academy_venue_type;
        DROP TYPE IF EXISTS academy_match_type;
        DROP TYPE IF EXISTS training_intensity_level;
        DROP TYPE IF EXISTS training_focus;
        DROP TYPE IF EXISTS calendar_event_creator_role;
        DROP TYPE IF EXISTS calendar_event_visibility;
        DROP TYPE IF EXISTS calendar_event_status;
        DROP TYPE IF EXISTS calendar_event_type;
    `);
};
