exports.up = async function up(knex) {
  const hasMessages = await knex.schema.hasTable("chat_messages");
  if (!hasMessages) return;

  const [hasDeliveredAt, hasReadAt] = await Promise.all([
    knex.schema.hasColumn("chat_messages", "delivered_at"),
    knex.schema.hasColumn("chat_messages", "read_at"),
  ]);

  await knex.schema.alterTable("chat_messages", (t) => {
    if (!hasDeliveredAt) t.timestamp("delivered_at");
    if (!hasReadAt) t.timestamp("read_at");
  });

  if (!hasDeliveredAt) {
    await knex("chat_messages")
      .whereNull("delivered_at")
      .update({ delivered_at: knex.ref("created_at") });
  }

  await knex.schema.alterTable("chat_messages", (t) => {
    if (!hasDeliveredAt) t.index("delivered_at");
    if (!hasReadAt) t.index("read_at");
  });
};

exports.down = async function down(knex) {
  const hasMessages = await knex.schema.hasTable("chat_messages");
  if (!hasMessages) return;

  const [hasDeliveredAt, hasReadAt] = await Promise.all([
    knex.schema.hasColumn("chat_messages", "delivered_at"),
    knex.schema.hasColumn("chat_messages", "read_at"),
  ]);

  await knex.schema.alterTable("chat_messages", (t) => {
    if (hasDeliveredAt) {
      t.dropIndex("delivered_at");
      t.dropColumn("delivered_at");
    }
    if (hasReadAt) {
      t.dropIndex("read_at");
      t.dropColumn("read_at");
    }
  });
};
