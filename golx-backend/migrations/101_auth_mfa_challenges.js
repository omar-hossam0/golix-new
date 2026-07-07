exports.up = async function up(knex) {
    const exists = await knex.schema.hasTable('auth_mfa_challenges');
    if (exists) return;

    await knex.schema.createTable('auth_mfa_challenges', (t) => {
        t.uuid('id').primary();
        t.uuid('user_id').notNullable().references('id').inTable('auth_users').onDelete('CASCADE');
        t.timestamp('expires_at').notNullable();
        t.timestamp('consumed_at').nullable();
        t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        t.index(['user_id', 'expires_at'], 'auth_mfa_challenges_user_expires_idx');
    });
};

exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('auth_mfa_challenges');
};
