#!/bin/sh
# T17 on the simulator: go offline mid-job by stopping the local API, then bring it back.
# Needs what e2e/run.sh needs; restarts the API afterwards.
set -eu
cd "$(dirname "$0")"
set -a; . ../../../../.env.local; set +a
OUT=../../../../.maestro
RUN_ID=$(date +%s)
export MAESTRO_DRIVER_STARTUP_TIMEOUT=120000
run() { perl -e 'alarm shift; exec @ARGV' 900 maestro test --test-output-dir "$OUT" -e DEV_USER_EMAIL="$DEV_USER_EMAIL" -e DEV_USER_PASSWORD="$DEV_USER_PASSWORD" -e RUN_ID="$RUN_ID" "$@"; }
api_up() {
  (cd ../../../api && nohup pnpm dev > "${API_LOG:-/tmp/tandrix-api.log}" 2>&1 &)
  for _ in $(seq 1 30); do curl -sf localhost:8787/health > /dev/null && return 0; sleep 1; done
  echo "API didn't come back" >&2; exit 1
}
api_down() { pkill -f "src/server.ts" || true; sleep 2; }

run 1-online.yaml
api_down
run 2-offline.yaml
api_up
run 3-back-online.yaml
