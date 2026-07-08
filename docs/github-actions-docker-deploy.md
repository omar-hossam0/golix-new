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

VPS deployment:

```text
VPS_HOST
VPS_USER
VPS_PORT
VPS_APP_DIR
VPS_SSH_KEY
```

## Deployment Flow

On a push to `main`:

1. Run frontend lint, quality checks, build, and audit.
2. Run backend migrations, lint, tests, audit, and compose validation.
3. Build and push `omarhossam2005/golix`.
4. SSH into the VPS.
5. Pull the latest `main` branch.
6. Run `scripts/deploy-production.sh`.

The deploy script pulls the frontend image from Docker Hub, builds the backend
locally on the VPS, recreates the production Docker Compose stack, restarts
nginx, and verifies health checks.
