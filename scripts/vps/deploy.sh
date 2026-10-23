#!/usr/bin/env bash
# Deploys the released API on the VPS: fast-forwards the checkout to the `production` branch,
# rebuilds the api container and waits for /health. GitHub Actions runs it through a dedicated SSH
# key that can run nothing else (deploy-vps.yml).
#
# Install (as the deploy user; copy it out of the checkout so a deploy never rewrites the running
# script):
#   install -D -m 755 /var/www/proto/scripts/vps/deploy.sh ~/bin/goton-deploy
# and give the CI key one line in ~/.ssh/authorized_keys:
#   command="/home/deploy/bin/goton-deploy",restrict ssh-ed25519 AAAA... goton-ci-deploy
#
# Fast-forward only: local changes in the checkout are kept, and a diverged history stops the
# deploy instead of being reset away.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/proto}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3011/health}"

cd "$APP_DIR"
git fetch -q origin production
git merge -q --ff-only FETCH_HEAD
echo "[deploy] at $(git log --oneline -1)"

docker compose up -d --build --no-deps api

for _ in $(seq 1 40); do
  if curl -fsS "$HEALTH_URL" > /dev/null 2>&1; then
    echo "[deploy] api healthy"
    exit 0
  fi
  sleep 3
done
echo "[deploy] api did not become healthy" >&2
docker compose logs --tail 50 api >&2
exit 1
