# Goalix Production Readiness Audit

## Current Architecture

- Frontend: Next.js App Router with role dashboards for admin, coach, player, and parent.
- Backend: Express API with module services/repositories, Knex/PostgreSQL, Redis cache/BullMQ workers, Socket.IO realtime, JWT/cookie auth, CSRF, and RBAC.
- Production target: Docker/VPS with separate API and worker processes, Redis-degraded API behavior, and S3-compatible object storage support.

## Safety Baseline

- Auth flows remain split: `/admin-login` for admin/coach and `/login` for player/parent.
- MFA is enforced for admin/coach roles and managed from settings, with primary devices protected from deletion.
- Redis is optional for API readiness: `/ready` returns `degraded` when Redis is unavailable but Postgres is healthy.
- Chat writes are DB-first, support `clientMessageId` idempotency, and create realtime outbox events.
- Slow request and slow query logging are available through environment thresholds.

## Current Hardening Gaps

- Authorization is highest risk because player, parent, coach, chat, attachments, rankings, and AI visibility overlap.
- File access must go through `/uploads/*`; direct local disk paths or public buckets must not be exposed in production.
- Heavy ranking/calendar pages still need staged pagination and snapshot reads as data grows.
- Load testing for 10k+ active users must run on staging-like infrastructure, not local development.

## Applied Hardening Direction

- Centralize sensitive access decisions in `access-policy` and audit denied access without revealing record existence.
- Record new upload metadata in `media_files` with academy, scope, uploader, storage key, MIME type, size, and sensitivity.
- Keep legacy upload URLs working through the proxy while new uploads become metadata-backed.
- Add only additive performance indexes that match existing query filters/order clauses.

## Production Defaults

- Use `STORAGE_PROVIDER=s3` with `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`.
- Keep `BCRYPT_ROUNDS >= 12`, unique production `COOKIE_SECRET`, strong JWT secrets, and `TOTP_ENCRYPTION_KEY`.
- Keep API workers separate from BullMQ workers in production.
- Backup target: RPO 15 minutes, RTO 120 minutes, with restore drills before launch.
