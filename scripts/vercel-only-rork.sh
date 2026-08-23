#!/usr/bin/env bash
# Vercel Ignored Build Step for audifyx/og-scan.
# Exit 0 = skip this build. Exit 1 = continue.
#
# Production is Vercel project rork-og-meme-coin-tracker
# (prj_c5AQF7gDGnrQWmKAznpQPf06GWi2 / beatsforsalebyauden).
# The leftover og-scan project (prj_UhZ1QBFiEQSdm0bRlMK3Nf6KTqI4) must not build.
set -euo pipefail

RORK_PROJECT_ID="prj_c5AQF7gDGnrQWmKAznpQPf06GWi2"
LEFTOVER_OG_SCAN_ID="prj_UhZ1QBFiEQSdm0bRlMK3Nf6KTqI4"
project_id="${VERCEL_PROJECT_ID:-}"
haystack="${VERCEL_URL:-} ${VERCEL_BRANCH_URL:-} ${VERCEL_PROJECT_PRODUCTION_URL:-}"

if [[ "$project_id" == "$LEFTOVER_OG_SCAN_ID" ]]; then
  echo "Skipping leftover Vercel project og-scan ($LEFTOVER_OG_SCAN_ID). Production is rork-og-meme-coin-tracker."
  exit 0
fi

if [[ "$project_id" == "$RORK_PROJECT_ID" ]]; then
  exit 1
fi

if [[ "$haystack" == *og-scan* && "$haystack" != *rork-og-meme-coin-tracker* ]]; then
  echo "Skipping leftover Vercel project og-scan. Production is rork-og-meme-coin-tracker."
  exit 0
fi

exit 1
