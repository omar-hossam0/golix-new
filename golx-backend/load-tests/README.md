# Goalix load tests

These tools are for staging-like performance testing, not for a developer laptop.
The mixed runner creates safe synthetic player identities when needed, accepts
real staging JWTs for admin/coach/player/parent traffic, drives REST and
Socket.IO traffic together, and writes JSON reports to the ignored
`.tmp/load-tests` folder.

## Mixed workload runner

```powershell
npm run load:mixed -- --profile=10k-baseline --target=https://staging-api.example.com
npm run load:mixed -- --profile=20k-target --target=https://staging-api.example.com --shard-count=4 --shard-index=0
npm run load:socket -- --target=https://staging-api.example.com
npm run load:soak -- --target=https://staging-api.example.com
npm run load:analyze
```

Profiles:

- `smoke`: 100, 500, 1000 active users.
- `10k-baseline`: 1k, 2.5k, 5k, 10k active users.
- `16k-stress`: 12k, 16k active users.
- `20k-target`: 20k active users.
- `30min-soak` / `soak`: 10k active users for 30 minutes.
- `socket`: socket-focused profile.

Balanced SLA defaults:

- HTTP error rate `< 0.5%`.
- read p95 `< 800ms`.
- write p95 `< 1500ms`.
- p99 `< 3000ms`.
- Socket.IO connect success `> 99%`.
- steady-state socket disconnects `< 1%`.
- no unexpected `401/403`.

The default profile is `smoke` so accidental local runs stay small. Use
`--dry-run=true` to validate config and sharding without provisioning users or
sending traffic.

## Staging tokens

Synthetic users are player-only and are useful for smoke/baseline read pressure.
For a real mixed role workload, pass a token file with real staging accounts that
already satisfy the normal login/MFA/assignment/parent-link rules:

```json
{
  "admin": [{ "label": "admin-1", "accessToken": "..." }],
  "coach": [{ "label": "coach-1", "accessToken": "..." }],
  "player": [{ "label": "player-1", "accessToken": "..." }],
  "parent": [{ "label": "parent-1", "accessToken": "..." }]
}
```

Run with:

```powershell
npm run load:mixed -- --config=load-tests/load-test.config.example.json --tokens-file=load-tests/staging-tokens.local.json
```

Do not commit token files. Keep them outside the repo or name them `*.local.json`
and clean them after the test window.

## Sharding generators

For 10k-20k active users, run multiple generator processes or machines. Each
shard gets an independent user range and report:

```powershell
npm run load:mixed -- --profile=20k-target --target=https://staging-api.example.com --shard-count=4 --shard-index=0
npm run load:mixed -- --profile=20k-target --target=https://staging-api.example.com --shard-count=4 --shard-index=1
npm run load:mixed -- --profile=20k-target --target=https://staging-api.example.com --shard-count=4 --shard-index=2
npm run load:mixed -- --profile=20k-target --target=https://staging-api.example.com --shard-count=4 --shard-index=3
```

The synthetic generator limit is 10,000 users per shard. If a shard needs more
than that, increase `--shard-count` or provide a token file.

## What the report includes

- per-stage summary and SLA pass/fail.
- per-endpoint p50/p95/p99 latency and error counts.
- read/write latency separation.
- Socket.IO connect/fail/disconnect stats and chat-room join stats.
- chat send/read-receipt skip counts when no conversation exists.
- PostgreSQL connection samples.
- Redis availability, ops, memory, and eviction samples when Redis is up.
- BullMQ queue count samples when Redis/BullMQ are reachable.

Analyze the latest report:

```powershell
npm run load:analyze
```

Analyze a specific report:

```powershell
npm run load:analyze -- --file=..\.tmp\load-tests\goalix-mixed-<run-id>-shard-0.json
```

## Legacy burst runner

`load-test.js` is still available as `npm run load:test`. It creates up to
10,000 synthetic player identities and sends synchronized authenticated GET
bursts to a small endpoint set. Use it only when you specifically want a burst
connection/request test.

Emergency cleanup for interrupted synthetic runs:

```powershell
npm run load:cleanup -- --confirm=DELETE_GOALIX_LOAD_USERS
```
