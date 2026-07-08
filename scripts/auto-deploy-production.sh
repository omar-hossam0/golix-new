#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/goalix/golix-new}"
IMAGE="${IMAGE:-omarhossam2005/golix:main}"
BRANCH="${BRANCH:-main}"
LOCK_FILE="${LOCK_FILE:-/var/lock/goalix-auto-deploy.lock}"
STATE_DIR="${STATE_DIR:-/var/lib/goalix-auto-deploy}"
POLL_ATTEMPTS="${POLL_ATTEMPTS:-30}"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-20}"

mkdir -p "$STATE_DIR"

exec 9>"$LOCK_FILE"
flock -n 9 || {
  echo "Another GOALIX deployment check is already running."
  exit 0
}

cd "$APP_DIR"

remote_sha="$(git ls-remote origin "refs/heads/$BRANCH" | awk '{print $1}')"
if [ -z "$remote_sha" ]; then
  echo "Could not read remote SHA for $BRANCH." >&2
  exit 1
fi

deployed_sha_file="$STATE_DIR/deployed-sha"
deployed_sha="$(cat "$deployed_sha_file" 2>/dev/null || true)"
current_sha="$(git rev-parse HEAD)"

if [ "$remote_sha" = "$deployed_sha" ] && [ "$remote_sha" = "$current_sha" ]; then
  echo "GOALIX is already deployed at $remote_sha."
  exit 0
fi

echo "Waiting for Docker image $IMAGE to carry revision $remote_sha..."
for attempt in $(seq 1 "$POLL_ATTEMPTS"); do
  docker pull "$IMAGE"
  image_sha="$(docker image inspect "$IMAGE" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' 2>/dev/null || true)"
  if [ "$image_sha" = "$remote_sha" ]; then
    break
  fi
  if [ "$attempt" = "$POLL_ATTEMPTS" ]; then
    echo "Docker image $IMAGE is not at revision $remote_sha yet; latest label is ${image_sha:-missing}." >&2
    exit 1
  fi
  sleep "$POLL_INTERVAL_SECONDS"
done

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

GOALIX_IMAGE_TAG=main bash scripts/deploy-production.sh
printf '%s\n' "$remote_sha" > "$deployed_sha_file"

echo "GOALIX deployed at $remote_sha."
