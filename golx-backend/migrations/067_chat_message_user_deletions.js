exports.up = async function up(knex) {
  const hasMessages = await knex.schema.hasTable("chat_messages");
  if (!hasMessages) return;

  const hasTable = await knex.schema.hasTable("chat_message_user_deletions");
  if (!hasTable) {
    await knex.schema.createTable("chat_message_user_deletions", (t) => {
      t.uuid("message_id")
        .notNullable()
        .references("id")
        .inTable("chat_messages")
        .onDelete("CASCADE");
      t.uuid("user_id")
        .notNullable()
        .references("id")
        .inTable("auth_users")
        .onDelete("CASCADE");
      t.timestamp("created_at").defaultTo(knex.fn.now());

      t.primary(["message_id", "user_id"]);
      t.index("user_id");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("chat_message_user_deletions");
};
