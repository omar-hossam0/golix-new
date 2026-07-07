class DataLifecycleRepository {
  constructor(db) {
    this.db = db;
  }

  tableExists(tableName) {
    return this.db.schema.hasTable(tableName);
  }

  columnExists(tableName, columnName) {
    return this.db.schema.hasColumn(tableName, columnName);
  }

  async createRun({
    runType,
    cutoffAt = null,
    batchSize,
    triggeredByUserId = null,
    metadata = {},
  }) {
    const [row] = await this.db("data_lifecycle_runs")
      .insert({
        run_type: runType,
        status: "running",
        cutoff_at: cutoffAt,
        batch_size: batchSize,
        triggered_by_user_id: triggeredByUserId,
        metadata,
      })
      .returning("*");
    return row;
  }

  async finishRun(runId, {
    status,
    archivedCounts = {},
    deletedCounts = {},
    error = null,
    metadata = {},
  }) {
    const [row] = await this.db("data_lifecycle_runs")
      .where({ id: runId })
      .update({
        status,
        archived_counts: archivedCounts,
        deleted_counts: deletedCounts,
        error,
        metadata,
        finished_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");
    return row;
  }

  latestRuns(limit = 10) {
    return this.db("data_lifecycle_runs")
      .orderBy("started_at", "desc")
      .limit(limit);
  }

  async estimatedRows(tableName) {
    const result = await this.db.raw(`
      SELECT COALESCE(c.reltuples, 0)::bigint AS estimated_rows
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relname = ?
         AND n.nspname = ANY (current_schemas(false))
       LIMIT 1
    `, [tableName]);
    return Math.max(0, Number(result.rows?.[0]?.estimated_rows || 0));
  }

  async selectIdsOlderThan({
    sourceTable,
    dateColumn,
    cutoffDate,
    batchSize,
    excludeLatestAiOutputs = false,
  }) {
    if (!(await this.tableExists(sourceTable))) return [];
    if (!(await this.columnExists(sourceTable, "id"))) return [];
    if (!(await this.columnExists(sourceTable, dateColumn))) return [];

    const query = this.db(sourceTable)
      .where(dateColumn, "<", cutoffDate)
      .orderBy(dateColumn, "asc")
      .limit(batchSize)
      .select("id");

    if (excludeLatestAiOutputs) {
      query.whereRaw(`
        id NOT IN (
          SELECT DISTINCT ON (player_id, type) id
            FROM ai_analyses
           ORDER BY player_id, type, created_at DESC
        )
      `);
    }

    const rows = await query;
    return rows.map((row) => row.id);
  }

  async moveRowsMatchingToArchive({
    sourceTable,
    archiveTable,
    whereColumn,
    values,
    archiveBatchId,
  }) {
    const uniqueValues = [...new Set((values || []).filter((value) => value !== undefined && value !== null))];
    if (!uniqueValues.length) return { archived: 0, deleted: 0 };
    if (!(await this.tableExists(sourceTable)) || !(await this.tableExists(archiveTable))) {
      return { archived: 0, deleted: 0 };
    }
    if (!(await this.columnExists(sourceTable, whereColumn))) return { archived: 0, deleted: 0 };

    const canDeduplicateById =
      await this.columnExists(sourceTable, "id") &&
      await this.columnExists(archiveTable, "id");

    return this.db.transaction(async (trx) => {
      const rows = await trx(sourceTable)
        .whereIn(whereColumn, uniqueValues)
        .select("*");

      if (!rows.length) return { archived: 0, deleted: 0 };

      const archivedAt = new Date();
      const archiveRows = rows.map((row) => ({
        ...row,
        archived_at: archivedAt,
        archive_batch_id: archiveBatchId,
      }));

      const insertQuery = trx(archiveTable).insert(archiveRows);
      if (canDeduplicateById) {
        await insertQuery.onConflict("id").ignore();
      } else {
        await insertQuery;
      }

      const deleted = await trx(sourceTable)
        .whereIn(whereColumn, uniqueValues)
        .del();

      return { archived: rows.length, deleted };
    });
  }

  async deleteRowsByIds({ tableName, ids }) {
    const uniqueIds = [...new Set((ids || []).filter(Boolean))];
    if (!uniqueIds.length || !(await this.tableExists(tableName))) return 0;
    return this.db(tableName).whereIn("id", uniqueIds).del();
  }

  async archiveChatMessages({ messageIds, archiveBatchId }) {
    const ids = [...new Set((messageIds || []).filter(Boolean))];
    if (!ids.length) {
      return {
        archived: 0,
        deleted: 0,
        archivedUserDeletions: 0,
        deletedUserDeletions: 0,
      };
    }
    if (!(await this.tableExists("chat_messages")) || !(await this.tableExists("chat_messages_archive"))) {
      return {
        archived: 0,
        deleted: 0,
        archivedUserDeletions: 0,
        deletedUserDeletions: 0,
      };
    }

    const hasUserDeletions = await this.tableExists("chat_message_user_deletions");
    const hasUserDeletionsArchive = await this.tableExists("chat_message_user_deletions_archive");

    return this.db.transaction(async (trx) => {
      const messages = await trx("chat_messages").whereIn("id", ids).select("*");
      const userDeletions = hasUserDeletions && hasUserDeletionsArchive
        ? await trx("chat_message_user_deletions").whereIn("message_id", ids).select("*")
        : [];

      if (!messages.length) {
        return {
          archived: 0,
          deleted: 0,
          archivedUserDeletions: 0,
          deletedUserDeletions: 0,
        };
      }

      const archivedAt = new Date();
      if (userDeletions.length) {
        await trx("chat_message_user_deletions_archive")
          .insert(userDeletions.map((row) => ({
            ...row,
            archived_at: archivedAt,
            archive_batch_id: archiveBatchId,
          })))
          .onConflict(["message_id", "user_id"])
          .ignore();
      }

      await trx("chat_messages_archive")
        .insert(messages.map((row) => ({
          ...row,
          archived_at: archivedAt,
          archive_batch_id: archiveBatchId,
        })))
        .onConflict("id")
        .ignore();

      const deletedUserDeletions = hasUserDeletions
        ? await trx("chat_message_user_deletions").whereIn("message_id", ids).del()
        : 0;
      const deleted = await trx("chat_messages").whereIn("id", ids).del();

      return {
        archived: messages.length,
        deleted,
        archivedUserDeletions: userDeletions.length,
        deletedUserDeletions,
      };
    });
  }
}

module.exports = DataLifecycleRepository;
