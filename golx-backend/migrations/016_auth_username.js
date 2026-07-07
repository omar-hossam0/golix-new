/**
 * Add username login support for coach-created player and parent accounts.
 */
exports.up = async function (knex) {
    await knex.schema.alterTable('auth_users', (t) => {
        t.string('username', 80).unique();
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable('auth_users', (t) => {
        t.dropColumn('username');
    });
};
