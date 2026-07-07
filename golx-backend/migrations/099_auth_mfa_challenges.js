exports.up = async function up(knex) {
    await knex.schema.createTable('auth_mfa_challenges', (t) => {
        t.uuid('id').primary();
        t.uuid('user_id')
            .notNullable()
            .references('id')
            .inTable('auth_users')
            .onDelete('CASCADE');
        t.timestamp('expires_at').notNullable();
        t.timestamp('consumed_at').nullable();
        t.timestamps(true, true);
        t.index(['expires_at']);
    });
};

exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('auth_mfa_challenges');
};
