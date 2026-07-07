require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

const jsonOutput = process.argv.includes("--json");
const strict = process.argv.includes("--strict");

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,
    application_name: "goalix-db-audit",
  });

  await client.connect();
  try {
    const overview = await client.query(`
        SELECT
          current_database() AS database,
          current_setting('server_version') AS server_version,
          pg_database_size(current_database())::bigint AS database_bytes,
          (SELECT count(*)::int FROM pg_tables WHERE schemaname = 'public') AS tables,
          (SELECT count(*)::int FROM pg_indexes WHERE schemaname = 'public') AS indexes,
          (
            SELECT count(*)::int
              FROM pg_constraint
             WHERE contype = 'f'
               AND connamespace = 'public'::regnamespace
          ) AS foreign_keys
      `);
    const settings = await client.query(`
        SELECT name, setting, unit
          FROM pg_settings
         WHERE name IN (
           'max_connections',
           'shared_buffers',
           'effective_cache_size',
           'work_mem',
           'autovacuum',
           'track_io_timing',
           'shared_preload_libraries'
         )
         ORDER BY name
      `);
    const invalidIndexes = await client.query(`
        SELECT indexrelid::regclass::text AS index_name,
               indrelid::regclass::text AS table_name,
               indisvalid,
               indisready
          FROM pg_index
         WHERE (NOT indisvalid OR NOT indisready)
           AND indrelid IN (
             SELECT oid
               FROM pg_class
              WHERE relnamespace = 'public'::regnamespace
           )
         ORDER BY table_name, index_name
      `);
    const unvalidatedConstraints = await client.query(`
        SELECT conrelid::regclass::text AS table_name,
               conname AS constraint_name,
               contype AS constraint_type
          FROM pg_constraint
         WHERE NOT convalidated
           AND connamespace = 'public'::regnamespace
         ORDER BY table_name, constraint_name
      `);
    const tablesWithoutPrimaryKeys = await client.query(`
        SELECT tablename AS table_name
          FROM pg_tables t
         WHERE schemaname = 'public'
           AND tablename NOT IN ('knex_migrations', 'knex_migrations_lock')
           AND NOT EXISTS (
             SELECT 1
               FROM pg_constraint c
              WHERE c.conrelid = ('public.' || quote_ident(tablename))::regclass
                AND c.contype = 'p'
           )
         ORDER BY tablename
      `);
    const duplicateIndexes = await client.query(`
        WITH index_shapes AS (
          SELECT
            i.indrelid,
            i.indexrelid,
            i.indisprimary,
            i.indisunique,
            concat_ws(
              '|',
              i.indkey::text,
              i.indclass::text,
              i.indcollation::text,
              i.indoption::text,
              COALESCE(pg_get_expr(i.indexprs, i.indrelid), ''),
              COALESCE(pg_get_expr(i.indpred, i.indrelid), '')
            ) AS shape
          FROM pg_index i
          JOIN pg_class t ON t.oid = i.indrelid
          WHERE t.relnamespace = 'public'::regnamespace
            AND t.relkind IN ('r', 'p')
        ),
        duplicate_shapes AS (
          SELECT indrelid, shape
            FROM index_shapes
           GROUP BY indrelid, shape
          HAVING count(*) > 1
        )
        SELECT s.indrelid::regclass::text AS table_name,
               array_agg(
                 s.indexrelid::regclass::text
                 ORDER BY s.indisprimary DESC, s.indisunique DESC, s.indexrelid::regclass::text
               ) AS index_names
          FROM index_shapes s
          JOIN duplicate_shapes d
            ON d.indrelid = s.indrelid
           AND d.shape = s.shape
         GROUP BY s.indrelid, s.shape
         ORDER BY table_name
      `);
    const missingForeignKeyIndexes = await client.query(`
        SELECT
          c.conrelid::regclass::text AS table_name,
          c.conname AS constraint_name,
          array_agg(a.attname ORDER BY u.ordinality) AS columns
        FROM pg_constraint c
        CROSS JOIN LATERAL unnest(c.conkey)
          WITH ORDINALITY AS u(attnum, ordinality)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = u.attnum
        WHERE c.contype = 'f'
          AND c.connamespace = 'public'::regnamespace
          AND NOT EXISTS (
            SELECT 1
              FROM pg_index i
             WHERE i.indrelid = c.conrelid
               AND i.indisvalid
               AND i.indisready
               AND (i.indkey::smallint[])[0:cardinality(c.conkey) - 1] = c.conkey
          )
        GROUP BY c.conrelid, c.conname
        ORDER BY table_name, constraint_name
      `);
    const highDeadTupleTables = await client.query(`
        SELECT relname AS table_name,
               n_live_tup::bigint AS estimated_live_rows,
               n_dead_tup::bigint AS estimated_dead_rows,
               round(
                 100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0),
                 2
               ) AS dead_percent,
               last_autovacuum,
               last_autoanalyze
          FROM pg_stat_user_tables
         WHERE n_dead_tup >= 100
            OR n_dead_tup > n_live_tup * 0.1
         ORDER BY n_dead_tup DESC
         LIMIT 20
      `);
    const largestRelations = await client.query(`
        SELECT c.relname AS relation_name,
               CASE c.relkind WHEN 'i' THEN 'index' ELSE 'table' END AS relation_type,
               pg_total_relation_size(c.oid)::bigint AS total_bytes
          FROM pg_class c
         WHERE c.relnamespace = 'public'::regnamespace
           AND c.relkind IN ('r', 'i')
         ORDER BY pg_total_relation_size(c.oid) DESC
         LIMIT 20
      `);
    const installedExtensions = await client.query(
      "SELECT extname, extversion FROM pg_extension ORDER BY extname",
    );
    const appliedMigrations = await client.query(
      "SELECT name FROM knex_migrations ORDER BY id",
    );

    const migrationsDirectory = path.resolve(__dirname, "../migrations");
    const migrationFiles = fs
      .readdirSync(migrationsDirectory)
      .filter((file) => file.endsWith(".js"))
      .sort();
    const applied = new Set(appliedMigrations.rows.map((row) => row.name));

    const report = {
      generatedAt: new Date().toISOString(),
      overview: overview.rows[0],
      migrations: {
        files: migrationFiles.length,
        applied: applied.size,
        pending: migrationFiles.filter((file) => !applied.has(file)),
        missingFromFilesystem: [...applied]
          .filter((file) => !migrationFiles.includes(file))
          .sort(),
      },
      settings: Object.fromEntries(
        settings.rows.map((row) => [
          row.name,
          row.unit ? `${row.setting}${row.unit}` : row.setting,
        ]),
      ),
      extensions: installedExtensions.rows,
      integrity: {
        invalidIndexes: invalidIndexes.rows,
        unvalidatedConstraints: unvalidatedConstraints.rows,
        tablesWithoutPrimaryKeys: tablesWithoutPrimaryKeys.rows,
      },
      indexHealth: {
        exactDuplicateGroups: duplicateIndexes.rows,
        missingForeignKeyLeadingIndexes: missingForeignKeyIndexes.rows,
      },
      maintenance: {
        highDeadTupleTables: highDeadTupleTables.rows,
        largestRelations: largestRelations.rows,
      },
    };

    if (jsonOutput) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      const pgStatStatements = report.extensions.some(
        (extension) => extension.extname === "pg_stat_statements",
      );
      console.log("Goalix database architecture audit");
      console.log(
        `PostgreSQL ${report.overview.server_version} | ` +
        `${report.overview.tables} tables | ${report.overview.indexes} indexes | ` +
        `${report.overview.foreign_keys} foreign keys | ` +
        `${formatBytes(report.overview.database_bytes)}`,
      );
      console.log(
        `Migrations: ${report.migrations.applied}/${report.migrations.files} applied` +
        (report.migrations.pending.length
          ? `; pending: ${report.migrations.pending.join(", ")}`
          : "; no pending migrations"),
      );
      console.log(
        `Integrity: ${report.integrity.invalidIndexes.length} invalid indexes, ` +
        `${report.integrity.unvalidatedConstraints.length} unvalidated constraints, ` +
        `${report.integrity.tablesWithoutPrimaryKeys.length} tables without primary keys`,
      );
      console.log(
        `Index review: ${report.indexHealth.exactDuplicateGroups.length} exact duplicate groups, ` +
        `${report.indexHealth.missingForeignKeyLeadingIndexes.length} foreign keys without a leading index`,
      );
      console.log(
        `Observability: pg_stat_statements ${pgStatStatements ? "enabled" : "not installed"}; ` +
        `track_io_timing=${report.settings.track_io_timing}`,
      );
      if (report.maintenance.highDeadTupleTables.length) {
        console.log(
          `Dead tuples need attention: ${report.maintenance.highDeadTupleTables
            .slice(0, 5)
            .map((row) => `${row.table_name} (${row.dead_percent || 0}%)`)
            .join(", ")}`,
        );
      }
    }

    const hardFailures =
      report.integrity.invalidIndexes.length +
      report.integrity.unvalidatedConstraints.length +
      report.integrity.tablesWithoutPrimaryKeys.length +
      report.migrations.pending.length +
      report.migrations.missingFromFilesystem.length;
    if (strict && hardFailures > 0) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unit = units[0];
  for (let i = 1; i < units.length && size >= 1024; i += 1) {
    size /= 1024;
    unit = units[i];
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${unit}`;
}

run().catch((error) => {
  console.error(`Database audit failed: ${error.message}`);
  process.exitCode = 1;
});
