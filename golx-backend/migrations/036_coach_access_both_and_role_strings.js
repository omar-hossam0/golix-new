exports.up = async function up(knex) {
    await knex.raw(`
        ALTER TABLE coach_branch_access_rules
        DROP CONSTRAINT IF EXISTS coach_branch_access_rules_access_type_check
    `);
    await knex.raw(`
        ALTER TABLE coach_branch_access_rules
        ADD CONSTRAINT coach_branch_access_rules_access_type_check
        CHECK (access_type IN ('groups', 'birth_years', 'both'))
    `);

    await knex.raw('ALTER TABLE coach_branch_access_rules ALTER COLUMN role DROP DEFAULT');
    await knex.raw('ALTER TABLE coach_branch_access_rules ALTER COLUMN role TYPE varchar(100) USING role::text');
    await knex.raw(`
        ALTER TABLE coach_branch_access_rules
        ALTER COLUMN role SET DEFAULT 'assistant_coach'
    `);

    await knex.raw('ALTER TABLE coach_group_assignments ALTER COLUMN role DROP DEFAULT');
    await knex.raw('ALTER TABLE coach_group_assignments ALTER COLUMN role TYPE varchar(100) USING role::text');
    await knex.raw(`
        ALTER TABLE coach_group_assignments
        ALTER COLUMN role SET DEFAULT 'assistant_coach'
    `);
};

exports.down = async function down(knex) {
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
