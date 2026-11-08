#!/usr/bin/env bash
# Supervises the three trusted processes in the all-in-one image. If any exits, the container exits
# so the platform restarts it. The sandbox services bind to loopback only; only the API is public.
set -euo pipefail
API_PORT="${PORT:-8000}"
ROOT="${DECOYR_REPO_ROOT:-/srv/decoyr}"
export DECOYR_CONTROL_PLANE_URL="http://127.0.0.1:${API_PORT}"
export DECOYR_EGRESS_URL="http://127.0.0.1:7200"
trap 'kill $(jobs -p) 2>/dev/null || true' EXIT

cd "$ROOT"/services/egress-proxy && PORT=7200 HOST=127.0.0.1 node dist/index.js &
cd "$ROOT"/services/mcp-city && PORT=7100 HOST=127.0.0.1 node dist/index.js &
cd "$ROOT"/apps/api
# One worker: run state (active sandboxes, event sequence counters) lives in this process.
uvicorn decoyr.main:app --host 0.0.0.0 --port "$API_PORT" --workers 1 --proxy-headers --forwarded-allow-ips '*' &

wait -n
echo "[decoyr-start] a process exited; stopping container" >&2
exit 1
