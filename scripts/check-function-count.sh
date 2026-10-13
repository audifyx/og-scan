#!/usr/bin/env bash
# Guard: Vercel Hobby allows max 12 serverless functions per deployment.
# A 13th api/ file blocks EVERY deploy (2026-10-13: mcp-life-tick.js did this).
# Fail if the count exceeds 10 (headroom below the hard cap).
# New endpoints plug into a connector — web.js LAZY, ogdex.js ROUTES,
# orbitx-hub — NEVER a new standalone api/ file.
set -euo pipefail
cd "$(dirname "$0")/.."
mapfile -t fns < <(git ls-files --cached --others --exclude-standard web/api/ \
  | grep -E '\.(js|ts|mjs|cjs|py)$' | grep -vE '/_' | sort)
count=${#fns[@]}
echo "Serverless functions: $count / 12 (soft cap 10)"
printf '  %s\n' "${fns[@]}"
if (( count > 10 )); then
  echo "FAIL: $count functions exceeds soft cap 10. Fold the newest endpoint into a connector." >&2
  exit 1
fi
