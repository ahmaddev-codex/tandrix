#!/bin/sh
# Downloads the official Raspberry Pi product briefs (© Raspberry Pi Ltd, not redistributed here)
# and compiles the 22-page build-kit manual Tandrix uses in the demo: Active Cooler, Case for
# Raspberry Pi 5, M.2 HAT+.  Run from anywhere: sh fixtures/demo-pi5/fetch.sh
set -eu
cd "$(dirname "$0")"
mkdir -p manuals
for u in cooling/raspberry-pi-active-cooler-product-brief.pdf \
         case/case-for-raspberry-pi-5-product-brief.pdf \
         m2-hat-plus/raspberry-pi-m2-hat-plus-product-brief.pdf \
         ssd/raspberry-pi-ssd-product-brief.pdf; do
  curl -sfL -o "manuals/$(basename "$u")" "https://datasheets.raspberrypi.com/$u"
  head -c 5 "manuals/$(basename "$u")" | grep -q '%PDF-' || { echo "Not a PDF: $u" >&2; exit 1; }
done
cd ../../apps/api && pnpm -s exec tsx scripts/build-demo-kit.ts ../../fixtures/demo-pi5/manuals
