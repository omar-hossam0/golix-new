# GOALIX HTTP-only VPS deployment

Use this mode while GOALIX is served by a VPS IP address without a trusted
domain certificate. HTTPS can be exposed with a temporary self-signed
certificate, but browsers will not trust it until a real domain and certificate
are configured.

## Required `.env` values

```env
HTTP_PORT=80
HTTPS_PORT=443
BACKEND_NODE_ENV=production
ENABLE_HTTPS=false
ENABLE_HSTS=false
FORCE_HTTPS=false
UPGRADE_INSECURE_REQUESTS=false
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

For the automated CD path, install the VPS systemd timer that runs
`scripts/auto-deploy-production.sh`. The timer polls `origin/main`, waits until
Docker Hub `omarhossam2005/golix:main` carries the same Git revision, pulls the
frontend image, builds the backend locally, recreates the production stack, and
verifies health checks.

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

For temporary IP-based HTTPS, set `ENABLE_HTTPS=true` and keep
`ENABLE_HSTS=false`, `FORCE_HTTPS=false`, and
`UPGRADE_INSECURE_REQUESTS=false`. This keeps secure cookies enabled on HTTPS
without teaching browsers to force the IP to HTTPS permanently or upgrading HTTP
assets to the temporary self-signed certificate.

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
