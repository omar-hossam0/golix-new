# GOALIX HTTP-only VPS deployment

Use this mode only while GOALIX is served by a VPS IP address without a trusted
domain certificate.

## Required `.env` values

```env
HTTP_PORT=80
HTTPS_PORT=443
BACKEND_NODE_ENV=production
ENABLE_HTTPS=false
ENABLE_HSTS=false
FORCE_HTTPS=false
CORS_ORIGINS=http://72.62.35.177
GOALIX_INTERNAL_API_URL=http://api:3000
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_SOCKET_URL=
```

`GOALIX_ACCESS_JWT_SECRET` must exactly match `JWT_SECRET`.

## Deploy

```bash
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

For the automated GitHub Actions CD path, set these repository secrets:

```text
VPS_HOST=72.62.35.177
VPS_USER=root
VPS_PORT=22
VPS_APP_DIR=/opt/goalix/golix-new
VPS_SSH_KEY=<private deploy key>
```

The CD job runs after the Docker Hub image is pushed. It pulls
`omarhossam2005/golix:main` for the frontend, builds the backend locally on the
VPS, recreates the production stack, and verifies health checks.

## Verify

```bash
curl -I http://72.62.35.177
curl -i http://72.62.35.177/health
curl -i http://72.62.35.177/ready
curl -I http://72.62.35.177/Logo.png
curl -I http://72.62.35.177/Final-Back.png
```

Expected:

- `/` returns `200`, not `301` or `308`
- no `Strict-Transport-Security` header
- no `upgrade-insecure-requests` CSP directive
- assets return `200`

## Enable HTTPS later

After a real domain and trusted certificate are installed:

```env
ENABLE_HTTPS=true
ENABLE_HSTS=true
FORCE_HTTPS=true
CORS_ORIGINS=https://your-goalix-domain.example
```

Also update `TLS_CERT_PATH` and `TLS_KEY_PATH` to the trusted certificate files,
then recreate the containers.
