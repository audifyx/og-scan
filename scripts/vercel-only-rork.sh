#!/usr/bin/env bash
# Vercel Ignored Build Step for audifyx/og-scan.
# Exit 0 = skip this build. Exit 1 = continue.
#
# Production is Vercel project rork-og-meme-coin-tracker.
# A leftover project named og-scan is also hooked to this GitHub repo — skip it.
set -euo pipefail

haystack="${VERCEL_URL:-} ${VERCEL_BRANCH_URL:-} ${VERCEL_PROJECT_PRODUCTION_URL:-}"

if [[ "$haystack" == *og-scan* && "$haystack" != *rork-og-meme-coin-tracker* ]]; then
  echo "Skipping leftover Vercel project og-scan. Production is rork-og-meme-coin-tracker."
  exit 0
fi

exit 1
