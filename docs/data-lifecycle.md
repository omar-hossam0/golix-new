# Goalix Data Lifecycle

Goalix uses archive-first retention for large time-series tables. Old rows move out of hot tables into archive tables inside a single database transaction, then the hot rows are removed only after the archive insert succeeds.

## Runtime Controls

Backend env vars:

- `DATA_LIFECYCLE_ENABLED=false` by default; set `true` on one worker/background process.
- `DATA_LIFECYCLE_INTERVAL_HOURS=24`
- `DATA_LIFECYCLE_BATCH_SIZE=1000`
- `NOTIFICATION_RETENTION_MONTHS=4`

Manual commands:

```bash
cd golx-backend
npm run data:lifecycle:report
npm run data:lifecycle:dry-run
npm run data:lifecycle:run
```

Admin API:

- `GET /api/v1/admin/data-lifecycle/status`
- `POST /api/v1/admin/data-lifecycle/run` with `{ "dryRun": true }` or `{ "dryRun": false }`

## Archive Tables

Archive tables mirror the hot table structure and add:

- `archived_at`
- `archive_batch_id`

Current archive tables:

- `notification_inbox_archive`
- `notification_logs_archive`
- `audit_logs_archive`
- `ai_analyses_archive`
- `chat_messages_archive`
- `chat_message_user_deletions_archive`
- `realtime_outbox_archive`

## Retention Policy

- Notifications: `NOTIFICATION_RETENTION_MONTHS`, default 4 months.
- Audit logs: 18 months.
- AI analyses: 18 months, while preserving the latest AI output per player and model type in hot storage.
- Chat messages: 24 months.
- Realtime outbox: 30 days.
- Expired refresh tokens and password-reset records: permanently deleted after
  `AUTH_EPHEMERAL_RETENTION_DAYS`, default 30 days. Authentication artifacts are
  not copied to archive tables.

Normal reads keep using hot tables. Archive reads are additive through `includeArchive=true` where supported, and chat scrolls can include archived rows when requesting older messages.

## Partitioning Decision

Partitioning stays as a separate migration per table. The row threshold is an
operational review alert, not an automatic partition command. Activate it only
after normal query and index work when multiple signals justify the extra
complexity:

- A time-series table exceeds the `5M`-row review threshold and keeps growing.
- The table or its indexes reach tens of GB.
- Retention deletes, vacuum, or WAL generation become operationally expensive.
- p95 read latency stays above `800ms` for date-filtered reads.

Candidates:

- `chat_messages` by `created_at`, monthly.
- `notification_inbox` by `created_at`, monthly.
- `audit_logs` by `created_at`, monthly.
- `ai_analyses` by `created_at`, monthly.
- `player_daily_ai_inputs` by `input_date`, monthly.
- `event_attendance` / `match_attendance` by `created_at`, monthly or yearly depending on volume.
- `ranking_snapshots` by monthly period.

Queries against partitioned tables must include date or period filters so PostgreSQL can prune partitions.

Archive tables remain inside the primary database, so they reduce hot-query
cost but do not cap backup size. Before archives become large, export immutable
periods to encrypted object storage with row counts, checksums, schema version,
and a tested restore procedure. Final deletion periods require product/legal
approval.

## Storage Lifecycle

For production S3-compatible storage, use bucket lifecycle policies to move old upload objects to cheaper storage classes. Keep downloads routed through Goalix `/uploads/...` so permission checks remain enforced.
