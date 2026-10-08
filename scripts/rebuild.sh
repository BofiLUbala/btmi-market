#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

CACHE_BUST="$(date +%s)"
export CACHE_BUST

COMPOSE_FILE="backend/docker-compose.yml"

echo "Rebuilding web services with CACHE_BUST=${CACHE_BUST}..."

# CACHE_BUST invalidates each web image's source/build layers while preserving
# the cached dependency-install layer. Persistent Compose volumes are untouched.
docker compose -f "$COMPOSE_FILE" build admin-web web
docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate admin-web web

echo "Done. Web services recreated with fresh images; persistent volumes were preserved."
