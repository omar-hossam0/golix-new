# GOALIX GitHub Actions Docker Publish And VPS Deploy

The `CI` workflow runs on every push and pull request. On push, it also
publishes the frontend image to Docker Hub:

```text
omarhossam2005/golix:main
omarhossam2005/golix:latest
omarhossam2005/golix:<short-sha>
```

## Required GitHub Secrets

Docker Hub publish:

```text
DOCKERHUB_TOKEN
```

## Deployment Flow

On a push to `main`:

1. Run frontend lint, quality checks, build, and audit.
2. Run backend migrations, lint, tests, audit, and compose validation.
3. Build and push `omarhossam2005/golix`.
4. The VPS systemd timer runs `scripts/auto-deploy-production.sh`.
5. The VPS waits until Docker Hub `omarhossam2005/golix:main` carries the same
   Git revision as `origin/main`.
6. The VPS pulls the latest `main` branch and runs `scripts/deploy-production.sh`.

The deploy script pulls the frontend image from Docker Hub, builds the backend
locally on the VPS, recreates the production Docker Compose stack, restarts
nginx, and verifies health checks. This pull-based setup avoids exposing SSH to
GitHub-hosted runner IPs.
