#!/bin/sh
set -e

DATA_DIR="$(dirname "${DB_PATH:-/app/data/proto.sqlite}")"
mkdir -p "$DATA_DIR"

if [ "$(id -u)" = "0" ]; then
  # Volumes created by older images are root-owned; hand them to the runtime user.
  chown -R bun:bun "$DATA_DIR"
  chmod 750 "$DATA_DIR"
  exec su-exec bun "$@"
fi

exec "$@"
