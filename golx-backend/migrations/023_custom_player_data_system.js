exports.up = async function up(knex) {
    await knex.raw(`
        DO $$ BEGIN CREATE TYPE custom_target_module AS ENUM ('player_profile', 'training', 'match', 'injury', 'payment', 'evaluation');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN CREATE TYPE custom_creator_role AS ENUM ('admin', 'coach');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN CREATE TYPE custom_visibility AS ENUM ('global', 'specific_coach', 'coach_only', 'shared');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN CREATE TYPE custom_field_type AS ENUM (
            'text',
            'long_text',
            'number',
            'decimal',
            'date',
            'time',
            'boolean',
            'single_select',
            'multi_select',
            'rating',
            'percentage',
            'file',
            'image',
            'url',
            'phone',
            'email'
        );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    `);

    const hasCategories = await knex.schema.hasTable('custom_categories');
    if (!hasCategories) {
        await knex.schema.createTable('custom_categories', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('academy_id').notNullable().references('id').inTable('academy_academies').onDelete('CASCADE');
            t.string('name', 160).notNullable();
            t.text('description');
            t.specificType('target_module', 'custom_target_module').notNullable().defaultTo('player_profile');
            t.specificType('created_by_role', 'custom_creator_role').notNullable();
            t.uuid('created_by_id').references('id').inTable('auth_users').onDelete('SET NULL');
            t.uuid('created_by_coach_id').references('id').inTable('coach_profiles').onDelete('SET NULL');
            t.uuid('assigned_coach_id').references('id').inTable('coach_profiles').onDelete('CASCADE');
            t.specificType('visibility', 'custom_visibility').notNullable().defaultTo('coach_only');
            t.boolean('is_editable_by_coach').notNullable().defaultTo(false);
            t.boolean('is_system_default').notNullable().defaultTo(false);
            t.boolean('is_active').notNullable().defaultTo(true);
            t.integer('sort_order').notNullable().defaultTo(0);
            t.timestamps(true, true);
            t.timestamp('deleted_at');
            t.index(['academy_id', 'target_module']);
            t.index(['academy_id', 'visibility']);
            t.index(['created_by_coach_id']);
            t.index(['assigned_coach_id']);
        });
    }

    const hasFields = await knex.schema.hasTable('custom_fields');
    if (!hasFields) {
        await knex.schema.createTable('custom_fields', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('category_id').notNullable().references('id').inTable('custom_categories').onDelete('CASCADE');
            t.string('label', 160).notNullable();
            t.string('key', 160).notNullable();
            t.specificType('field_type', 'custom_field_type').notNullable();
            t.boolean('is_required').notNullable().defaultTo(true);
            t.string('placeholder', 255);
            t.text('default_value');
            t.string('unit', 40);
            t.decimal('min_value', 14, 4);
            t.decimal('max_value', 14, 4);
            t.jsonb('validation_rules').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
            t.specificType('created_by_role', 'custom_creator_role').notNullable();
            t.uuid('created_by_id').references('id').inTable('auth_users').onDelete('SET NULL');
            t.uuid('created_by_coach_id').references('id').inTable('coach_profiles').onDelete('SET NULL');
            t.boolean('is_editable_by_coach').notNullable().defaultTo(false);
            t.boolean('is_active').notNullable().defaultTo(true);
            t.integer('sort_order').notNullable().defaultTo(0);
            t.timestamps(true, true);
            t.timestamp('deleted_at');
            t.unique(['category_id', 'key']);
            t.index(['category_id', 'is_active']);
            t.index(['created_by_coach_id']);
        });
    }

    const hasOptions = await knex.schema.hasTable('custom_field_options');
    if (!hasOptions) {
        await knex.schema.createTable('custom_field_options', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('field_id').notNullable().references('id').inTable('custom_fields').onDelete('CASCADE');
            t.string('label', 160).notNullable();
            t.string('value', 160).notNullable();
            t.specificType('created_by_role', 'custom_creator_role').notNullable();
            t.uuid('created_by_id').references('id').inTable('auth_users').onDelete('SET NULL');
            t.uuid('created_by_coach_id').references('id').inTable('coach_profiles').onDelete('SET NULL');
            t.boolean('is_editable_by_coach').notNullable().defaultTo(false);
            t.boolean('is_active').notNullable().defaultTo(true);
            t.integer('sort_order').notNullable().defaultTo(0);
            t.timestamps(true, true);
            t.timestamp('deleted_at');
            t.unique(['field_id', 'value']);
            t.index(['field_id', 'is_active']);
            t.index(['created_by_coach_id']);
        });
    }

    const hasValues = await knex.schema.hasTable('player_custom_values');
    if (!hasValues) {
        await knex.schema.createTable('player_custom_values', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('academy_id').notNullable().references('id').inTable('academy_academies').onDelete('CASCADE');
            t.uuid('player_id').notNullable().references('id').inTable('player_profiles').onDelete('CASCADE');
            t.uuid('field_id').notNullable().references('id').inTable('custom_fields').onDelete('CASCADE');
            t.text('value_text');
            t.text('value_long_text');
            t.integer('value_number');
            t.decimal('value_decimal', 14, 4);
            t.date('value_date');
            t.boolean('value_boolean');
            t.uuid('value_option_id').references('id').inTable('custom_field_options').onDelete('SET NULL');
            t.jsonb('value_json');
            t.uuid('created_by_id').references('id').inTable('auth_users').onDelete('SET NULL');
            t.uuid('updated_by_id').references('id').inTable('auth_users').onDelete('SET NULL');
            t.timestamps(true, true);
            t.unique(['player_id', 'field_id']);
            t.index(['academy_id', 'player_id']);
            t.index(['field_id']);
            t.index(['value_option_id']);
        });
    }
};

exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('player_custom_values');
    await knex.schema.dropTableIfExists('custom_field_options');
    await knex.schema.dropTableIfExists('custom_fields');
    await knex.schema.dropTableIfExists('custom_categories');
    await knex.raw(`
        DROP TYPE IF EXISTS custom_field_type;
        DROP TYPE IF EXISTS custom_visibility;
        DROP TYPE IF EXISTS custom_creator_role;
        DROP TYPE IF EXISTS custom_target_module;
    `);
};
