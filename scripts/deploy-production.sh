#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
IMAGE_TAG="${GOALIX_IMAGE_TAG:-main}"

export GOALIX_IMAGE_TAG="$IMAGE_TAG"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Missing $COMPOSE_FILE. Run this script from the GOALIX project root." >&2
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "Missing production .env. Create it on the server before deploying." >&2
  exit 1
fi

echo "Deploying GOALIX image tag: $GOALIX_IMAGE_TAG"

docker compose -f "$COMPOSE_FILE" config --quiet
docker compose -f "$COMPOSE_FILE" build --pull migrate api worker

if ! docker compose -f "$COMPOSE_FILE" pull frontend; then
  echo "Could not pull frontend image. Building frontend locally instead." >&2
  docker compose -f "$COMPOSE_FILE" build --pull frontend
fi

docker compose -f "$COMPOSE_FILE" up -d --no-build --remove-orphans
docker compose -f "$COMPOSE_FILE" restart nginx

docker compose -f "$COMPOSE_FILE" ps

docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U golx -d golx_main
docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping >/dev/null
docker compose -f "$COMPOSE_FILE" exec -T api node -e "fetch('http://127.0.0.1:3000/ready').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
docker compose -f "$COMPOSE_FILE" exec -T nginx wget -qO- http://127.0.0.1/health >/dev/null
docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -t

docker image prune -f --filter "until=168h" >/dev/null

echo "GOALIX deployment completed."
