exports.up = async function up() {
    // Compatibility shim for databases that already recorded this pre-merge
    // migration name. The real schema lives in 071_chat_group_conversations.js.
};

exports.down = async function down() {
    // No-op: never drop chat group tables from this alias migration.
};
