# GOALIX GitHub Actions Docker Publish

This workflow builds and pushes the GOALIX Docker images to Docker Hub after a push to `master` or `main`.

## Docker Hub Repositories

Create these repositories on Docker Hub under your Docker Hub username:

- `goalix-backend`
- `goalix-frontend`

The workflow pushes both tags:

- `latest`
- the full Git commit SHA

Example:

```text
DOCKERHUB_USERNAME/goalix-backend:latest
DOCKERHUB_USERNAME/goalix-backend:<commit-sha>
DOCKERHUB_USERNAME/goalix-frontend:latest
DOCKERHUB_USERNAME/goalix-frontend:<commit-sha>
```

## GitHub Secrets

Add these secrets in GitHub repository settings:

- `DOCKERHUB_USERNAME`: your Docker Hub username
- `DOCKERHUB_TOKEN`: a Docker Hub access token

Create the token from Docker Hub:

`Docker Hub` -> `Account settings` -> `Personal access tokens`

## Workflow

On every push to `master` or `main`:

1. GitHub validates `docker-compose.prod.yml`.
2. GitHub logs in to Docker Hub.
3. GitHub builds the backend image from `golx-backend/Dockerfile`.
4. GitHub builds the frontend image from `Dockerfile`.
5. GitHub pushes both images to Docker Hub.

This workflow only publishes Docker images. It does not SSH into a VPS and does not start production containers.

## Pulling The Images

On any server that should run GOALIX:

```bash
docker pull DOCKERHUB_USERNAME/goalix-backend:latest
docker pull DOCKERHUB_USERNAME/goalix-frontend:latest
```

To run them with `docker-compose.prod.yml`, either keep local builds enabled or update the Compose image names to use your Docker Hub namespace.
