// Shared backend client — reuses the OG Scan (Soltools) Supabase backend.
export const SUPA_URL = process.env.SUPABASE_URL || "https://ffjipnkhcebjvttliptb.supabase.co";
export const SUPA_FN = process.env.SUPABASE_FN_URL || SUPA_URL + "/functions/v1";
export const ANON = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmamlwbmtoY2VianZ0dGxpcHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1Mjc5NDgsImV4cCI6MjA5MzEwMzk0OH0.aXu8bbpVVwc8KOJf1-lHqO3cz_0GZD10_TE0GlKQ1BI";
export const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const ADMIN_PASS = process.env.ADMIN_PASS || "0129";
export const PAY_WALLET = "CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh";
export const JUP = "https://lite-api.jup.ag";
// Token holder/trade/safety intelligence function. v2 adds KOL + public-wallet
// labeling and whale rollups. Switch back to "ogdex-intel" here to roll back.
export const INTEL_FN = process.env.OGDEX_INTEL_FN || "ogdex-intel-v2";

export function send(res, status, data) {
  res.setHeader("Content-Type", "application/json");
  // Preserve any Cache-Control set by cache() — only default to no-store when unset
  if (!res.getHeader("Cache-Control")) res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const payload = JSON.stringify(data);
  if (typeof res.status === "function") res.status(status).send(payload);
  else { res.statusCode = status; res.end(payload); }
}
export function cache(res, s = 10, swr = 30) {
  res.setHeader("Cache-Control", `s-maxage=${s}, stale-while-revalidate=${swr}`);
}

export async function callFn(name, body) {
  const r = await fetch(`${SUPA_FN}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}`, apikey: ANON },
    body: JSON.stringify(body || {}),
  });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return { ok: false, raw: txt }; }
}

export async function jup(path) {
  const r = await fetch(`${JUP}${path}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`jupiter ${r.status}`);
  return r.json();
}

// PostgREST helpers (service role — bypasses RLS, server-side only).
function dbHeaders(extra = {}) {
  return { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...extra };
}
export async function dbSelect(table, query = "") {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, { headers: dbHeaders() });
  if (!r.ok) throw new Error(`db select ${r.status}: ${await r.text()}`);
  return r.json();
}
export async function dbInsert(table, row) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: "POST", headers: dbHeaders({ Prefer: "return=representation" }), body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`db insert ${r.status}: ${await r.text()}`);
  return r.json();
}
export async function dbUpdate(table, query, patch) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH", headers: dbHeaders({ Prefer: "return=representation" }), body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`db update ${r.status}: ${await r.text()}`);
  return r.json();
}
export async function dbDelete(table, query) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, { method: "DELETE", headers: dbHeaders() });
  if (!r.ok) throw new Error(`db delete ${r.status}`);
  return true;
}
export async function dbRpcCount(table, query = "") {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, {
    headers: dbHeaders({ Prefer: "count=exact", Range: "0-0" }),
  });
  const cr = r.headers.get("content-range") || "*/0";
  return Number(cr.split("/")[1]) || 0;
}

export function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) { resolve(typeof req.body === "string" ? safe(req.body) : req.body); return; }
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => resolve(safe(d)));
  });
}
function safe(s) { try { return JSON.parse(s); } catch { return {}; } }

// ── Supabase Storage KV (no DDL needed — service role over REST) ──────────────
// Stores small JSON blobs as objects in a private bucket. Used for wallet-keyed
// watchlists and alerts where creating SQL tables isn't available.
const KV_BUCKET = "ogdex-kv";
let _kvReady = false;
async function kvEnsure() {
  if (_kvReady) return;
  try {
    await fetch(`${SUPA_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: KV_BUCKET, name: KV_BUCKET, public: false }),
    });
  } catch { /* already exists */ }
  _kvReady = true;
}
export async function kvGet(path) {
  try {
    const r = await fetch(`${SUPA_URL}/storage/v1/object/${KV_BUCKET}/${path}`, {
      headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
export async function kvPut(path, obj) {
  await kvEnsure();
  const r = await fetch(`${SUPA_URL}/storage/v1/object/${KV_BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", "x-upsert": "true" },
    body: JSON.stringify(obj),
  });
  if (!r.ok) throw new Error(`kv put ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return true;
}
export async function kvList(prefix = "") {
  try {
    const r = await fetch(`${SUPA_URL}/storage/v1/object/list/${KV_BUCKET}`, {
      method: "POST",
      headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, sortBy: { column: "name", order: "asc" } }),
    });
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}
