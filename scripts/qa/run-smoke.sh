#!/usr/bin/env bash
# OrbitX QA smoke — CIRCUIT agent entrypoint
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "==> Conflict marker scan"
if git grep -n '<<<<<<<' -- ':!*.md' ':!docs/agents/**' 2>/dev/null | head -20; then
  echo "FAIL: unresolved conflict markers present"
  exit 1
fi
echo "OK: no conflict markers"

echo "==> Critical route presence in App.tsx"
APP="$ROOT/web/src/App.tsx"
for needle in '/os/*' '/play/*' 'path="/intel"' 'path="/hq"' '/Orbitxcity'; do
  if ! grep -q "$needle" "$APP"; then
    echo "FAIL: missing route fragment: $needle"
    exit 1
  fi
done
echo "OK: /os /play /intel /hq /Orbitxcity present"

echo "==> Module folders"
for d in web/src/os web/src/gaming web/src/crypto web/src/social; do
  [[ -d "$ROOT/$d" ]] || { echo "FAIL: missing $d"; exit 1; }
done
echo "OK: team modules present"

echo "==> Vitest packs"
cd "$ROOT/web"
npm test -- --run \
  src/gaming/systems/progression.test.ts \
  src/crypto/risk/composeRisk.test.ts \
  src/social/growth/growth.test.ts \
  src/qa/routeManifest.test.ts

echo "==> SMOKE PASS"
