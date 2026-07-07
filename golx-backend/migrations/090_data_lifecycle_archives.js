const archivePairs = [
  ["notification_inbox", "notification_inbox_archive", "created_at"],
  ["notification_logs", "notification_logs_archive", "created_at"],
  ["audit_logs", "audit_logs_archive", "created_at"],
  ["ai_analyses", "ai_analyses_archive", "created_at"],
  ["chat_messages", "chat_messages_archive", "created_at"],
  ["realtime_outbox", "realtime_outbox_archive", "occurred_at"],
];

const timeSeriesIndexes = [
  {
    table: "notification_inbox",
    columns: ["user_id", "created_at"],
    sql: `
      CREATE INDEX IF NOT EXISTS notification_inbox_user_created_idx
      ON notification_inbox (user_id, created_at DESC)
    `,
  },
  {
    table: "notification_inbox",
    columns: ["created_at"],
    sql: `
      CREATE INDEX IF NOT EXISTS notification_inbox_created_idx
      ON notification_inbox (created_at)
    `,
  },
  {
    table: "audit_logs",
    columns: ["created_at"],
    sql: `
      CREATE INDEX IF NOT EXISTS audit_logs_created_id_idx
      ON audit_logs (created_at DESC, id DESC)
    `,
  },
  {
    table: "ai_analyses",
    columns: ["player_id", "type", "created_at"],
    sql: `
      CREATE INDEX IF NOT EXISTS ai_analyses_player_type_created_idx
      ON ai_analyses (player_id, type, created_at DESC)
    `,
  },
  {
    table: "chat_messages",
    columns: ["created_at"],
    sql: `
      CREATE INDEX IF NOT EXISTS chat_messages_created_idx
      ON chat_messages (created_at)
    `,
  },
  {
    table: "realtime_outbox",
    columns: ["occurred_at"],
    sql: `
      CREATE INDEX IF NOT EXISTS realtime_outbox_occurred_idx
      ON realtime_outbox (occurred_at)
    `,
  },
  {
    table: "event_attendance",
    columns: ["created_at"],
    sql: `
      CREATE INDEX IF NOT EXISTS event_attendance_created_idx
      ON event_attendance (created_at)
    `,
  },
  {
    table: "match_attendance",
    columns: ["created_at"],
    sql: `
      CREATE INDEX IF NOT EXISTS match_attendance_created_idx
      ON match_attendance (created_at)
    `,
  },
  {
    table: "ranking_snapshots",
    columns: ["period", "calculated_at"],
    sql: `
      CREATE INDEX IF NOT EXISTS ranking_snapshots_period_calculated_idx
      ON ranking_snapshots (period, calculated_at DESC)
    `,
  },
];

async function tableHasColumns(knex, table, columns) {
  if (!(await knex.schema.hasTable(table))) return false;
  for (const column of columns) {
    if (!(await knex.schema.hasColumn(table, column))) return false;
  }
  return true;
}

async function addColumnIfMissing(knex, table, column, addColumn) {
  if (await knex.schema.hasColumn(table, column)) return;
  await knex.schema.alterTable(table, (t) => addColumn(t));
}

async function createArchiveTable(knex, sourceTable, archiveTable, dateColumn) {
  if (!(await knex.schema.hasTable(sourceTable))) return;

  if (!(await knex.schema.hasTable(archiveTable))) {
    await knex.raw(`CREATE TABLE ?? (LIKE ?? INCLUDING ALL)`, [archiveTable, sourceTable]);
  }

  await addColumnIfMissing(knex, archiveTable, "archived_at", (t) => {
    t.timestamp("archived_at").notNullable().defaultTo(knex.fn.now());
  });

  await addColumnIfMissing(knex, archiveTable, "archive_batch_id", (t) => {
    t.uuid("archive_batch_id")
      .references("id")
      .inTable("data_lifecycle_runs")
      .onDelete("SET NULL");
  });

  await knex.raw(`CREATE INDEX IF NOT EXISTS ?? ON ?? (archived_at DESC)`, [
    `${archiveTable}_archived_at_idx`,
    archiveTable,
  ]);
  await knex.raw(`CREATE INDEX IF NOT EXISTS ?? ON ?? (archive_batch_id)`, [
    `${archiveTable}_archive_batch_idx`,
    archiveTable,
  ]);

  if (await knex.schema.hasColumn(archiveTable, dateColumn)) {
    await knex.raw(`CREATE INDEX IF NOT EXISTS ?? ON ?? (?? DESC)`, [
      `${archiveTable}_${dateColumn}_idx`,
      archiveTable,
      dateColumn,
    ]);
  }
}

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("data_lifecycle_runs"))) {
    await knex.schema.createTable("data_lifecycle_runs", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      t.string("run_type", 80).notNullable();
      t.string("status", 30).notNullable().defaultTo("running");
      t.timestamp("started_at").notNullable().defaultTo(knex.fn.now());
      t.timestamp("finished_at");
      t.timestamp("cutoff_at");
      t.integer("batch_size").notNullable();
      t.jsonb("archived_counts").notNullable().defaultTo(knex.raw("'{}'::jsonb"));
      t.jsonb("deleted_counts").notNullable().defaultTo(knex.raw("'{}'::jsonb"));
      t.text("error");
      t.uuid("triggered_by_user_id")
        .references("id")
        .inTable("auth_users")
        .onDelete("SET NULL");
      t.jsonb("metadata").notNullable().defaultTo(knex.raw("'{}'::jsonb"));
      t.timestamps(true, true);

      t.index(["run_type", "started_at"]);
      t.index(["status", "started_at"]);
    });
  }

  for (const [sourceTable, archiveTable, dateColumn] of archivePairs) {
    await createArchiveTable(knex, sourceTable, archiveTable, dateColumn);
  }

  for (const { table, columns, sql } of timeSeriesIndexes) {
    if (await tableHasColumns(knex, table, columns)) {
      await knex.raw(sql);
    }
  }
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS ranking_snapshots_period_calculated_idx;
    DROP INDEX IF EXISTS match_attendance_created_idx;
    DROP INDEX IF EXISTS event_attendance_created_idx;
    DROP INDEX IF EXISTS realtime_outbox_occurred_idx;
    DROP INDEX IF EXISTS chat_messages_created_idx;
    DROP INDEX IF EXISTS ai_analyses_player_type_created_idx;
    DROP INDEX IF EXISTS audit_logs_created_id_idx;
    DROP INDEX IF EXISTS notification_inbox_created_idx;
    DROP INDEX IF EXISTS notification_inbox_user_created_idx;
  `);

  for (const [, archiveTable] of [...archivePairs].reverse()) {
    await knex.schema.dropTableIfExists(archiveTable);
  }

  await knex.schema.dropTableIfExists("data_lifecycle_runs");
};
