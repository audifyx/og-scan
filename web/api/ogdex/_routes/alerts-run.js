/**
 * OG DEX — alert evaluator. Triggered by Vercel Cron (and can be pinged by an
 * external cron for faster checks). Reads every wallet's alerts from Storage,
 * checks current price, and POSTs a payload to the alert's webhook when hit.
 * Price targets are one-shot (disabled after firing); % alerts cooldown 6h.
 */
import { send, kvGet, kvPut, kvList, jup } from "../_lib.js";

async function priceOf(mint) {
  try { const d = await jup(`/price/v3?ids=${mint}`); return Number(d?.[mint]?.usdPrice) || null; } catch { return null; }
}
function triggered(a, price) {
  if (price == null) return false;
  if (a.type === "price_above") return price >= a.value;
  if (a.type === "price_below") return price <= a.value;
  if (a.type === "pct_up" && a.refPrice) return ((price - a.refPrice) / a.refPrice) * 100 >= a.value;
  if (a.type === "pct_down" && a.refPrice) return ((price - a.refPrice) / a.refPrice) * 100 <= -Math.abs(a.value);
  return false;
}
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
async function deliver(a, price) {
  const human = `\u{1F514} OGDEX: ${a.symbol || a.mint.slice(0,6)} hit ${a.type.replace("_"," ")} ${a.value}${a.type.startsWith("pct")?"%":""} \u2014 now $${price}\nhttps://ogscan.fun/OGDEX/token/${a.mint}`;
  if (a.channel === "telegram") {
    if (!TG_TOKEN) return false;
    try {
      const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: a.target, text: human, disable_web_page_preview: false }),
      });
      const d = await r.json().catch(() => ({}));
      return !!d.ok;
    } catch { return false; }
  }
  const msg = {
    source: "OGDEX Alerts", mint: a.mint, symbol: a.symbol, type: a.type, target: a.value,
    price, url: `https://ogscan.fun/OGDEX/token/${a.mint}`,
    text: `🔔 ${a.symbol || a.mint.slice(0,6)} ${a.type.replace("_"," ")} ${a.value}${a.type.startsWith("pct")?"%":""} — now $${price}`,
    // common webhook shapes (Discord/Slack accept "content"/"text")
    content: `🔔 OGDEX: ${a.symbol || a.mint.slice(0,6)} hit ${a.type.replace("_"," ")} ${a.value}${a.type.startsWith("pct")?"%":""} — now $${price}. https://ogscan.fun/OGDEX/token/${a.mint}`,
  };
  try { await fetch(a.target, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg) }); return true; }
  catch { return false; }
}

export default async function handler(req, res) {
  const objs = await kvList("alerts/");
  let checked = 0, fired = 0;
  for (const o of objs) {
    const wallet = o.name.replace(/\.json$/, "");
    const data = await kvGet(`alerts/${wallet}.json`);
    const alerts = data?.alerts || [];
    if (!alerts.length) continue;
    // group by mint to minimize price calls
    const priceCache = {};
    let changed = false;
    for (const a of alerts) {
      if (!a.enabled) continue;
      checked++;
      const price = priceCache[a.mint] ?? (priceCache[a.mint] = await priceOf(a.mint));
      if (!triggered(a, price)) continue;
      const cooldown = a.type.startsWith("pct") ? 6 * 3600e3 : 0;
      if (cooldown && Date.now() - (a.lastFired || 0) < cooldown) continue;
      const ok = await deliver(a, price);
      if (ok) { fired++; a.lastFired = Date.now(); if (!a.type.startsWith("pct")) a.enabled = false; changed = true; }
    }
    if (changed) await kvPut(`alerts/${wallet}.json`, { alerts });
  }
  return send(res, 200, { ok: true, wallets: objs.length, checked, fired, at: new Date().toISOString() });
}
