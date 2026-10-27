#!/bin/sh
# Handoff between the phone and the Mac, end to end on the booted simulator. mac.mjs plays the
# Mac through the API. The phone sends step 5 to the Mac and waits; the Mac starts and checks
# it; the phone's open step turns Verified without a refresh (Realtime).
# Needs the dev build, Metro on :8081, and the API on :8787 (`pnpm --filter @tandrix/api dev`). To be rewritten for real model answers with I1.
set -eu
cd "$(dirname "$0")/.."
set -a; . ../../../.env.local; set +a
JOB=$(node handoff/mac.mjs create)
JOB_ID=$(printf '%s' "$JOB" | cut -f1)
TITLE=$(printf '%s' "$JOB" | cut -f2)

export MAESTRO_DRIVER_STARTUP_TIMEOUT=120000
run() { perl -e 'alarm shift; exec @ARGV' 600 maestro test --test-output-dir ../../../.maestro \
  -e DEV_USER_EMAIL="$DEV_USER_EMAIL" -e DEV_USER_PASSWORD="$DEV_USER_PASSWORD" \
  -e JOB_TITLE="$TITLE" "$@"; }

run handoff/1-send.yaml
node handoff/mac.mjs work "$JOB_ID"
run handoff/2-verified.yaml
