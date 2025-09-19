#!/bin/sh
set -e

# Ensure runtime dirs exist
mkdir -p /app/db
mkdir -p /app/uploads/avatars

echo "[entrypoint] DB migrate (compiled)…"
node dist/db/migrate.js

echo "[entrypoint] Starting server…"
exec node dist/src/index.js
