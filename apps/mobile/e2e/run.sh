#!/bin/sh
# Runs the end-to-end flows on the booted iOS simulator against the local stack, on the real
# models (each full run spends well under a dollar; the API's spend cap applies).
# Needs: the dev build installed (pnpm ios), Metro on :8081, and the API on :8787 started with
# `pnpm --filter @tandrix/api dev`. Run one flow with `sh run.sh <flow.yaml>`.
# Each flow gets a fresh project from `pnpm --filter @tandrix/api e2e:seed` (known steps, no
# model call to write them) and its photos added newest-last, so the picker's order is known.
set -eu
cd "$(dirname "$0")"
set -a; . ../../../.env.local; set +a

OUT=../../../.maestro
PHOTOS=../../../fixtures/demo-pi5/photos
KIT=assets/kit-sheet
# The iOS driver sometimes starts slowly after many runs; give it two minutes.
export MAESTRO_DRIVER_STARTUP_TIMEOUT=120000
RUN_ID=$(date +%s)
# Each flow's photos, refreshed before the flow (git-ignored). Maestro resolves addMedia paths
# relative to the flow and doesn't expand variables in them, so the folder is fixed.
MEDIA=.media
ONLY=${1:-}

seed() { (cd ../../api && pnpm -s e2e:seed "$@"); }

# Copies photos into a fresh folder one second apart: the photo picker sorts by creation date, so
# the last one listed is the newest (index 0).
media() {
  rm -rf "$MEDIA" && mkdir -p "$MEDIA"
  for f in "$@"; do cp "$f" "$MEDIA/"; sleep 1.1; done
}

# flow <file> <seed scenario or -> [photos…]
flow() {
  file=$1 scenario=$2
  shift 2
  if [ -n "$ONLY" ] && [ "$ONLY" != "$file" ]; then return 0; fi
  job_id="" title=""
  if [ "$scenario" != "-" ]; then
    job=$(seed "$scenario" "${file%.yaml} e2e $RUN_ID")
    job_id=$(printf '%s' "$job" | cut -f1)
    title=$(printf '%s' "$job" | cut -f2)
  fi
  media "$@"
  # Maestro's iOS driver can hang (testmanagerd snapshot timeouts); cap each run at 15 minutes.
  perl -e 'alarm shift; exec @ARGV' 900 maestro test --test-output-dir "$OUT" \
    -e DEV_USER_EMAIL="$DEV_USER_EMAIL" -e DEV_USER_PASSWORD="$DEV_USER_PASSWORD" \
    -e RUN_ID="$RUN_ID" -e JOB_ID="$job_id" -e JOB_TITLE="$title" "$file"
}

flow sign-in-create-job.yaml -
# These deny the camera at launch (launchApp permissions) to drive the photo picker.
flow photo-evidence.yaml empty "$PHOTOS/board-top.jpg"
flow identify-equipment.yaml empty "$PHOTOS/box-label.jpg"
flow manual-from-pages.yaml asset "$KIT/page-2.jpg" "$KIT/page-1.jpg"
flow highlight-step.yaml pi "$PHOTOS/board-top.jpg"
flow safety-steps.yaml pi
flow voice-step.yaml pi
flow check-step.yaml pi "$PHOTOS/board-with-cooler.jpg" "$PHOTOS/board-top.jpg"
flow step-visuals.yaml pi "$PHOTOS/board-with-cooler.jpg"
flow parts-check.yaml pi "$PHOTOS/parts-laid-out.jpg"
