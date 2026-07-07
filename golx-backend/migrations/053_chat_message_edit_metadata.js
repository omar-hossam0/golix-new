exports.up = async function up(knex) {
  const hasMessages = await knex.schema.hasTable("chat_messages");
  if (!hasMessages) return;

  const hasEditedAt = await knex.schema.hasColumn("chat_messages", "edited_at");
  const hasDeletedBy = await knex.schema.hasColumn(
    "chat_messages",
    "deleted_by_user_id",
  );

  await knex.schema.alterTable("chat_messages", (t) => {
    if (!hasEditedAt) t.timestamp("edited_at");
    if (!hasDeletedBy) {
      t.uuid("deleted_by_user_id")
        .references("id")
        .inTable("auth_users")
        .onDelete("SET NULL");
    }
  });

  if (!hasEditedAt) {
    await knex.schema.alterTable("chat_messages", (t) => {
      t.index("edited_at");
    });
  }
};

exports.down = async function down(knex) {
  const hasMessages = await knex.schema.hasTable("chat_messages");
  if (!hasMessages) return;

  const hasEditedAt = await knex.schema.hasColumn("chat_messages", "edited_at");
  const hasDeletedBy = await knex.schema.hasColumn(
    "chat_messages",
    "deleted_by_user_id",
  );

  await knex.schema.alterTable("chat_messages", (t) => {
    if (hasEditedAt) {
      t.dropIndex("edited_at");
      t.dropColumn("edited_at");
    }
    if (hasDeletedBy) {
      t.dropColumn("deleted_by_user_id");
    }
  });
};
