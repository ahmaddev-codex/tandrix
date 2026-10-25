#!/bin/sh
# Runs the end-to-end flows on the booted iOS simulator against the local stack.
# Needs: the dev build installed (pnpm ios), Metro on :8081, and the API on :8787 started with
# `pnpm --filter @tandrix/api dev:fixtures` (canned model answers until the model is live).
set -eu
cd "$(dirname "$0")"
set -a; . ../../../.env.local; set +a

OUT=../../../.maestro
RUN_ID=$(date +%s)
run() { maestro test --test-output-dir "$OUT" -e DEV_USER_EMAIL="$DEV_USER_EMAIL" -e DEV_USER_PASSWORD="$DEV_USER_PASSWORD" -e RUN_ID="$RUN_ID" "$@"; }

run sign-in-create-job.yaml design-gallery.yaml

# These flows deny the camera at launch (launchApp permissions) to drive the photo picker.
run photo-evidence.yaml
run identify-equipment.yaml
run manual-from-pages.yaml
run generic-steps.yaml
run highlight-step.yaml
run safety-steps.yaml
