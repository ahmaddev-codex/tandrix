#!/bin/sh
# Signing in a Mac from the phone, end to end on the booted simulator. This script plays the Mac:
# it asks the API for a pairing code, the flow approves it on the phone, and the Mac's next poll
# must come back with a sign-in. Needs the dev build, Metro on :8081 and the API on :8787.
set -eu
cd "$(dirname "$0")/.."
set -a; . ../../../.env.local; set +a
API=${API_PUBLIC_URL:-http://localhost:8787}
DEVICE="E2E Mac $(date +%s)"

PAIRING=$(curl -sf -X POST "$API/pairing" -H 'content-type: application/json' \
  -d "{\"deviceName\":\"$DEVICE\"}")
field() { printf '%s' "$PAIRING" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0))['$1'])"; }

export MAESTRO_DRIVER_STARTUP_TIMEOUT=120000
perl -e 'alarm shift; exec @ARGV' 600 maestro test --test-output-dir ../../../.maestro \
  -e DEV_USER_EMAIL="$DEV_USER_EMAIL" -e DEV_USER_PASSWORD="$DEV_USER_PASSWORD" \
  -e PAIR_CODE="$(field code)" -e DEVICE_NAME="$DEVICE" pair-mac/pair-mac.yaml

STATUS=$(curl -sf "$API/pairing/$(field pairingId)" -H "X-Pairing-Token: $(field pollToken)")
case "$STATUS" in
  *'"status":"approved"'*) echo "The Mac got its sign-in." ;;
  *) echo "Expected the Mac to be signed in, got: $STATUS" >&2; exit 1 ;;
esac
