/**
 * OG DEX — wallet-synced watchlist (cross-device).
 * Stored as a JSON object per wallet in Supabase Storage (no DB table needed).
 * GET  ?wallet=ADDR        -> { ok, items:[mint|wallet,...] }
 * POST { wallet, items }   -> upsert the wallet's list
 */
import { send, kvGet, kvPut, readBody } from "../_lib.js";
const isAddr = (v) => typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);

export default async function handler(req, res) {
  if (req.method === "POST") {
    const body = await readBody(req);
    if (!isAddr(body.wallet)) return send(res, 400, { ok: false, error: "invalid wallet" });
    const items = Array.isArray(body.items) ? body.items.filter(isAddr).slice(0, 500) : [];
    try { await kvPut(`watchlist/${body.wallet}.json`, { items, updatedAt: Date.now() }); return send(res, 200, { ok: true, count: items.length }); }
    catch (e) { return send(res, 200, { ok: false, error: String(e?.message || e) }); }
  }
  const url = new URL(req.url, "http://x");
  const wallet = url.searchParams.get("wallet");
  if (!isAddr(wallet)) return send(res, 400, { ok: false, error: "invalid wallet" });
  const data = await kvGet(`watchlist/${wallet}.json`);
  return send(res, 200, { ok: true, items: data?.items || [] });
}
