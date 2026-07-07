exports.up = async function up(knex) {
    const hasIsActive = await knex.schema.hasColumn('player_profiles', 'is_active');

    if (!hasIsActive) {
        await knex.schema.alterTable('player_profiles', (t) => {
            t.boolean('is_active').notNullable().defaultTo(true);
            t.index('is_active');
        });
    }
};

exports.down = async function down(knex) {
    const hasIsActive = await knex.schema.hasColumn('player_profiles', 'is_active');

    if (hasIsActive) {
        await knex.schema.alterTable('player_profiles', (t) => {
            t.dropColumn('is_active');
        });
    }
};
