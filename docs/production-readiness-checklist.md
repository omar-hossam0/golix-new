# Goalix Production Readiness Checklist

Use this checklist before handing Goalix to another machine, reviewer, or production environment.

## Required Gates

- `npm run lint`
- `npm run quality`
- `npm run build`
- `npm run backend:lint`
- `npm run backend:test`
- `npm run security:audit`
- `npm run test:e2e`

For the full local verification pass, run:

```bash
npm run verify
```

`npm run test:e2e` is intentionally separate because it starts the frontend dev server and requires the Playwright browser runtime.

## Git Handoff

- The worktree should be clean or split into reviewed commits before handoff.
- Do not commit database dumps, uploaded files, local backups, Playwright output, or model binaries.
- Model inference code can stay in git, but model weights/artifacts should be delivered through artifact storage or a release bundle with checksums.

## Production Environment

- `NODE_ENV=production`
- Strong unique values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `CSRF_SECRET`, and `QR_ATTENDANCE_SECRET`.
- `REDIS_REQUIRED=true`
- `QUEUE_REDIS_FAILURE_MODE=throw`
- `STORAGE_PROVIDER=s3` unless a managed shared volume is intentionally used.
- `CORS_ORIGINS` must list only trusted frontend origins.

## Storage And Backups

- Use object storage for uploads in production.
- Keep local `uploads/` only for development or managed single-node deployments.
- Schedule PostgreSQL backups and run restore drills before launch.
- Store backup files outside git and outside the application container filesystem.

## Smoke Coverage

The Playwright smoke suite covers:

- Login page on desktop and mobile.
- Admin login on desktop and mobile.
- Admin, coach, player, and parent dashboard shells with mocked backend responses.
- Runtime crash detection and basic horizontal overflow checks.

This is a smoke safety net, not a replacement for feature-specific E2E flows.
