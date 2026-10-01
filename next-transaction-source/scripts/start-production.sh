#!/usr/bin/env bash
set -euo pipefail

# Render (and most PaaS hosts) inject PORT. Bind all interfaces.
PORT="${PORT:-43123}"
HOST="${HOST:-0.0.0.0}"

echo "Applying Prisma migrations…"
npx prisma migrate deploy

echo "Starting Next.js on ${HOST}:${PORT}"
npx next start --hostname "$HOST" --port "$PORT" &
server_pid=$!

# Fill an empty Live pilot after the server is up. Does not seed demo fiction.
# If this request fails, sign in and use Sources → Run sources.
(
  sleep 12
  if [[ -n "${CRON_SECRET:-}" ]]; then
    echo "Checking whether Live pilot needs a first ingest…"
    curl -sS -m 280 \
      -H "Authorization: Bearer ${CRON_SECRET}" \
      "http://127.0.0.1:${PORT}/api/cron/ingest?mode=if-empty" \
      || echo "First-run ingest request failed. Use Sources → Run sources after login."
  else
    echo "CRON_SECRET is unset, so boot ingest was skipped. The first signed-in page still starts it."
  fi
) &

wait "$server_pid"
