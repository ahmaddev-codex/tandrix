#!/bin/sh
# Handoff between the phone and the Mac, end to end on the booted simulator, on the real models.
# mac.mjs plays the Mac through the API. The phone sends step 5 to the Mac and waits; the Mac
# starts it and checks a screenshot of the finished write; the phone's open step turns Verified
# without a refresh (Realtime).
# Needs the dev build, Metro on :8081, and the API on :8787 (`pnpm --filter @tandrix/api dev`).
set -eu
cd "$(dirname "$0")/.."
set -a; . ../../../.env.local; set +a
JOB=$(cd ../../api && pnpm -s e2e:seed pi "Handoff e2e $(date +%s)")
JOB_ID=$(printf '%s' "$JOB" | cut -f1)
TITLE=$(printf '%s' "$JOB" | cut -f2)
SHOT=$(mktemp -d)/os-writer-done.png
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --user-data-dir="$(dirname "$SHOT")/chrome" --window-size=1280,800 \
  --screenshot="$SHOT" "file://$(cd ../../.. && pwd)/fixtures/demo-pi5/screens/os-writer-done.html" > /dev/null 2>&1

export MAESTRO_DRIVER_STARTUP_TIMEOUT=120000
run() { perl -e 'alarm shift; exec @ARGV' 600 maestro test --test-output-dir ../../../.maestro \
  -e DEV_USER_EMAIL="$DEV_USER_EMAIL" -e DEV_USER_PASSWORD="$DEV_USER_PASSWORD" \
  -e JOB_ID="$JOB_ID" -e JOB_TITLE="$TITLE" "$@"; }

run handoff/1-send.yaml
node handoff/mac.mjs "$JOB_ID" "$SHOT"
run handoff/2-verified.yaml
