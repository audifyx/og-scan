#!/usr/bin/env bash
# Vercel Ignored Build Step for audifyx/og-scan.
# Exit 0 = skip this build. Exit 1 = continue.
#
# The only allowed project is rork-og-meme-coin-tracker
# (prj_c5AQF7gDGnrQWmKAznpQPf06GWi2 / beatsforsalebyauden).
# Any other hooked Vercel project (including leftover og-scan teams) is skipped.
set -euo pipefail

RORK_PROJECT_ID="prj_c5AQF7gDGnrQWmKAznpQPf06GWi2"
project_id="${VERCEL_PROJECT_ID:-}"
haystack="${VERCEL_URL:-} ${VERCEL_BRANCH_URL:-} ${VERCEL_PROJECT_PRODUCTION_URL:-}"

if [[ "$project_id" == "$RORK_PROJECT_ID" ]]; then
  exit 1
fi

if [[ -n "$project_id" ]]; then
  echo "Skipping Vercel project $project_id. Only rork-og-meme-coin-tracker ($RORK_PROJECT_ID) may build."
  exit 0
fi

# System project id not exposed — do not skip custom-domain prod, but skip leftover og-scan URLs.
if [[ "$haystack" == *og-scan* && "$haystack" != *rork-og-meme-coin-tracker* ]]; then
  echo "Skipping leftover Vercel project og-scan. Only rork-og-meme-coin-tracker may build."
  exit 0
fi

exit 1
