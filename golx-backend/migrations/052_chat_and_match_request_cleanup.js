async function replaceMatchRequestForeignKey(knex, tableName, columnName, constraintName, onDelete) {
  const exists = await knex.schema.hasTable(tableName);
  if (!exists) return;

  const result = await knex.raw(
    `
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_attribute attr
        ON attr.attrelid = c.conrelid
       AND attr.attnum = ANY(c.conkey)
      WHERE rel.relname = ?
        AND attr.attname = ?
        AND c.contype = 'f'
      LIMIT 1
    `,
    [tableName, columnName],
  );
  const existingConstraint = result.rows?.[0]?.conname;
  if (existingConstraint) {
    await knex.raw("ALTER TABLE ?? DROP CONSTRAINT ??", [
      tableName,
      existingConstraint,
    ]);
  }

  await knex.raw(
    `ALTER TABLE ?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES matches(id) ON DELETE ${onDelete}`,
    [tableName, constraintName, columnName],
  );
}

exports.up = async function up(knex) {
  const hasFriendlyRequests = await knex.schema.hasTable("friendly_match_requests");
  const hasAdminMatchRequests = await knex.schema.hasTable("admin_match_coach_requests");

  if (hasFriendlyRequests) {
    await knex.raw(`
      DELETE FROM friendly_match_requests fmr
      WHERE fmr.converted_match_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM matches m
          WHERE m.id = fmr.converted_match_id
            AND m.deleted_at IS NULL
        )
    `);

    await replaceMatchRequestForeignKey(
      knex,
      "friendly_match_requests",
      "converted_match_id",
      "friendly_match_requests_converted_match_id_fk",
      "CASCADE",
    );
  }

  if (hasAdminMatchRequests) {
    await knex.raw(`
      DELETE FROM admin_match_coach_requests amcr
      WHERE amcr.status = 'accepted'
        AND (
          amcr.created_match_id IS NULL
          OR NOT EXISTS (
            SELECT 1
            FROM matches m
            WHERE m.id = amcr.created_match_id
              AND m.deleted_at IS NULL
          )
        )
    `);

    await replaceMatchRequestForeignKey(
      knex,
      "admin_match_coach_requests",
      "created_match_id",
      "admin_match_coach_requests_created_match_id_fk",
      "CASCADE",
    );
  }

  const hasChatConversations = await knex.schema.hasTable("chat_conversations");
  if (!hasChatConversations) {
    await knex.schema.createTable("chat_conversations", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.uuid("academy_id")
        .notNullable()
        .references("id")
        .inTable("academy_academies")
        .onDelete("CASCADE");
      t.string("type", 40).notNullable();
      t.string("status", 20).notNullable().defaultTo("open");
      t.uuid("admin_user_id").references("id").inTable("auth_users").onDelete("SET NULL");
      t.uuid("coach_user_id").references("id").inTable("auth_users").onDelete("SET NULL");
      t.uuid("player_user_id").references("id").inTable("auth_users").onDelete("SET NULL");
      t.uuid("coach_id").references("id").inTable("coach_profiles").onDelete("SET NULL");
      t.uuid("player_id").references("id").inTable("player_profiles").onDelete("SET NULL");
      t.uuid("opened_by_user_id").references("id").inTable("auth_users").onDelete("SET NULL");
      t.uuid("closed_by_user_id").references("id").inTable("auth_users").onDelete("SET NULL");
      t.timestamp("closed_at");
      t.timestamp("last_message_at");
      t.timestamps(true, true);

      t.index(["academy_id", "type", "status"]);
      t.index("admin_user_id");
      t.index("coach_user_id");
      t.index("player_user_id");
      t.index("coach_id");
      t.index("player_id");
      t.index("last_message_at");
    });

    await knex.raw(`
      ALTER TABLE chat_conversations
      ADD CONSTRAINT chat_conversations_type_check
      CHECK (type IN ('admin_coach', 'coach_player', 'admin_player_session'))
    `);
    await knex.raw(`
      ALTER TABLE chat_conversations
      ADD CONSTRAINT chat_conversations_status_check
      CHECK (status IN ('open', 'closed'))
    `);
    await knex.raw(`
      CREATE UNIQUE INDEX chat_admin_coach_open_pair_idx
        ON chat_conversations (academy_id, admin_user_id, coach_user_id)
        WHERE type = 'admin_coach' AND status = 'open'
    `);
    await knex.raw(`
      CREATE UNIQUE INDEX chat_coach_player_open_pair_idx
        ON chat_conversations (academy_id, coach_user_id, player_user_id)
        WHERE type = 'coach_player' AND status = 'open'
    `);
    await knex.raw(`
      CREATE UNIQUE INDEX chat_admin_player_open_session_idx
        ON chat_conversations (academy_id, admin_user_id, player_user_id)
        WHERE type = 'admin_player_session' AND status = 'open'
    `);
  }

  const hasChatMessages = await knex.schema.hasTable("chat_messages");
  if (!hasChatMessages) {
    await knex.schema.createTable("chat_messages", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.uuid("conversation_id")
        .notNullable()
        .references("id")
        .inTable("chat_conversations")
        .onDelete("CASCADE");
      t.uuid("academy_id")
        .notNullable()
        .references("id")
        .inTable("academy_academies")
        .onDelete("CASCADE");
      t.uuid("sender_user_id").references("id").inTable("auth_users").onDelete("SET NULL");
      t.text("body");
      t.text("attachment_url");
      t.string("attachment_original_name", 255);
      t.string("attachment_mime_type", 80);
      t.integer("attachment_size");
      t.timestamps(true, true);
      t.timestamp("deleted_at");

      t.index(["conversation_id", "created_at"]);
      t.index(["academy_id", "created_at"]);
      t.index("sender_user_id");
    });

    await knex.raw(`
      ALTER TABLE chat_messages
      ADD CONSTRAINT chat_messages_content_check
      CHECK (
        NULLIF(BTRIM(COALESCE(body, '')), '') IS NOT NULL
        OR attachment_url IS NOT NULL
      )
    `);
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("chat_messages");
  await knex.schema.dropTableIfExists("chat_conversations");

  await replaceMatchRequestForeignKey(
    knex,
    "friendly_match_requests",
    "converted_match_id",
    "friendly_match_requests_converted_match_id_foreign",
    "SET NULL",
  );
  await replaceMatchRequestForeignKey(
    knex,
    "admin_match_coach_requests",
    "created_match_id",
    "admin_match_coach_requests_created_match_id_foreign",
    "SET NULL",
  );
};
