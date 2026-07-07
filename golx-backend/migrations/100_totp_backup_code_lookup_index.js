exports.up = async function up(knex) {
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS auth_totp_backup_codes_unused_lookup_idx
        ON auth_totp_backup_codes (user_id, code_hash)
        WHERE is_used = false
    `);
};

exports.down = async function down(knex) {
    await knex.raw('DROP INDEX IF EXISTS auth_totp_backup_codes_unused_lookup_idx');
};
