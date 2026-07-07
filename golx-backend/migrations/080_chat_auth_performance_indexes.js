const indexes = [
  {
    table: "academy_academies",
    sql: `
    CREATE INDEX IF NOT EXISTS academy_academies_public_profile_idx
    ON academy_academies (created_at ASC)
    WHERE deleted_at IS NULL
  `,
  },
  {
    table: "auth_refresh_tokens",
    sql: `
    CREATE INDEX IF NOT EXISTS auth_refresh_tokens_user_access_active_idx
    ON auth_refresh_tokens (user_id, access_jti, expires_at)
    WHERE is_revoked = false
  `,
  },
  {
    table: "iam_user_roles",
    sql: `
    CREATE INDEX IF NOT EXISTS iam_user_roles_user_academy_active_idx
    ON iam_user_roles (user_id, academy_id, role_id)
    WHERE revoked_at IS NULL
  `,
  },
  {
    table: "iam_role_permissions",
    sql: `
    CREATE INDEX IF NOT EXISTS iam_role_permissions_role_permission_idx
    ON iam_role_permissions (role_id, permission_id)
  `,
  },
  {
    table: "chat_conversations",
    sql: `
    CREATE INDEX IF NOT EXISTS chat_conversations_admin_last_idx
    ON chat_conversations (academy_id, admin_user_id, last_message_at DESC NULLS LAST, created_at DESC)
    WHERE admin_user_id IS NOT NULL
  `,
  },
  {
    table: "chat_conversations",
    sql: `
    CREATE INDEX IF NOT EXISTS chat_conversations_coach_last_idx
    ON chat_conversations (academy_id, coach_user_id, last_message_at DESC NULLS LAST, created_at DESC)
    WHERE coach_user_id IS NOT NULL
  `,
  },
  {
    table: "chat_conversations",
    sql: `
    CREATE INDEX IF NOT EXISTS chat_conversations_player_last_idx
    ON chat_conversations (academy_id, player_user_id, last_message_at DESC NULLS LAST, created_at DESC)
    WHERE player_user_id IS NOT NULL
  `,
  },
  {
    table: "chat_conversations",
    sql: `
    CREATE INDEX IF NOT EXISTS chat_conversations_parent_last_idx
    ON chat_conversations (academy_id, parent_user_id, last_message_at DESC NULLS LAST, created_at DESC)
    WHERE parent_user_id IS NOT NULL
  `,
  },
  {
    table: "chat_group_members",
    sql: `
    CREATE INDEX IF NOT EXISTS chat_group_members_user_conversation_idx
    ON chat_group_members (user_id, conversation_id)
  `,
  },
  {
    table: "chat_group_members",
    sql: `
    CREATE INDEX IF NOT EXISTS chat_group_members_conversation_created_idx
    ON chat_group_members (conversation_id, created_at)
  `,
  },
  {
    table: "chat_messages",
    sql: `
    CREATE INDEX IF NOT EXISTS chat_messages_conversation_created_active_idx
    ON chat_messages (conversation_id, created_at DESC)
    WHERE deleted_at IS NULL
  `,
  },
  {
    table: "chat_messages",
    sql: `
    CREATE INDEX IF NOT EXISTS chat_messages_attachment_active_idx
    ON chat_messages (attachment_url)
    WHERE attachment_url IS NOT NULL AND deleted_at IS NULL
  `,
  },
  {
    table: "match_tactics",
    sql: `
    CREATE INDEX IF NOT EXISTS match_tactics_match_idx
    ON match_tactics (match_id)
  `,
  },
  {
    table: "match_squads",
    sql: `
    CREATE INDEX IF NOT EXISTS match_squads_match_player_idx
    ON match_squads (match_id, player_id)
  `,
  },
  {
    table: "calendar_event_groups",
    sql: `
    CREATE INDEX IF NOT EXISTS calendar_event_groups_event_group_idx
    ON calendar_event_groups (event_id, group_id)
  `,
  },
  {
    table: "calendar_event_birth_years",
    sql: `
    CREATE INDEX IF NOT EXISTS calendar_event_birth_years_event_birth_year_idx
    ON calendar_event_birth_years (event_id, birth_year_id)
  `,
  },
];

exports.up = async function up(knex) {
  for (const { table, sql } of indexes) {
    if (await knex.schema.hasTable(table)) {
      await knex.raw(sql);
    }
  }
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS calendar_event_birth_years_event_birth_year_idx;
    DROP INDEX IF EXISTS calendar_event_groups_event_group_idx;
    DROP INDEX IF EXISTS match_squads_match_player_idx;
    DROP INDEX IF EXISTS match_tactics_match_idx;
    DROP INDEX IF EXISTS chat_messages_attachment_active_idx;
    DROP INDEX IF EXISTS chat_messages_conversation_created_active_idx;
    DROP INDEX IF EXISTS chat_group_members_conversation_created_idx;
    DROP INDEX IF EXISTS chat_group_members_user_conversation_idx;
    DROP INDEX IF EXISTS chat_conversations_parent_last_idx;
    DROP INDEX IF EXISTS chat_conversations_player_last_idx;
    DROP INDEX IF EXISTS chat_conversations_coach_last_idx;
    DROP INDEX IF EXISTS chat_conversations_admin_last_idx;
    DROP INDEX IF EXISTS iam_role_permissions_role_permission_idx;
    DROP INDEX IF EXISTS iam_user_roles_user_academy_active_idx;
    DROP INDEX IF EXISTS auth_refresh_tokens_user_access_active_idx;
    DROP INDEX IF EXISTS academy_academies_public_profile_idx;
  `);
};
