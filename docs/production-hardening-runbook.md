# Goalix Production Hardening Runbook

This runbook keeps the current product behavior, roles, permissions, and workflows intact. The only intentional user-flow change is MFA enforcement for admins and coaches.

## Deployment Target

- Target: Docker on a VPS or VM.
- Entry point: `docker-compose.prod.yml`.
- Public edge: `nginx` serves the Next.js frontend and load balances `api-1` and `api-2` for `/api`, `/uploads`, and `/socket.io`.
- Background processing: `worker-1` and `worker-2` run BullMQ outside the API process.
- Realtime: Socket.IO uses sticky load balancing plus the Redis adapter, so events can move between API instances.

Required production environment:

- `NODE_ENV=production`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `JWT_ACTIVE_KID`
- `COOKIE_SECRET`
- `TOTP_ENCRYPTION_KEY`
- `CSRF_SECRET`
- `QR_ATTENDANCE_SECRET`
- `MFA_ENFORCED_ROLES=admin,coach`
- `CORS_ORIGINS=https://your-real-app-domain.example`

Production startup intentionally fails if `CSRF_SECRET` is missing, if `JWT_SECRET` and `JWT_REFRESH_SECRET` match, or if `CORS_ORIGINS` contains localhost/development origins.

Recommended database/runtime guards:

- Put PgBouncer or managed connection pooling between API instances and PostgreSQL before scaling beyond one API instance.
- Keep `DB_POOL_MAX` small per API process, usually `8-12`, and scale API instances horizontally through the load balancer.
- `DB_APPLICATION_NAME=goalix-api`
- `DB_STATEMENT_TIMEOUT_MS=30000`
- `DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS=10000`
- `DB_LOCK_TIMEOUT_MS=5000`

Background automations:

- In production, keep `BULLMQ_WORKERS_ENABLED=false` in API containers.
- Keep `REDIS_REQUIRED=true` and `QUEUE_REDIS_FAILURE_MODE=throw` in production so queue loss is visible instead of silently skipped.
- Prefer enabling `BACKGROUND_AUTOMATIONS_ENABLED=true` and `INJURY_RISK_AUTOMATION_ENABLED=true` on worker containers only.
- Automations use Redis locks, so duplicate worker/API instances should not run the same scheduled task at the same time.
- `NOTIFICATION_CLEANUP_ENABLED=true` archives old notification data according to `NOTIFICATION_RETENTION_MONTHS`, then removes it from hot storage.
- `DATA_LIFECYCLE_ENABLED=true` runs the broader archive job for audit logs, AI history, chat messages, and realtime outbox rows. Keep it enabled on one worker/background process, with `DATA_LIFECYCLE_INTERVAL_HOURS=24` and `DATA_LIFECYCLE_BATCH_SIZE=1000` unless staging data proves another value is needed.

For S3-compatible upload storage:

- `STORAGE_PROVIDER=s3`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- Optional: `S3_ENDPOINT`, `S3_REGION`

For metrics:

- `METRICS_ENABLED=true`
- `METRICS_TOKEN`
- Scrape `GET /metrics` with `Authorization: Bearer <METRICS_TOKEN>`.

## Backups

- Install PostgreSQL client tools on the host or backup runner.
- Set `DATABASE_URL` and `BACKUP_DIR`.
- Run `npm run backup:db` from `golx-backend`.
- Store both the `.dump` and `.sha256` files outside the application server.
- Restore drills should use `pg_restore --clean --if-exists --no-owner --dbname <target_db> <dump_file>`.
- If the database is too damaged for the app to open Settings, restore from the backend host or backup runner with `CONFIRM_RESTORE="RESTORE GOALIX" npm run restore:db -- <dump_file>`.
- In Docker production, the worker can run scheduled backups when `BACKUP_AUTOMATION_ENABLED=true`; keep `goalix-backups` copied or synced to off-server storage.
- The admin Settings restore button is disabled in production unless `BACKUP_RESTORE_ENABLED=true`, and still requires admin password plus the confirmation phrase.

## First Admin Bootstrap

When migrations exist but all data has been wiped, create the initial academy owner from a trusted shell or CI secret context:

```bash
cd golx-backend
BOOTSTRAP_ADMIN_EMAIL=owner@example.com \
BOOTSTRAP_ADMIN_USERNAME=admin \
BOOTSTRAP_ADMIN_PASSWORD='StrongPass#123' \
BOOTSTRAP_ACADEMY_NAME='Goalix Academy' \
npm run bootstrap:admin
```

The command seeds the IAM permission catalog, creates the academy if none exists, creates or updates the academy owner, links the IAM role, and leaves MFA disabled so the first admin login is forced into MFA setup before full admin access. It refuses to run if another active admin exists unless `BOOTSTRAP_ADMIN_ALLOW_EXISTING=true` is set deliberately for recovery.

## Health Checks

- `GET /health` is lightweight and only confirms the process is alive.
- `GET /ready` checks PostgreSQL and Redis.
- PostgreSQL failure returns HTTP 503.
- Redis failure returns HTTP 200 with `status=degraded` because Redis/cache/queue should not take down normal API browsing.

## Backups and Disaster Recovery

Default targets:

- RPO: 15 minutes.
- RTO: 2 hours.

PostgreSQL:

- Enable WAL archiving or a managed equivalent.
- Run encrypted full backups at least daily.
- Retain point-in-time recovery logs according to academy data retention requirements.
- Store backups outside the VPS.

Redis:

- Enable AOF for queue/realtime resilience.
- Back up the Redis volume or managed Redis snapshots.

Monthly restore drill:

1. Restore the latest encrypted PostgreSQL backup to a clean database.
2. Restore Redis AOF or start with an empty Redis if queues can be replayed safely.
3. Run backend migrations.
4. Run smoke tests for login, player profile, rankings, chat, notifications, and uploads.
5. Record restore duration and compare it against the 2 hour RTO.

## SQL Dumps

Do not use production SQL dumps directly in development or handover.

Use:

```bash
cd golx-backend
node scripts/sanitize-sql-dump.js ../private/prod.sql ../private/prod.sanitized.sql
```

The sanitizer masks emails, phone numbers, password hashes, TOTP secrets, tokens, addresses, and common name columns in plain SQL and `COPY ... FROM stdin` dumps. For highly sensitive handover work, prefer restoring into an isolated database and exporting a purpose-built anonymized dataset.

Before committing:

```bash
npm run security:scan-dumps
```

## Secret Rotation

JWT rotation:

1. Generate a new `JWT_SECRET` and set a new `JWT_ACTIVE_KID`.
2. Move the old active secret into `JWT_SECRET_PREVIOUS`.
3. Deploy.
4. Wait longer than `JWT_ACCESS_EXPIRY`.
5. Remove `JWT_SECRET_PREVIOUS`.

Refresh token rotation follows the same process with `JWT_REFRESH_SECRET_PREVIOUS`, but wait longer than `JWT_REFRESH_EXPIRY`.

TOTP:

- `TOTP_ENCRYPTION_KEY` must remain stable while encrypted TOTP secrets exist.
- Rotate it with a controlled re-encryption job, not by replacing the env var directly.

## Upload Storage

Chat images and assignment files go through the storage adapter:

- Development default: local `golx-backend/uploads`.
- Production: S3-compatible bucket via `STORAGE_PROVIDER=s3`.

Files are served through `/uploads/...` so permission checks remain enforced. Do not expose the bucket directly. Archive old objects with bucket lifecycle policies, but keep links resolvable through the app unless a product data-retention decision explicitly says otherwise.

## Data Lifecycle

Use `docs/data-lifecycle.md` for the detailed archive and partitioning policy.

Recommended production flow:

1. Run `npm run data:lifecycle:report`.
2. Run `npm run data:lifecycle:dry-run`.
3. Review `data_lifecycle_runs`.
4. Enable `DATA_LIFECYCLE_ENABLED=true` on a worker/background process only.
5. Monitor hot table sizes, archive table sizes, and p95 read latency.

Partitioning should be a separate migration per table after a table reaches `5M` rows or p95 read latency remains above `800ms` after indexes.

## Authorization Hardening

Sensitive access checks should go through `src/shared/access-policy.js` and deny by default. Access denials for parent visibility, chat, attachments, and AI surfaces should write structured audit rows when possible.

## Realtime Safety

Chat writes are DB-first. Important events are recorded in `realtime_outbox` with:

- `id` as `eventId`
- `sequence`
- `event_type`
- `entity_type`
- `entity_id`
- `occurred_at`

Clients should dedupe socket events by `eventId`. Message send retries can pass `clientMessageId` to receive the same existing message instead of creating duplicates.
