# Goalix Production Audit - 2026-07-08

## Current Production Snapshot

- Host: `72.62.35.177`
- OS: Ubuntu 24.04.3 LTS
- CPU: 1 vCPU
- RAM: 3.8 GiB
- Swap before hardening: none
- Docker services: nginx, frontend, api, worker, postgres, redis
- App readiness: `ready`
- PostgreSQL: healthy
- Redis: healthy

## Hardening Applied

- Added SSH public key access for root.
- Disabled SSH password authentication.
- Set `PermitRootLogin prohibit-password`.
- Enabled UFW firewall.
- Allowed only:
  - `22/tcp`
  - `80/tcp`
  - `443/tcp`
- Explicitly blocked public MinIO ports:
  - `9000/tcp`
  - `9001/tcp`
- Added 2 GiB swap at `/swapfile`.
- Set `vm.swappiness=10`.
- Verified containers remained healthy after changes.
- Added `poweredByHeader: false` to local `next.config.ts`.
- Verified local `npm run build` succeeds.

## Controlled Load Smoke Test

Target used: `http://72.62.35.177`

Endpoints:

- `/health`
- `/ready`
- `/api/v1/csrf-token`
- `/`

| Stage | Concurrency | Requests | RPS | Errors | p50 | p95 | p99 | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| c50 | 50 | 500 | 114.5 | 0 | 75.2ms | 1513.9ms | 1580.8ms | pass with high p95 |
| c100 | 100 | 1000 | 146.5 | 0 | 96.2ms | 2518.1ms | 2701.6ms | degraded latency |
| c200 | 200 | 2000 | 158.5 | 0 | 119.8ms | 4876.3ms | 5424.2ms | failed latency threshold |

Ramp stopped at c200 because p95 exceeded 3000ms.

## Conclusion

The current single-CPU production server is not suitable for proving 20,000 active users.

The system stayed healthy and returned no 5xx errors during the controlled smoke test, but latency degraded heavily by 200 concurrent requests. A real 20k test on this host would likely be a service-disruption test, not a valid capacity proof.

## Remaining Production Blockers Before 20k

- Replace self-signed IP certificate with a trusted certificate on a real domain.
- Enable HTTP to HTTPS redirect only after trusted TLS is installed.
- Enable HSTS only after trusted TLS is installed.
- Deploy frontend build with `poweredByHeader: false` or rebuild the production image.
- Move from 1 vCPU / 4 GiB RAM to multi-node/staging-like infrastructure.
- Add PgBouncer before PostgreSQL when running multiple API/worker instances.
- Use multiple API instances behind Nginx or a managed load balancer.
- Use multiple worker instances for BullMQ queues.
- Use managed/HA Redis, or separate Redis for queue vs cache/socket under high load.
- Move upload storage from local volume to S3-compatible object storage for real production scale.
- Run full mixed authenticated load tests with real staging tokens and sharded generators.
- Run database monitoring with `pg_stat_statements`.
- Apply OS package updates in a maintenance window.

## Recommended 20k Test Shape

- Use a staging environment that matches production topology.
- Minimum shape:
  - 2-4 API instances to start, then scale upward.
  - 2+ worker instances.
  - PostgreSQL with PgBouncer.
  - Redis on separate resources.
  - S3-compatible object storage.
  - Load generator sharded across multiple machines.
- Stages:
  - 1k
  - 2.5k
  - 5k
  - 10k
  - 16k
  - 20k
- Stop if:
  - HTTP error rate exceeds 0.5%.
  - read p95 exceeds 800ms.
  - write p95 exceeds 1500ms.
  - p99 exceeds 3000ms.
  - socket connect success falls below 99%.

