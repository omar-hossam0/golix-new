# Goalix Refactor Audit

## Current Architecture

- Frontend: Next.js 16 App Router with React 19, Redux Toolkit, RTK Query-style API modules, and role dashboards under `app/admin`, `app/coach`, `app/player`, and `app/parent`.
- Backend: Express.js API in `golx-backend/src`, with route/controller/service/repository modules and Knex/PostgreSQL persistence.
- Realtime and jobs: Socket.IO chat, Redis, BullMQ queues, background worker entrypoints, and Docker production composition.
- Auth: JWT/cookie based sessions, refresh tokens, CSRF protection, MFA for enforced roles, and role-specific login paths.

## Role and Login Contracts

- Admin and coach login remain separated through `/admin-login` on the frontend and `/api/v1/auth/admin/login` on the backend.
- Player and parent login remain through `/login` on the frontend and `/api/v1/auth/login` on the backend.
- Existing RBAC helpers remain the source of permission enforcement: `authMiddleware`, `rbac`, `rbacAny`, and `restrictTo`.

## Role Panel Boundaries

- `/admin-login` is the shared staff login surface for admin and coach accounts only. Keeping coaches here is intentional.
- `/admin/*` is the admin panel. It must render only for authenticated `admin` users and redirects other roles to their own home route.
- `/coach/*` is the coach portal. It must render only for authenticated `coach` users and redirects unauthenticated users to `/admin-login`.
- `/player/*` and `/parent/*` are public-account portals. They must render only for their matching roles and redirect unauthenticated users to `/login`.
- `ROLE_ROUTES` is the frontend source of truth for post-login role redirects:
  - `admin -> /admin/dashboard`
  - `coach -> /coach/home`
  - `player -> /player/home`
  - `parent -> /parent/home`
- Backend auth boundaries are enforced by `allowedRoles`:
  - `/api/v1/auth/admin/login` allows only `admin` and `coach`.
  - `/api/v1/auth/login` allows only `player` and `parent`.
- Legacy backend aliases `/api/admin`, `/api/coach`, `/api/player`, and `/api/parent` exist for compatibility only. New frontend/backend work should prefer `/api/v1/*` routes unless a compatibility task explicitly requires an alias.

## Backend Module Map

- `auth`: registration, split login, refresh/logout, MFA, password reset.
- `academy`: academy profile, branches, groups, birth years.
- `players`: player CRUD, measurements, injuries, guardian/parent-related fields.
- `coaches`: coach CRUD, assignment roles, coach-scoped operations, uploaded assignment files.
- `calendar`: large workflow module for schedules, matches, parent links, rankings inputs, assignments, and role portals.
- `chat`: conversations, messages, attachments, read receipts, realtime metadata.
- `rankings`: weekly/monthly/player ranking reads and recalculation.
- `payments`, `notifications`, `attendance`, `ai`, `custom-data`, `admin`: supporting product modules.

## Production Hardening Already Present

- `/health` lightweight liveness and `/ready` PostgreSQL/Redis readiness.
- Redis-degraded behavior for app startup and readiness.
- Socket.IO Redis adapter support.
- Storage adapter for local/S3-compatible uploads.
- CSRF double-submit middleware and origin checks.
- JWT active/previous secret support.
- TOTP app-level encryption support.
- Realtime outbox and `clientMessageId` chat idempotency.
- Docker/VPS production composition and backup/runbook documentation.

## Risk Areas

- Auth cookies, CSRF, MFA setup, refresh tokens, and split login paths.
- Parent-child visibility across profile, ranking, chat, attachments, notifications, and AI.
- Coach access when inactive or unassigned.
- Ranking weekly/monthly period boundaries and model-output consistency.
- Chat delivery ordering, duplicate messages, read receipts, and attachment authorization.
- `calendar.service.js`, because it owns many workflows and should be refactored only in small tested slices.

## Refactor Direction

- First tranche: move dependency wiring and route mounting out of `app.js` without changing route order, middleware order, controllers, services, or response contracts.
- Future tranches should add characterization tests before each behavior-preserving cleanup.
- Database changes must be additive migrations only, and only after query evidence shows a safe index or race-condition fix is needed.
