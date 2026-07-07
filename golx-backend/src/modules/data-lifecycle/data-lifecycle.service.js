const env = require("../../config/env");

const PARTITION_ROW_THRESHOLD = 5_000_000;
const PARTITION_P95_THRESHOLD_MS = 800;
const DAY_MS = 24 * 60 * 60 * 1000;

function subtractMonths(date, months) {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() - months);
  return copy;
}

function subtractDays(date, days) {
  return new Date(date.getTime() - (days * DAY_MS));
}

const archivePolicies = [
  {
    key: "audit_logs",
    sourceTable: "audit_logs",
    archiveTable: "audit_logs_archive",
    dateColumn: "created_at",
    retentionMonths: 18,
  },
  {
    key: "ai_analyses",
    sourceTable: "ai_analyses",
    archiveTable: "ai_analyses_archive",
    dateColumn: "created_at",
    retentionMonths: 18,
    excludeLatestAiOutputs: true,
  },
  {
    key: "chat_messages",
    sourceTable: "chat_messages",
    archiveTable: "chat_messages_archive",
    dateColumn: "created_at",
    retentionMonths: 24,
  },
  {
    key: "realtime_outbox",
    sourceTable: "realtime_outbox",
    archiveTable: "realtime_outbox_archive",
    dateColumn: "occurred_at",
    retentionDays: 30,
  },
];

const purgePolicies = [
  {
    key: "auth_refresh_tokens",
    sourceTable: "auth_refresh_tokens",
    dateColumn: "expires_at",
    retentionDays: env.AUTH_EPHEMERAL_RETENTION_DAYS,
  },
  {
    key: "auth_password_resets",
    sourceTable: "auth_password_resets",
    dateColumn: "expires_at",
    retentionDays: env.AUTH_EPHEMERAL_RETENTION_DAYS,
  },
];

const partitionCandidates = [
  { table: "chat_messages", dateColumn: "created_at", strategy: "monthly" },
  { table: "notification_inbox", dateColumn: "created_at", strategy: "monthly" },
  { table: "audit_logs", dateColumn: "created_at", strategy: "monthly" },
  { table: "ai_analyses", dateColumn: "created_at", strategy: "monthly" },
  { table: "player_daily_ai_inputs", dateColumn: "input_date", strategy: "monthly" },
  { table: "event_attendance", dateColumn: "created_at", strategy: "monthly-or-yearly" },
  { table: "match_attendance", dateColumn: "created_at", strategy: "monthly-or-yearly" },
  { table: "ranking_snapshots", dateColumn: "period", strategy: "monthly-period" },
];

class DataLifecycleService {
  constructor(repository) {
    this.repo = repository;
  }

  _batchSize(batchSize) {
    return Number(batchSize || env.DATA_LIFECYCLE_BATCH_SIZE || 1000);
  }

  _policyCutoff(policy, now) {
    if (policy.retentionDays) return subtractDays(now, policy.retentionDays);
    return subtractMonths(now, policy.retentionMonths);
  }

  async _runPolicy(policy, {
    runId,
    now,
    batchSize,
    dryRun,
  }) {
    const cutoffDate = this._policyCutoff(policy, now);
    const ids = await this.repo.selectIdsOlderThan({
      sourceTable: policy.sourceTable,
      dateColumn: policy.dateColumn,
      cutoffDate,
      batchSize,
      excludeLatestAiOutputs: policy.excludeLatestAiOutputs,
    });

    const metadata = {
      cutoffDate: cutoffDate.toISOString(),
      selected: ids.length,
      dryRun,
      retentionMonths: policy.retentionMonths || null,
      retentionDays: policy.retentionDays || null,
    };

    if (dryRun || !ids.length) {
      return {
        archived: ids.length,
        deleted: 0,
        metadata,
      };
    }

    const moveResult = policy.key === "chat_messages"
      ? await this.repo.archiveChatMessages({
        messageIds: ids,
        archiveBatchId: runId,
      })
      : await this.repo.moveRowsMatchingToArchive({
        sourceTable: policy.sourceTable,
        archiveTable: policy.archiveTable,
        whereColumn: "id",
        values: ids,
        archiveBatchId: runId,
      });

    return {
      ...moveResult,
      metadata,
    };
  }

  async _runPurgePolicy(policy, {
    now,
    batchSize,
    dryRun,
  }) {
    const cutoffDate = this._policyCutoff(policy, now);
    const ids = await this.repo.selectIdsOlderThan({
      sourceTable: policy.sourceTable,
      dateColumn: policy.dateColumn,
      cutoffDate,
      batchSize,
    });

    const metadata = {
      cutoffDate: cutoffDate.toISOString(),
      selected: ids.length,
      dryRun,
      retentionDays: policy.retentionDays,
      disposition: "delete",
    };

    if (dryRun || !ids.length) {
      return { deleted: 0, metadata };
    }

    const deleted = await this.repo.deleteRowsByIds({
      tableName: policy.sourceTable,
      ids,
    });
    return { deleted, metadata };
  }

  async archiveNotifications({
    now = new Date(),
    retentionMonths = env.NOTIFICATION_RETENTION_MONTHS,
    batchSize = this._batchSize(),
    triggeredByUserId = null,
    dryRun = false,
  } = {}) {
    const cutoffDate = subtractMonths(now, retentionMonths);
    const run = await this.repo.createRun({
      runType: "notification_cleanup",
      cutoffAt: cutoffDate,
      batchSize,
      triggeredByUserId,
      metadata: { retentionMonths, dryRun },
    });

    try {
      const notificationIds = await this.repo.selectIdsOlderThan({
        sourceTable: "notification_inbox",
        dateColumn: "created_at",
        cutoffDate,
        batchSize,
      });

      let logMove = { archived: 0, deleted: 0 };
      let inboxMove = { archived: notificationIds.length, deleted: 0 };

      if (!dryRun && notificationIds.length) {
        logMove = await this.repo.moveRowsMatchingToArchive({
          sourceTable: "notification_logs",
          archiveTable: "notification_logs_archive",
          whereColumn: "notification_id",
          values: notificationIds,
          archiveBatchId: run.id,
        });
        inboxMove = await this.repo.moveRowsMatchingToArchive({
          sourceTable: "notification_inbox",
          archiveTable: "notification_inbox_archive",
          whereColumn: "id",
          values: notificationIds,
          archiveBatchId: run.id,
        });
      }

      const archivedCounts = {
        notification_inbox: inboxMove.archived,
        notification_logs: logMove.archived,
      };
      const deletedCounts = {
        notification_inbox: inboxMove.deleted,
        notification_logs: logMove.deleted,
      };
      const finished = await this.repo.finishRun(run.id, {
        status: dryRun ? "dry_run_completed" : "completed",
        archivedCounts,
        deletedCounts,
        metadata: {
          retentionMonths,
          cutoffDate: cutoffDate.toISOString(),
          selectedNotifications: notificationIds.length,
          dryRun,
        },
      });

      return {
        run: finished,
        cutoffDate: cutoffDate.toISOString(),
        retentionMonths,
        archivedNotifications: inboxMove.archived,
        archivedLogs: logMove.archived,
        removedHotNotifications: inboxMove.deleted,
        removedHotLogs: logMove.deleted,
        // Kept for callers that only use this as a count of rows removed from hot storage.
        deletedNotifications: inboxMove.deleted,
        deletedLogs: logMove.deleted,
        dryRun,
      };
    } catch (err) {
      await this.repo.finishRun(run.id, {
        status: "failed",
        error: err.message,
        metadata: { retentionMonths, cutoffDate: cutoffDate.toISOString(), dryRun },
      });
      throw err;
    }
  }

  async runLifecycle({
    now = new Date(),
    batchSize = this._batchSize(),
    triggeredByUserId = null,
    dryRun = false,
  } = {}) {
    const run = await this.repo.createRun({
      runType: "data_lifecycle",
      batchSize,
      triggeredByUserId,
      metadata: { dryRun },
    });

    const archivedCounts = {};
    const deletedCounts = {};
    const policyMetadata = {};

    try {
      const notificationResult = await this.archiveNotifications({
        now,
        batchSize,
        triggeredByUserId,
        dryRun,
      });
      archivedCounts.notification_inbox = notificationResult.archivedNotifications;
      archivedCounts.notification_logs = notificationResult.archivedLogs;
      deletedCounts.notification_inbox = notificationResult.removedHotNotifications;
      deletedCounts.notification_logs = notificationResult.removedHotLogs;
      policyMetadata.notification_inbox = {
        cutoffDate: notificationResult.cutoffDate,
        retentionMonths: notificationResult.retentionMonths,
      };

      for (const policy of archivePolicies) {
        const result = await this._runPolicy(policy, {
          runId: run.id,
          now,
          batchSize,
          dryRun,
        });
        archivedCounts[policy.key] = result.archived;
        deletedCounts[policy.key] = result.deleted;
        if (policy.key === "chat_messages") {
          archivedCounts.chat_message_user_deletions = result.archivedUserDeletions || 0;
          deletedCounts.chat_message_user_deletions = result.deletedUserDeletions || 0;
        }
        policyMetadata[policy.key] = result.metadata;
      }

      for (const policy of purgePolicies) {
        const result = await this._runPurgePolicy(policy, {
          now,
          batchSize,
          dryRun,
        });
        deletedCounts[policy.key] = result.deleted;
        policyMetadata[policy.key] = result.metadata;
      }

      const finished = await this.repo.finishRun(run.id, {
        status: dryRun ? "dry_run_completed" : "completed",
        archivedCounts,
        deletedCounts,
        metadata: {
          dryRun,
          policies: policyMetadata,
          partitionThresholds: {
            rowThreshold: PARTITION_ROW_THRESHOLD,
            p95ReadMs: PARTITION_P95_THRESHOLD_MS,
          },
        },
      });

      return {
        run: finished,
        archivedCounts,
        removedHotCounts: deletedCounts,
        dryRun,
      };
    } catch (err) {
      await this.repo.finishRun(run.id, {
        status: "failed",
        archivedCounts,
        deletedCounts,
        error: err.message,
        metadata: { dryRun, policies: policyMetadata },
      });
      throw err;
    }
  }

  async status() {
    const [runs, archiveTables, partitions] = await Promise.all([
      this.repo.latestRuns(10),
      Promise.all([
        "notification_inbox_archive",
        "notification_logs_archive",
        "audit_logs_archive",
        "ai_analyses_archive",
        "chat_messages_archive",
        "chat_message_user_deletions_archive",
        "realtime_outbox_archive",
      ].map(async (table) => ({
        table,
        exists: await this.repo.tableExists(table),
        estimatedRows: await this.repo.tableExists(table) ? await this.repo.estimatedRows(table) : 0,
      }))),
      Promise.all(partitionCandidates.map(async (candidate) => {
        const exists = await this.repo.tableExists(candidate.table);
        const estimatedRows = exists ? await this.repo.estimatedRows(candidate.table) : 0;
        const hasDateColumn = exists
          ? await this.repo.columnExists(candidate.table, candidate.dateColumn)
          : false;
        return {
          ...candidate,
          exists,
          hasDateColumn,
          estimatedRows,
          rowThreshold: PARTITION_ROW_THRESHOLD,
          p95ReadThresholdMs: PARTITION_P95_THRESHOLD_MS,
          needsPartitionByRows: estimatedRows >= PARTITION_ROW_THRESHOLD,
        };
      })),
    ]);

    return {
      enabled: env.DATA_LIFECYCLE_ENABLED ?? false,
      intervalHours: env.DATA_LIFECYCLE_INTERVAL_HOURS,
      batchSize: env.DATA_LIFECYCLE_BATCH_SIZE,
      archiveTables,
      partitionCandidates: partitions,
      latestRuns: runs,
    };
  }
}

module.exports = DataLifecycleService;
module.exports.partitionCandidates = partitionCandidates;
module.exports.purgePolicies = purgePolicies;
module.exports.PARTITION_ROW_THRESHOLD = PARTITION_ROW_THRESHOLD;
module.exports.PARTITION_P95_THRESHOLD_MS = PARTITION_P95_THRESHOLD_MS;
