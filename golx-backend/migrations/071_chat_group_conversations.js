async function setConversationTypeConstraint(knex, allowedTypes) {
  await knex.raw(
    "ALTER TABLE ?? DROP CONSTRAINT IF EXISTS ??",
    ["chat_conversations", "chat_conversations_type_check"],
  );
  await knex.raw(`
    ALTER TABLE chat_conversations
    ADD CONSTRAINT chat_conversations_type_check
    CHECK (type IN (${allowedTypes.map((type) => `'${type}'`).join(", ")}))
  `);
}

exports.up = async function up(knex) {
  const hasConversations = await knex.schema.hasTable("chat_conversations");
  if (!hasConversations) return;

  await setConversationTypeConstraint(knex, [
    "admin_coach",
    "coach_player",
    "admin_player_session",
    "chat_group",
  ]);

  const hasGroupConversations =
    await knex.schema.hasTable("chat_group_conversations");
  if (!hasGroupConversations) {
    await knex.schema.createTable("chat_group_conversations", (t) => {
      t.uuid("conversation_id")
        .primary()
        .references("id")
        .inTable("chat_conversations")
        .onDelete("CASCADE");
      t.string("name", 120).notNullable();
      t.uuid("created_by_user_id")
        .references("id")
        .inTable("auth_users")
        .onDelete("SET NULL");
      t.timestamps(true, true);
    });
  }

  const hasGroupMembers = await knex.schema.hasTable("chat_group_members");
  if (!hasGroupMembers) {
    await knex.schema.createTable("chat_group_members", (t) => {
      t.uuid("conversation_id")
        .notNullable()
        .references("id")
        .inTable("chat_conversations")
        .onDelete("CASCADE");
      t.uuid("user_id")
        .notNullable()
        .references("id")
        .inTable("auth_users")
        .onDelete("CASCADE");
      t.string("role", 20).notNullable().defaultTo("member");
      t.uuid("added_by_user_id")
        .references("id")
        .inTable("auth_users")
        .onDelete("SET NULL");
      t.timestamps(true, true);

      t.primary(["conversation_id", "user_id"]);
      t.index("user_id");
    });

    await knex.raw(`
      ALTER TABLE chat_group_members
      ADD CONSTRAINT chat_group_members_role_check
      CHECK (role IN ('owner', 'member'))
    `);
  }
};

exports.down = async function down(knex) {
  const hasConversations = await knex.schema.hasTable("chat_conversations");
  if (hasConversations) {
    await knex("chat_conversations").where({ type: "chat_group" }).delete();
  }

  await knex.schema.dropTableIfExists("chat_group_members");
  await knex.schema.dropTableIfExists("chat_group_conversations");

  if (hasConversations) {
    await setConversationTypeConstraint(knex, [
      "admin_coach",
      "coach_player",
      "admin_player_session",
    ]);
  }
};
