exports.up = async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  const hasParentPlayerLinks = await knex.schema.hasTable("parent_player_links");
  if (!hasParentPlayerLinks) {
    await knex.schema.createTable("parent_player_links", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.uuid("academy_id")
        .notNullable()
        .references("id")
        .inTable("academy_academies")
        .onDelete("CASCADE");
      t.uuid("parent_user_id")
        .notNullable()
        .references("id")
        .inTable("auth_users")
        .onDelete("CASCADE");
      t.uuid("player_id")
        .notNullable()
        .references("id")
        .inTable("player_profiles")
        .onDelete("CASCADE");
      t.string("relation", 60).notNullable().defaultTo("guardian");
      t.boolean("is_primary").notNullable().defaultTo(false);
      t.boolean("can_view_progress").notNullable().defaultTo(true);
      t.boolean("can_view_payments").notNullable().defaultTo(true);
      t.boolean("can_message_coach").notNullable().defaultTo(true);
      t.uuid("created_by_user_id")
        .references("id")
        .inTable("auth_users")
        .onDelete("SET NULL");
      t.timestamp("deleted_at");
      t.timestamps(true, true);

      t.index(["academy_id", "parent_user_id"]);
      t.index(["academy_id", "player_id"]);
      t.index("created_by_user_id");
    });
  }

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS parent_player_links_active_pair_idx
      ON parent_player_links (parent_user_id, player_id)
      WHERE deleted_at IS NULL
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS parent_player_links_one_primary_idx
      ON parent_player_links (parent_user_id)
      WHERE deleted_at IS NULL AND is_primary = true
  `);

  await knex.raw(`
    INSERT INTO parent_player_links (
      academy_id,
      parent_user_id,
      player_id,
      relation,
      is_primary,
      created_by_user_id,
      created_at,
      updated_at
    )
    SELECT
      pp.academy_id,
      au.id,
      au.linked_player_id,
      'guardian',
      true,
      au.id,
      COALESCE(au.created_at, CURRENT_TIMESTAMP),
      CURRENT_TIMESTAMP
    FROM auth_users au
    JOIN player_profiles pp
      ON pp.id = au.linked_player_id
     AND pp.deleted_at IS NULL
    WHERE au.role = 'parent'
      AND au.linked_player_id IS NOT NULL
      AND au.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
          FROM parent_player_links ppl
         WHERE ppl.parent_user_id = au.id
           AND ppl.player_id = au.linked_player_id
           AND ppl.deleted_at IS NULL
      )
  `);

  const hasParentPlayerNotes = await knex.schema.hasTable("parent_player_notes");
  if (!hasParentPlayerNotes) {
    await knex.schema.createTable("parent_player_notes", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.uuid("academy_id")
        .notNullable()
        .references("id")
        .inTable("academy_academies")
        .onDelete("CASCADE");
      t.uuid("parent_user_id")
        .notNullable()
        .references("id")
        .inTable("auth_users")
        .onDelete("CASCADE");
      t.uuid("player_id")
        .notNullable()
        .references("id")
        .inTable("player_profiles")
        .onDelete("CASCADE");
      t.uuid("coach_user_id")
        .references("id")
        .inTable("auth_users")
        .onDelete("SET NULL");
      t.string("category", 40).notNullable().defaultTo("general");
      t.string("title", 160);
      t.text("body").notNullable();
      t.string("visibility", 40).notNullable().defaultTo("parent_and_coach");
      t.string("status", 30).notNullable().defaultTo("new");
      t.text("coach_response");
      t.uuid("responded_by_user_id")
        .references("id")
        .inTable("auth_users")
        .onDelete("SET NULL");
      t.timestamp("responded_at");
      t.timestamp("deleted_at");
      t.timestamps(true, true);

      t.index(["academy_id", "player_id", "created_at"]);
      t.index(["academy_id", "parent_user_id", "created_at"]);
      t.index(["academy_id", "coach_user_id", "status"]);
    });
  }

  await knex.raw(`
    ALTER TABLE parent_player_notes
    DROP CONSTRAINT IF EXISTS parent_player_notes_visibility_check
  `);
  await knex.raw(`
    ALTER TABLE parent_player_notes
    ADD CONSTRAINT parent_player_notes_visibility_check
    CHECK (visibility IN ('coach_only', 'parent_and_coach', 'player_and_parent', 'family'))
  `);
  await knex.raw(`
    ALTER TABLE parent_player_notes
    DROP CONSTRAINT IF EXISTS parent_player_notes_status_check
  `);
  await knex.raw(`
    ALTER TABLE parent_player_notes
    ADD CONSTRAINT parent_player_notes_status_check
    CHECK (status IN ('new', 'reviewed', 'resolved'))
  `);

  const hasParentUserId = await knex.schema.hasColumn(
    "chat_conversations",
    "parent_user_id",
  );
  if (!hasParentUserId) {
    await knex.schema.alterTable("chat_conversations", (t) => {
      t.uuid("parent_user_id")
        .references("id")
        .inTable("auth_users")
        .onDelete("SET NULL");
      t.index("parent_user_id");
    });
  }

  await knex.raw(`
    ALTER TABLE chat_conversations
    DROP CONSTRAINT IF EXISTS chat_conversations_type_check
  `);
  await knex.raw(`
    ALTER TABLE chat_conversations
    ADD CONSTRAINT chat_conversations_type_check
    CHECK (type IN ('admin_coach', 'coach_player', 'admin_player_session', 'chat_group', 'parent_coach'))
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS chat_parent_coach_player_open_pair_idx
      ON chat_conversations (academy_id, parent_user_id, coach_user_id, player_id)
      WHERE type = 'parent_coach' AND status = 'open'
  `);
};

exports.down = async function down(knex) {
  await knex.raw("DROP INDEX IF EXISTS chat_parent_coach_player_open_pair_idx");
  await knex.raw(`
    ALTER TABLE chat_conversations
    DROP CONSTRAINT IF EXISTS chat_conversations_type_check
  `);
  await knex.raw(`
    ALTER TABLE chat_conversations
    ADD CONSTRAINT chat_conversations_type_check
    CHECK (type IN ('admin_coach', 'coach_player', 'admin_player_session'))
  `);

  const hasParentUserId = await knex.schema.hasColumn(
    "chat_conversations",
    "parent_user_id",
  );
  if (hasParentUserId) {
    await knex.schema.alterTable("chat_conversations", (t) => {
      t.dropColumn("parent_user_id");
    });
  }

  await knex.schema.dropTableIfExists("parent_player_notes");
  await knex.raw("DROP INDEX IF EXISTS parent_player_links_one_primary_idx");
  await knex.raw("DROP INDEX IF EXISTS parent_player_links_active_pair_idx");
  await knex.schema.dropTableIfExists("parent_player_links");
};
