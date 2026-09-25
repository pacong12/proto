#!/bin/sh
set -e

# Ensure SQLite data directory exists and has full write permissions
mkdir -p /app/data 2>/dev/null || true
chmod -R 777 /app/data 2>/dev/null || true

exec "$@"
