exports.up = async function up(knex) {
  const hasRealtimeOutbox = await knex.schema.hasTable("realtime_outbox");
  if (!hasRealtimeOutbox) {
    await knex.schema.createTable("realtime_outbox", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.bigIncrements("sequence").unique();
      t.string("event_type", 80).notNullable();
      t.string("entity_type", 80).notNullable();
      t.uuid("entity_id");
      t.uuid("academy_id");
      t.jsonb("payload").notNullable().defaultTo(knex.raw("'{}'::jsonb"));
      t.timestamp("occurred_at").notNullable().defaultTo(knex.fn.now());
      t.timestamp("published_at");
      t.timestamps(true, true);

      t.index(["event_type", "occurred_at"]);
      t.index(["entity_type", "entity_id"]);
      t.index(["published_at", "sequence"]);
    });
  }

  if (await knex.schema.hasTable("chat_messages")) {
    const hasClientMessageId = await knex.schema.hasColumn("chat_messages", "client_message_id");
    if (!hasClientMessageId) {
      await knex.schema.alterTable("chat_messages", (t) => {
        t.string("client_message_id", 120);
      });
    }
    await knex.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_client_message_unique_idx
      ON chat_messages (conversation_id, sender_user_id, client_message_id)
      WHERE client_message_id IS NOT NULL
    `);
  }
};

exports.down = async function down(knex) {
  await knex.raw("DROP INDEX IF EXISTS chat_messages_client_message_unique_idx");
  if (await knex.schema.hasColumn("chat_messages", "client_message_id")) {
    await knex.schema.alterTable("chat_messages", (t) => {
      t.dropColumn("client_message_id");
    });
  }
  await knex.schema.dropTableIfExists("realtime_outbox");
};
