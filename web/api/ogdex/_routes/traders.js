// OG DEX — top holders + top traders for a token. NO Birdeye.
// Holders: resilient Helius largest-accounts (retry + owner-resolve + whale
// labels + last-known-good cache) via _holders.js. Traders: GeckoTerminal
// recent trades on the DEEPEST pool(s), aggregated by wallet. Price: Jupiter.
import { send, cache, kvGet, kvPut } from "../_lib.js";
import { getLabeledHolders } from "../_holders.js";

const JUP = "https://lite-api.jup.ag";
const GT = "https://api.geckoterminal.com/api/v2";
const GT_HEADERS = { Accept: "application/json;version=20230302" };
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

async function gtFetch(path, timeout = 9000) {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(`${GT}${path}`, { headers: GT_HEADERS, signal: ctl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(id); }
}

// Top traders via GeckoTerminal recent trades on the deepest pool(s).
async function fetchTradersLive(mint) {
  const pd = await gtFetch(`/networks/solana/tokens/${mint}/pools?page=1`);
  const pools = (pd?.data || [])
    .map((p) => ({ addr: p.attributes?.address, resv: num(p.attributes?.reserve_in_usd) || 0 }))
    .filter((p) => p.addr)
    .sort((a, b) => b.resv - a.resv)
    .slice(0, 2);
  if (!pools.length) return [];

  const agg = new Map();
  for (const pool of pools) {
    const td = await gtFetch(`/networks/solana/pools/${pool.addr}/trades`);
    for (const t of td?.data || []) {
      const a = t.attributes || {};
      const who = a.tx_from_address;
      if (!who) continue;
      const e = agg.get(who) || { owner: who, buys: 0, sells: 0, buyVol: 0, sellVol: 0 };
      const usd = num(a.volume_in_usd) || 0;
      if ((a.kind || "").toLowerCase() === "buy") { e.buys++; e.buyVol += usd; } else { e.sells++; e.sellVol += usd; }
      agg.set(who, e);
    }
  }
  return [...agg.values()]
    .map((e) => ({ ...e, tradeCount: e.buys + e.sells, volume: e.buyVol + e.sellVol, realizedPnl: null, unrealizedPnl: null, netPnl: null, isHolder: false, holdingPct: null, holdingAmount: null }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 50)
    .map((t, i) => ({ rank: i + 1, ...t }));
}

// Traders with last-known-good fallback.
async function fetchTraders(mint) {
  const live = await fetchTradersLive(mint).catch(() => []);
  if (live.length) {
    kvPut(`traders/${mint}.json`, { ts: Date.now(), traders: live }).catch(() => {});
    return live;
  }
  const cached = await kvGet(`traders/${mint}.json`).catch(() => null);
  if (cached?.traders?.length) return cached.traders.map((t) => ({ ...t, stale: true }));
  return [];
}

async function fetchPrice(mint) {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`${JUP}/price/v3?ids=${mint}`, { signal: ctl.signal });
    if (!r.ok) return null;
    const d = await r.json();
    return num(d[mint]?.usdPrice);
  } catch { return null; } finally { clearTimeout(id); }
}

/** Jupiter v2 total holder count — never confuse with top-holders list length. */
async function fetchHolderCount(mint) {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`${JUP}/tokens/v2/search?query=${encodeURIComponent(mint)}`, { signal: ctl.signal });
    if (!r.ok) return null;
    const arr = await r.json();
    const t = Array.isArray(arr) ? (arr.find((x) => (x.id || x.mint) === mint) || arr[0]) : null;
    return num(t?.holderCount);
  } catch { return null; } finally { clearTimeout(id); }
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const mint = (url.searchParams.get("mint") || "").trim();
  if (!mint) return send(res, 400, { ok: false, error: "mint required" });
  cache(res, 60, 600);
  try {
    const [price, holderCount] = await Promise.all([fetchPrice(mint), fetchHolderCount(mint)]);
    const [holdersRes, traders] = await Promise.all([
      getLabeledHolders(mint, price),
      fetchTraders(mint),
    ]);
    const holders = holdersRes.holders;
    const holderMap = new Map(holders.map((h) => [h.owner, h]));
    const traderMap = new Map(traders.map((t) => [t.owner, t]));
    for (const h of holders) {
      const t = traderMap.get(h.owner);
      if (t) { h.buyVol = t.buyVol; h.sellVol = t.sellVol; h.buys = t.buys; h.sells = t.sells; h.tradeCount = t.tradeCount; }
    }
    for (const t of traders) {
      const h = holderMap.get(t.owner);
      if (h) { t.isHolder = true; t.holdingPct = h.pct; t.holdingAmount = h.uiAmount; t.holdingUsd = h.usdValue; }
    }

    // ── PnL ──────────────────────────────────────────────────────────────
    // Derive Realized / Unrealized / Net PnL per wallet from the captured
    // buy/sell USD volumes plus the current holding value. Cost basis is
    // allocated between the sold portion and the still-held portion by value,
    // so Net PnL === Realized + Unrealized === sold + holding − bought.
    // Wallets with no captured cost basis (no buys in the trade window) are
    // left null and render as "—" rather than fabricating a number.
    const withPnl = (e, heldRaw) => {
      const cost = num(e.buyVol) || 0;       // USD bought (cost basis seen)
      const proceeds = num(e.sellVol) || 0;  // USD sold (realized proceeds)
      const held = num(heldRaw) || 0;        // current holding value (USD)
      if (cost <= 0 || (proceeds <= 0 && held <= 0)) {
        e.realizedPnl = null; e.unrealizedPnl = null; e.netPnl = null; return;
      }
      const denom = proceeds + held;
      const soldShare = denom > 0 ? proceeds / denom : 0;
      const costOfSold = cost * soldShare;
      const realized = proceeds - costOfSold;
      const unrealized = held > 0 ? held - (cost - costOfSold) : 0;
      e.realizedPnl = realized;
      e.unrealizedPnl = unrealized;
      e.netPnl = realized + unrealized;
    };
    for (const t of traders) withPnl(t, t.holdingUsd);
    for (const h of holders) withPnl(h, h.usdValue);
    return send(res, 200, {
      ok: true, mint, holders, traders,
      holderCount, // total from Jupiter — distinct from holders.length (top-N sample)
      topHoldersCount: holders.length,
      holdersSource: holdersRes.source, holdersStale: holdersRes.stale,
    });
  } catch (e) {
    return send(res, 200, { ok: false, mint, holders: [], traders: [], holderCount: null, error: String(e?.message || e) });
  }
}
