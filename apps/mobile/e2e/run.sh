#!/bin/sh
# Runs the end-to-end flows on the booted iOS simulator against the local stack.
# Needs: the dev build installed (pnpm ios), Metro on :8081, the API on :8787.
set -eu
cd "$(dirname "$0")"
set -a; . ../../../.env.local; set +a

APP=app.tandrix.mobile
OUT=../../../.maestro
RUN_ID=$(date +%s)
run() { maestro test --test-output-dir "$OUT" -e DEV_USER_EMAIL="$DEV_USER_EMAIL" -e DEV_USER_PASSWORD="$DEV_USER_PASSWORD" -e RUN_ID="$RUN_ID" "$@"; }

run sign-in-create-job.yaml design-gallery.yaml

# Camera refused: the photo flow must still let the user choose a photo.
xcrun simctl privacy booted revoke camera "$APP"
run photo-evidence.yaml
run identify-equipment.yaml
