exports.up = async function up(knex) {
    const hasDateJoined = await knex.schema.hasColumn('player_profiles', 'date_joined');

    if (!hasDateJoined) {
        await knex.schema.alterTable('player_profiles', (t) => {
            t.date('date_joined');
            t.index('date_joined');
        });

        await knex('player_profiles')
            .whereNull('date_joined')
            .update({ date_joined: knex.raw('created_at::date') });
    }
};

exports.down = async function down(knex) {
    const hasDateJoined = await knex.schema.hasColumn('player_profiles', 'date_joined');

    if (hasDateJoined) {
        await knex.schema.alterTable('player_profiles', (t) => {
            t.dropColumn('date_joined');
        });
    }
};
