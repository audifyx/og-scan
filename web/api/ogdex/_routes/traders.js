// OG DEX — top holders + top traders for a token. NO Birdeye.
// Holders: resilient Helius largest-accounts (retry + owner-resolve + whale
// labels + last-known-good cache) via _holders.js. Traders: GeckoTerminal
// recent trades on the DEEPEST pool(s), aggregated by wallet. Also returns the
// raw trade tape so Live Trades UI works even when INTEL_FN is down. Price: Jupiter.
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

/** Normalize one GeckoTerminal trade into the intel.trades shape (+ UI aliases). */
function mapGtTrade(a) {
  const kind = String(a.kind || "").toLowerCase();
  const side = kind === "sell" ? "sell" : "buy";
  const buy = side === "buy";
  const tokenAmount = num(buy ? a.to_token_amount : a.from_token_amount);
  const priceUsd = num(buy ? a.price_to_in_usd : a.price_from_in_usd)
    ?? num(a.price_to_in_usd) ?? num(a.price_from_in_usd);
  const volumeUsd = num(a.volume_in_usd);
  const ts = a.block_timestamp;
  let time = null;
  if (ts != null) {
    if (typeof ts === "number") time = ts < 1e12 ? ts * 1000 : ts;
    else {
      const ms = new Date(ts).getTime();
      time = Number.isFinite(ms) ? ms : null;
    }
  }
  const owner = a.tx_from_address || null;
  return {
    side,
    kind: side,
    time,
    volumeUsd,
    usd: volumeUsd,
    amountUsd: volumeUsd,
    tokenAmount,
    amount: tokenAmount,
    priceUsd,
    owner,
    wallet: owner,
    txHash: a.tx_hash || null,
    dex: "geckoterminal",
  };
}

// Top traders + trade tape via GeckoTerminal recent trades on the deepest pool(s).
async function fetchTradersLive(mint) {
  const pd = await gtFetch(`/networks/solana/tokens/${mint}/pools?page=1`);
  const pools = (pd?.data || [])
    .map((p) => ({ addr: p.attributes?.address, resv: num(p.attributes?.reserve_in_usd) || 0 }))
    .filter((p) => p.addr)
    .sort((a, b) => b.resv - a.resv)
    .slice(0, 2);
  if (!pools.length) return { traders: [], trades: [] };

  const agg = new Map();
  const tape = [];
  const seenTx = new Set();
  for (const pool of pools) {
    const td = await gtFetch(`/networks/solana/pools/${pool.addr}/trades?trade_volume_in_usd_greater_than=0`);
    for (const t of td?.data || []) {
      const a = t.attributes || {};
      const row = mapGtTrade(a);
      if (row.txHash && !seenTx.has(row.txHash)) {
        seenTx.add(row.txHash);
        tape.push(row);
      } else if (!row.txHash && row.volumeUsd != null) {
        tape.push(row);
      }
      const who = row.owner;
      if (!who) continue;
      const e = agg.get(who) || { owner: who, buys: 0, sells: 0, buyVol: 0, sellVol: 0 };
      const usd = row.volumeUsd || 0;
      if (row.side === "buy") { e.buys++; e.buyVol += usd; } else { e.sells++; e.sellVol += usd; }
      agg.set(who, e);
    }
  }

  tape.sort((a, b) => (b.time || 0) - (a.time || 0));

  const traders = [...agg.values()]
    .map((e) => ({
      ...e,
      tradeCount: e.buys + e.sells,
      volume: e.buyVol + e.sellVol,
      boughtUsd: e.buyVol,
      bought: e.buyVol,
      soldUsd: e.sellVol,
      sold: e.sellVol,
      realizedPnl: null,
      unrealizedPnl: null,
      netPnl: null,
      pnl: null,
      isHolder: false,
      holdingPct: null,
      holdingAmount: null,
      holding: null,
      holdingUsd: null,
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 50)
    .map((t, i) => ({ rank: i + 1, ...t }));

  return { traders, trades: tape.slice(0, 100) };
}

// Traders with last-known-good fallback.
async function fetchTraders(mint) {
  const live = await fetchTradersLive(mint).catch(() => ({ traders: [], trades: [] }));
  if (live.traders?.length || live.trades?.length) {
    kvPut(`traders/${mint}.json`, { ts: Date.now(), traders: live.traders, trades: live.trades }).catch(() => {});
    return live;
  }
  const cached = await kvGet(`traders/${mint}.json`).catch(() => null);
  if (cached?.traders?.length || cached?.trades?.length) {
    return {
      traders: (cached.traders || []).map((t) => ({ ...t, stale: true })),
      trades: (cached.trades || []).map((t) => ({ ...t, stale: true })),
    };
  }
  return { traders: [], trades: [] };
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

function enrichTraderAliases(t) {
  const buyVol = num(t.buyVol ?? t.boughtUsd ?? t.bought) ?? 0;
  const sellVol = num(t.sellVol ?? t.soldUsd ?? t.sold) ?? 0;
  t.buyVol = buyVol;
  t.sellVol = sellVol;
  t.boughtUsd = buyVol;
  t.bought = buyVol;
  t.soldUsd = sellVol;
  t.sold = sellVol;
  t.volume = num(t.volume) ?? (buyVol + sellVol);
  if (t.holdingAmount != null) t.holding = t.holdingAmount;
  if (t.netPnl != null) t.pnl = t.netPnl;
  return t;
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const mint = (url.searchParams.get("mint") || "").trim();
  if (!mint) return send(res, 400, { ok: false, error: "mint required" });
  cache(res, 60, 600);
  try {
    const [price, holderCount] = await Promise.all([fetchPrice(mint), fetchHolderCount(mint)]);
    const [holdersRes, traderPack] = await Promise.all([
      getLabeledHolders(mint, price),
      fetchTraders(mint),
    ]);
    const holders = holdersRes.holders;
    const traders = traderPack.traders || [];
    const trades = traderPack.trades || [];
    const holderMap = new Map(holders.map((h) => [h.owner, h]));
    const traderMap = new Map(traders.map((t) => [t.owner, t]));
    for (const h of holders) {
      const t = traderMap.get(h.owner);
      if (t) { h.buyVol = t.buyVol; h.sellVol = t.sellVol; h.buys = t.buys; h.sells = t.sells; h.tradeCount = t.tradeCount; h.boughtUsd = t.buyVol; h.soldUsd = t.sellVol; }
    }
    for (const t of traders) {
      const h = holderMap.get(t.owner);
      if (h) {
        t.isHolder = true;
        t.holdingPct = h.pct;
        t.holdingAmount = h.uiAmount;
        t.holding = h.uiAmount;
        t.holdingUsd = h.usdValue;
      }
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
        e.realizedPnl = null; e.unrealizedPnl = null; e.netPnl = null; e.pnl = null; return;
      }
      const denom = proceeds + held;
      const soldShare = denom > 0 ? proceeds / denom : 0;
      const costOfSold = cost * soldShare;
      const realized = proceeds - costOfSold;
      const unrealized = held > 0 ? held - (cost - costOfSold) : 0;
      e.realizedPnl = realized;
      e.unrealizedPnl = unrealized;
      e.netPnl = realized + unrealized;
      e.pnl = e.netPnl;
    };
    for (const t of traders) {
      withPnl(t, t.holdingUsd);
      enrichTraderAliases(t);
    }
    for (const h of holders) {
      withPnl(h, h.usdValue);
      if (h.buyVol != null) { h.boughtUsd = h.buyVol; h.bought = h.buyVol; }
      if (h.sellVol != null) { h.soldUsd = h.sellVol; h.sold = h.sellVol; }
    }
    return send(res, 200, {
      ok: true, mint, holders, traders, trades,
      tradeCount: trades.length,
      holderCount, // total from Jupiter — distinct from holders.length (top-N sample)
      topHoldersCount: holders.length,
      holdersSource: holdersRes.source, holdersStale: holdersRes.stale,
    });
  } catch (e) {
    return send(res, 200, { ok: false, mint, holders: [], traders: [], trades: [], holderCount: null, error: String(e?.message || e) });
  }
}
