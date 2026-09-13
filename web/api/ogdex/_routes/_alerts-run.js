/**
 * OG DEX — alert evaluator. Triggered by Vercel Cron (and can be pinged by an
 * external cron for faster checks). Reads every wallet's alerts from Storage,
 * checks current price, and POSTs a payload to the alert's webhook when hit.
 * Price targets are one-shot (disabled after firing); % alerts cooldown 6h.
 */
import { send, kvGet, kvPut, kvList, jup, callFn } from "../_lib.js";
import { parseSwap } from "../_swap.js";
import { isSafeWebhookUrl } from "../_walletProof.js";

async function safeFetchWebhook(url, body) {
  if (!isSafeWebhookUrl(url)) return false;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  return r.ok || r.status < 500;
}

async function priceOf(mint) {
  try { const d = await jup(`/price/v3?ids=${mint}`); return Number(d?.[mint]?.usdPrice) || null; } catch { return null; }
}
async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { jsonrpc: "2.0", id: 1, method, params });
  return r?.data?.result ?? r?.result ?? null;
}
// Recent buy/sell swaps for a wallet (newest first), cached per run.
async function recentSwaps(address, cache) {
  if (cache[address]) return cache[address];
  try {
    const sigs = (await rpc("getSignaturesForAddress", [address, { limit: 15 }])) || [];
    const txs = await Promise.all(sigs.map((sg) => rpc("getTransaction", [sg.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]).catch(() => null)));
    const swaps = txs.map((t) => parseSwap(t, address)).filter((x) => x && x.solAmount > 0).sort((a, b) => b.time - a.time);
    return (cache[address] = swaps);
  } catch { return (cache[address] = []); }
}
function kindLabel(a) {
  if (a.kind === "limit") return "Limit buy";
  if (a.kind === "tp") return "Take profit";
  if (a.kind === "stop") return "Stop loss";
  return a.type === "price_above" ? "Price above" : a.type === "price_below" ? "Price below" : String(a.type || "Alert").replace(/_/g, " ");
}

function tradeDeskUrl(mint) {
  return `https://www.orbitx.world/trade/desk/${mint}`;
}

async function deliverWalletTrade(a, swap) {
  const who = a.label || a.watch.slice(0, 6);
  const verb = swap.side === "buy" ? "bought" : "sold";
  const text = `\u{1F440} OrbitX Trade: ${who} ${verb} ${swap.solAmount.toFixed(3)} SOL of ${swap.mint.slice(0, 6)}\nWallet https://www.orbitx.world/trade/wallet/${a.watch}\nToken https://www.orbitx.world/trade/token/${swap.mint}`;
  if (a.channel === "telegram") {
    if (!TG_TOKEN) return false;
    try { const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: a.target, text }) }); const d = await r.json().catch(() => ({})); return !!d.ok; } catch { return false; }
  }
  const msg = { source: "OrbitX Trade Alerts", kind: "wallet_trade", watch: a.watch, label: a.label, side: swap.side, mint: swap.mint, solAmount: swap.solAmount, txHash: swap.txHash, url: `https://www.orbitx.world/trade/token/${swap.mint}`, text, content: text };
  try {
    if (!(await safeFetchWebhook(a.target, msg))) return false;
    return true;
  } catch { return false; }
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
  const label = kindLabel(a);
  const sym = a.symbol || a.mint.slice(0, 6);
  const suffix = a.type?.startsWith("pct") ? "%" : "";
  const desk = tradeDeskUrl(a.mint);
  const human = `\u{1F514} OrbitX Trade · ${label}\n${sym} target $${a.value}${suffix} — now $${price}\nTrade: ${desk}`;
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
    source: "OrbitX Trade Alerts",
    mint: a.mint,
    symbol: a.symbol,
    kind: a.kind || null,
    type: a.type,
    target: a.value,
    price,
    url: desk,
    text: `🔔 ${sym} ${label} $${a.value}${suffix} — now $${price}`,
    // Discord/Slack-friendly shapes
    content: `🔔 OrbitX Trade · ${label}: ${sym} hit $${a.value}${suffix} — now $${price}. ${desk}`,
  };
  try {
    return await safeFetchWebhook(a.target, msg);
  } catch { return false; }
}

export default async function handler(req, res) {
  // Cron / worker secret required — header only (no ?secret= — leaks to access logs).
  const secret = process.env.CRON_SECRET || process.env.OXW_WORKER_SECRET || "";
  const hdr =
    req.headers["authorization"] ||
    req.headers["x-cron-secret"] ||
    req.headers["x-oxw-worker-secret"] ||
    "";
  const bearer = String(hdr).replace(/^Bearer\s+/i, "").trim();
  if (!secret || bearer !== secret) {
    return send(res, 401, { ok: false, error: "unauthorized" });
  }

  const objs = await kvList("alerts/");
  let checked = 0, fired = 0;
  for (const o of objs) {
    const wallet = o.name.replace(/\.json$/, "");
    const data = await kvGet(`alerts/${wallet}.json`);
    const alerts = data?.alerts || [];
    if (!alerts.length) continue;
    // group by mint to minimize price calls
    const priceCache = {};
    const swapCache = {};
    let changed = false;
    for (const a of alerts) {
      if (!a.enabled) continue;
      checked++;
      if (a.type === "wallet_trade") {
        const swaps = await recentSwaps(a.watch, swapCache);
        if (!swaps.length) continue;
        if (!a.lastTx) { a.lastTx = swaps[0].txHash; changed = true; continue; } // baseline, no spam of history
        const idxSeen = swaps.findIndex((x) => x.txHash === a.lastTx);
        const fresh = idxSeen === -1 ? swaps.slice(0, 5) : swaps.slice(0, idxSeen);
        if (!fresh.length) continue;
        a.lastTx = swaps[0].txHash;
        for (const sw of fresh.reverse()) { const ok = await deliverWalletTrade(a, sw); if (ok) fired++; }
        a.lastFired = Date.now(); changed = true;
        continue;
      }
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
