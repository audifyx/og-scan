/**
 * Spec v2 §07.4 — permissionless resolve crank.
 *
 * Prod: hourly GET /api/pad-resolve (Vercel cron).
 * Local: curl -s http://localhost:8080/api/pad-resolve  (vite does not serve /api).
 *
 * On deadline:
 *   metric resolver → graduated_at ? YES : NO after grace
 *   other resolvers → skip until T+grace, then VOID (never steal)
 * Does not move funds until pm-core is deployed. Indexer only.
 */
const PROD = process.env.PAD_RESOLVE_URL || "https://www.orbitx.world/api/pad-resolve";

async function main() {
  const r = await fetch(PROD);
  const j = await r.json();
  console.log(JSON.stringify(j, null, 2));
  if (!r.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
