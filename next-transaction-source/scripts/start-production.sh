#!/usr/bin/env bash
set -euo pipefail

# Render (and most PaaS hosts) inject PORT. Bind all interfaces.
PORT="${PORT:-43123}"
HOST="${HOST:-0.0.0.0}"

echo "Applying Prisma migrations…"
npx prisma migrate deploy

echo "Starting Next.js on ${HOST}:${PORT}"
exec npx next start --hostname "$HOST" --port "$PORT"
