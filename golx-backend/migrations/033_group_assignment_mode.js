exports.up = async function up(knex) {
    await knex.transaction(async (trx) => {
        const hasAssignmentMode = await trx.schema.hasColumn('academy_groups', 'assignment_mode');
        if (!hasAssignmentMode) {
            await trx.schema.alterTable('academy_groups', (table) => {
                table.string('assignment_mode', 30).notNullable().defaultTo('birth_year');
            });
        }

        await trx('academy_groups')
            .whereNull('assignment_mode')
            .update({ assignment_mode: 'birth_year' });

        await trx.raw(`
            ALTER TABLE academy_groups
            DROP CONSTRAINT IF EXISTS academy_groups_assignment_mode_check
        `);
        await trx.raw(`
            ALTER TABLE academy_groups
            ADD CONSTRAINT academy_groups_assignment_mode_check
            CHECK (assignment_mode IN ('birth_year', 'players'))
        `);

        await trx.raw('CREATE INDEX IF NOT EXISTS idx_academy_groups_assignment_mode ON academy_groups(assignment_mode)');
        await trx.raw('CREATE INDEX IF NOT EXISTS idx_player_group_assignments_player_current ON player_group_assignments(player_id) WHERE left_at IS NULL');
    });
};

exports.down = async function down(knex) {
    await knex.transaction(async (trx) => {
        await trx.raw('DROP INDEX IF EXISTS idx_player_group_assignments_player_current');
        await trx.raw('DROP INDEX IF EXISTS idx_academy_groups_assignment_mode');
        await trx.raw('ALTER TABLE academy_groups DROP CONSTRAINT IF EXISTS academy_groups_assignment_mode_check');
        const hasAssignmentMode = await trx.schema.hasColumn('academy_groups', 'assignment_mode');
        if (hasAssignmentMode) {
            await trx.schema.alterTable('academy_groups', (table) => {
                table.dropColumn('assignment_mode');
            });
        }
    });
};
