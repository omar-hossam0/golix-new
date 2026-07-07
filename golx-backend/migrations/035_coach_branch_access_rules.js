/**
 * Coach branch access rules.
 *
 * These rules are the admin-facing source of truth for assigning a coach to a
 * branch by explicit groups or by birth-year ranges. Existing
 * coach_group_assignments remains the compatibility/runtime table used by
 * coach portal queries.
 */
exports.up = async function up(knex) {
    const hasRules = await knex.schema.hasTable('coach_branch_access_rules');
    if (!hasRules) {
        await knex.schema.createTable('coach_branch_access_rules', (t) => {
            t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            t.uuid('coach_id').notNullable().references('id').inTable('coach_profiles').onDelete('CASCADE');
            t.uuid('branch_id').notNullable().references('id').inTable('academy_branches').onDelete('CASCADE');
            t.string('access_type', 30).notNullable();
            t.boolean('all_groups').notNullable().defaultTo(false);
            t.boolean('all_birth_years').notNullable().defaultTo(false);
            t.specificType('role', 'coach_group_role').notNullable().defaultTo('assistant');
            t.uuid('assigned_by_admin_id').references('id').inTable('auth_users').onDelete('SET NULL');
            t.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
            t.timestamps(true, true);
            t.unique(['coach_id', 'branch_id']);
            t.index(['branch_id', 'access_type']);
        });
    }

    const hasRuleGroups = await knex.schema.hasTable('coach_access_rule_groups');
    if (!hasRuleGroups) {
        await knex.schema.createTable('coach_access_rule_groups', (t) => {
            t.uuid('rule_id').notNullable().references('id').inTable('coach_branch_access_rules').onDelete('CASCADE');
            t.uuid('group_id').notNullable().references('id').inTable('academy_groups').onDelete('CASCADE');
            t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            t.primary(['rule_id', 'group_id']);
            t.index('group_id');
        });
    }

    const hasRuleBirthYears = await knex.schema.hasTable('coach_access_rule_birth_years');
    if (!hasRuleBirthYears) {
        await knex.schema.createTable('coach_access_rule_birth_years', (t) => {
            t.uuid('rule_id').notNullable().references('id').inTable('coach_branch_access_rules').onDelete('CASCADE');
            t.uuid('birth_year_id').notNullable().references('id').inTable('academy_birth_years').onDelete('CASCADE');
            t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            t.primary(['rule_id', 'birth_year_id']);
            t.index('birth_year_id');
        });
    }

    await knex.raw(`
        ALTER TABLE coach_branch_access_rules
        DROP CONSTRAINT IF EXISTS coach_branch_access_rules_access_type_check
    `);
    await knex.raw(`
        ALTER TABLE coach_branch_access_rules
        ADD CONSTRAINT coach_branch_access_rules_access_type_check
        CHECK (access_type IN ('groups', 'birth_years'))
    `);
};

exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('coach_access_rule_birth_years');
    await knex.schema.dropTableIfExists('coach_access_rule_groups');
    await knex.raw('ALTER TABLE coach_branch_access_rules DROP CONSTRAINT IF EXISTS coach_branch_access_rules_access_type_check');
    await knex.schema.dropTableIfExists('coach_branch_access_rules');
};
