/**
 * OG DEX — smart alerts CRUD (stored per-wallet in Supabase Storage).
 * GET  ?wallet=ADDR              -> { ok, alerts:[...] }
 * POST { wallet, alert }         -> add an alert (captures refPrice)
 * POST { wallet, remove:id }     -> delete an alert
 * Alert: { id, mint, symbol, type:price_above|price_below|pct_up|pct_down,
 *          value, channel:webhook, target, refPrice, enabled, createdAt }
 */
import { send, kvGet, kvPut, readBody, jup } from "../_lib.js";
const isAddr = (v) => typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
const TYPES = ["price_above", "price_below", "pct_up", "pct_down"];

async function priceOf(mint) {
  try { const d = await jup(`/price/v3?ids=${mint}`); return Number(d?.[mint]?.usdPrice) || null; } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    const body = await readBody(req);
    if (!isAddr(body.wallet)) return send(res, 400, { ok: false, error: "invalid wallet" });
    const key = `alerts/${body.wallet}.json`;
    const cur = (await kvGet(key))?.alerts || [];

    if (body.remove) {
      const next = cur.filter((a) => a.id !== body.remove);
      await kvPut(key, { alerts: next });
      return send(res, 200, { ok: true, alerts: next });
    }
    const a = body.alert || {};
    if (!isAddr(a.mint)) return send(res, 400, { ok: false, error: "invalid mint" });
    if (!TYPES.includes(a.type)) return send(res, 400, { ok: false, error: "invalid type" });
    const target = String(a.target || "").trim();
    if (!/^https?:\/\//i.test(target)) return send(res, 400, { ok: false, error: "target must be a webhook URL (https://)" });
    const refPrice = await priceOf(a.mint);
    const alert = {
      id: Math.random().toString(36).slice(2, 10),
      mint: a.mint, symbol: a.symbol || null, type: a.type,
      value: Number(a.value) || 0, channel: "webhook", target,
      refPrice, enabled: true, createdAt: Date.now(), lastFired: 0,
    };
    if (cur.length >= 25) return send(res, 200, { ok: false, error: "max 25 alerts per wallet" });
    const next = [alert, ...cur];
    await kvPut(key, { alerts: next });
    return send(res, 200, { ok: true, alerts: next });
  }

  const url = new URL(req.url, "http://x");
  const wallet = url.searchParams.get("wallet");
  if (!isAddr(wallet)) return send(res, 400, { ok: false, error: "invalid wallet" });
  const data = await kvGet(`alerts/${wallet}.json`);
  return send(res, 200, { ok: true, alerts: data?.alerts || [] });
}
