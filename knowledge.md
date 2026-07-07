# GOALIX — Project Knowledge

A web-based sports academy management platform: attendance, evaluations, rankings, payments, notifications, and AI-driven insights for admins, coaches, players, and parents.

This is a **monorepo-style** project with two apps in one tree:
- **Frontend** (project root): Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + Redux Toolkit / RTK Query.
- **Backend** (`golx-backend/`): Node.js + Express + Knex/PostgreSQL + Redis + BullMQ + Zod + JWT.

## Quickstart

Run from the **project root**:

```bash
# Install (run in BOTH directories — they have separate package.json files)
npm install
cd golx-backend && npm install && cd ..

# Run frontend (3001) and backend together
npm run dev

# Or run them individually
npm run dev:frontend   # next dev --webpack -p 3001
npm run dev:backend    # cd golx-backend && npm run dev (nodemon)

# Frontend build / start / lint
npm run build
npm run start
npm run lint           # eslint
```

Backend-only commands (run from `golx-backend/`):

```bash
npm run dev                  # nodemon src/server.js
npm start                    # node src/server.js
npm run worker               # background workers (BullMQ)

# Database (Knex)
npm run migrate
npm run migrate:rollback
npm run migrate:make <name>
npm run seed
npm run seed:make <name>

# Tests / Lint
npm test
npm run test:watch
npm run test:coverage
npm run lint
npm run lint:fix
```

Frontend dev server runs on **port 3001**. Backend default base URL is configured via `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3000`); API path prefix is `/api/v1`.

## Architecture

### Frontend (`/`)

- **Framework:** Next.js 16 App Router (note: `AGENTS.md` warns this version has breaking changes vs. older Next.js — read `node_modules/next/dist/docs/` before relying on training data).
- **Routes** (`app/`): organized by role.
  - `app/(auth)/` — login, forgot-password (auth route group)
  - `app/(admin)/` — admin route group
  - `app/admin/` — admin portal (academy, branches, groups, players, coaches, attendance, payments, rankings, reports, settings, notifications)
  - `app/coach/` — coach portal (home, my-groups, attendance, evaluations, schedule, measurements, rankings, players)
  - `app/player/` — player portal (home, profile, training, attendance, calendar, matches)
  - `app/parent/` — parent portal (home, calendar, matches, payments, notifications, schedule)
  - `app/dashboard/` — top-level dashboard
- **State / data fetching (`lib/store/`):**
  - Redux Toolkit store with slices: `auth`, `ui`.
  - **RTK Query APIs** are the canonical way to talk to the backend: `academyApi`, `dashboardApi`, `adminApi`, `coachApi`, `calendarApi`, `registrationsApi`.
  - `lib/store/api/baseQuery.ts` implements automatic JWT refresh: attaches Bearer token from `getAuthToken()`, on 401 calls `/auth/refresh` (single-flight via `refreshPromise`), retries the original request, or logs out on failure. `credentials: "include"` is set.
- **Auth:** `lib/auth/auth-context.tsx` provides the React context wrapper around the Redux auth slice.
- **Types & constants:** `lib/types.ts` (entities: `User`, `Academy`, `Branch`, `BirthYear`, `Group`, `Coach`, `Player`, `Parent`, `Session`, `AttendanceRecord`, `Evaluation`; enums: `UserRole`, `PlayerLevel`, `PaymentStatus`, `AttendanceStatus`, etc.) and `lib/constants.ts` (`ROLE_LABELS`, etc.).
- **UI:**
  - `components/ui/*` — shadcn-style primitives built on Radix (`button`, `card`, `dialog`, `dropdown-menu`, `select`, `tabs`, etc.).
  - `components/shared/*` — app-wide shared widgets (`DataTable`, `PageHeader`, `StatsCard`, `StatusBadge`, `ConfirmDialog`, `EmptyState`, `LoadingSkeleton`, `SearchInput`).
  - `components/layout/*` — `AdminHeader`, `AdminSidebar`, `PortalSidebar`.
  - `components/charts/*` — chart.js wrappers (`AreaChart`, `BarChart`, `DoughnutChart`, `LineChart`).
- **Styling:** Tailwind CSS v4 via `@tailwindcss/postcss`; global styles in `app/globals.css`. Use `cn()` from `lib/utils.ts` (clsx + tailwind-merge) to compose class names.
- **TS path alias:** `@/*` maps to project root (e.g. `@/components/ui/button`, `@/lib/store/api/adminApi`).
- **Mock data:** `lib/mock-data/index.ts` — being phased out as APIs come online. Prefer the RTK Query hooks in `lib/store/api/*` for new code.

### Backend (`golx-backend/`)

- **Entry:** `src/server.js` (HTTP) and `src/workers/index.js` (BullMQ workers).
- **App bootstrap:** `src/app.js` wires Express, middleware, and module routes.
- **Config:** `src/config/env.js` (reads `dotenv`).
- **Modules** (`src/modules/<feature>/`): each feature has `*.routes.js`, `*.controller.js`, `*.service.js`, `*.repository.js`, `*.schema.js` (Zod). Modules: `academy`, `admin`, `ai`, `attendance`, `auth`, `calendar`, `coaches`, `custom-data`, `notifications`, `payments`, `players`, `rankings`.
- **Infrastructure:** `src/infrastructure/` — `database.js` (Knex/pg), `redis.js`, `queue.js` (BullMQ), `storage.js`.
- **Cross-cutting middleware:** `src/middleware/` — `auth.middleware.js` (JWT), `rbac.middleware.js`, `validate.middleware.js` (Zod), `rateLimit.middleware.js`, `errorHandler.middleware.js`.
- **Shared utilities:** `src/shared/` — `api-response.js`, `base.repository.js`, `base.service.js`, `logger.js` (pino), `pagination.js`, `player-code.helper.js`.
- **Events:** `src/events/eventBus.js` for in-process event dispatch.
- **Workers:** `src/workers/` — `ai.worker.js`, `notification.worker.js`, `payment.worker.js`, `ranking.worker.js`.
- **DB migrations / seeds:** `golx-backend/migrations/` (numbered, e.g. `022_calendar_matches_training_system.js`) and `golx-backend/seeds/`. Configured via `knexfile.js`.
- **Containers:** `golx-backend/Dockerfile` and `docker-compose.yml`.

## Conventions

- **API endpoints:** prefixed with `/api/v1`. Always go through RTK Query slices, never `fetch` directly from components.
- **Auth tokens:** read/write via `lib/store/api/authToken.ts`; do not stash tokens elsewhere.
- **Validation:** Zod schemas live in each backend module's `*.schema.js` and run via `validate.middleware.js`.
- **Error responses:** use `api-response.js` helpers and let `errorHandler.middleware.js` format errors. Throw subclasses of the shared error types (e.g. `BadRequestError`).
- **Component patterns:** prefer `components/shared/*` (`DataTable`, `PageHeader`, `StatsCard`, etc.) over hand-rolled markup; admin pages already follow this pattern (see `app/admin/academy/branches/page.tsx`).
- **TypeScript:** `strict` is on; do not cast to `any`. Define entity types in `lib/types.ts` or co-located with the API slice that owns them.
- **Imports:** use the `@/` alias rather than long relative paths.
- **Role separation:** each portal (`admin`, `coach`, `player`, `parent`) is isolated under its own folder with its own layout. Login flow at `app/(auth)/login` is restricted to `player` / `parent`; coaches/admins use `/admin-login`.

## Gotchas

- **Two `package.json` files** — install dependencies in both root and `golx-backend/`. `npm run dev` at the root runs both via `concurrently`.
- **Frontend port is 3001**, backend default is 3000. If the backend runs elsewhere, set `NEXT_PUBLIC_API_URL` (the RTK base query appends `/api/v1`).
- **Next.js 16 + React 19 + Tailwind v4** are recent majors. Do not assume older Next.js APIs; check `node_modules/next/dist/docs/` (per `AGENTS.md`).
- **Windows shell:** the project lives at `D:\Goalix\goalix`. Use Windows-friendly commands (`dir`, `del`, `move`, `copy`, `findstr`) unless running in PowerShell or bash.
- **`next/image` warnings:** several auth pages set `style={{ width: "auto", height: "auto" }}` to silence the aspect-ratio warning when only one of `width`/`height` should drive layout — keep this when modifying `<Image>` usage.
- **Auth refresh is single-flight:** `baseQuery.ts` shares one refresh promise across concurrent 401s. Don't add ad-hoc refresh calls elsewhere.
- **Mock data is being replaced.** New admin pages should use RTK Query hooks (see how `app/admin/academy/birth-years/page.tsx` migrated from `mockBirthYears` to `useGetBirthYearsQuery`). Avoid introducing new imports from `lib/mock-data`.
- **Background jobs:** ranking, AI, payment, and notification work runs in BullMQ workers — start them with `npm run worker` in `golx-backend/` when testing those flows. Redis must be running.
- **Database migrations are ordered.** Always create new migrations with `npm run migrate:make <name>` from `golx-backend/` so numbering stays consistent.

## Where to start when…

- Adding an admin screen → mirror `app/admin/academy/branches/page.tsx`: `PageHeader` + `DataTable` + RTK Query hook + Dialog for create.
- Adding a backend endpoint → create/extend a module under `golx-backend/src/modules/<feature>/` (routes → controller → service → repository) with a Zod schema, then add a matching RTK Query endpoint in `lib/store/api/`.
- Adding a background job → enqueue from a service via `infrastructure/queue.js`, handle it in `src/workers/<feature>.worker.js`.
- Changing auth behavior → touch `lib/store/api/baseQuery.ts`, `lib/store/api/authToken.ts`, `lib/store/slices/authSlice.ts`, and backend `src/modules/auth/`.
