// OG DEX — top holders + top traders for a token. NO Birdeye.
// Holders: resilient Helius largest-accounts (retry + owner-resolve + whale
// labels + last-known-good cache) via _holders.js. Traders: GeckoTerminal
// recent trades on the DEEPEST pool(s), with DexScreener pool fallback + retries.
// Also returns the raw trade tape so Live Trades UI works even when INTEL_FN is down.
import { send, cache, kvGet, kvPut, callFn, INTEL_FN } from "../_lib.js";
import { getLabeledHolders } from "../_holders.js";

const JUP = "https://lite-api.jup.ag";
const GT = "https://api.geckoterminal.com/api/v2";
const GT_HEADERS = {
  Accept: "application/json;version=20230302",
  "User-Agent": "OrbitXDEX/1.0 (+https://orbitx.world)",
};
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

async function gtFetch(path, timeout = 10000, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    const ctl = new AbortController();
    const id = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(`${GT}${path}`, { headers: GT_HEADERS, signal: ctl.signal });
      if (r.status === 429 || r.status >= 500) {
        if (i < attempts - 1) { await new Promise((x) => setTimeout(x, 350 * (i + 1))); continue; }
        return null;
      }
      if (!r.ok) return null;
      return await r.json();
    } catch {
      if (i < attempts - 1) { await new Promise((x) => setTimeout(x, 300 * (i + 1))); continue; }
      return null;
    } finally { clearTimeout(id); }
  }
  return null;
}

/** Side/amount relative to the queried mint (not just GT pool base kind). */
function mapGtTrade(a, mint) {
  const m = String(mint || "").toLowerCase();
  const from = String(a.from_token_address || "").toLowerCase();
  const to = String(a.to_token_address || "").toLowerCase();
  let side;
  if (m && to === m) side = "buy";
  else if (m && from === m) side = "sell";
  else side = String(a.kind || "").toLowerCase() === "sell" ? "sell" : "buy";
  const buy = side === "buy";
  const tokenAmount = num(
    m && (from === m || to === m)
      ? (to === m ? a.to_token_amount : a.from_token_amount)
      : (buy ? a.to_token_amount : a.from_token_amount),
  );
  const priceUsd = num(
    m && (from === m || to === m)
      ? (to === m ? a.price_to_in_usd : a.price_from_in_usd)
      : (buy ? a.price_to_in_usd : a.price_from_in_usd),
  ) ?? num(a.price_to_in_usd) ?? num(a.price_from_in_usd);
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

async function dexPools(mint) {
  try {
    const ctl = new AbortController();
    const id = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      headers: { Accept: "application/json" },
      signal: ctl.signal,
    });
    clearTimeout(id);
    if (!r.ok) return [];
    const d = await r.json();
    return (d?.pairs || [])
      .filter((p) => p?.chainId === "solana" && p?.baseToken?.address === mint && p?.pairAddress)
      .map((p) => ({ addr: p.pairAddress, resv: num(p.liquidity?.usd) || 0 }))
      .sort((a, b) => b.resv - a.resv)
      .slice(0, 3);
  } catch { return []; }
}

async function gtPools(mint) {
  const pd = await gtFetch(`/networks/solana/tokens/${mint}/pools?page=1`);
  return (pd?.data || [])
    .map((p) => ({ addr: p.attributes?.address, resv: num(p.attributes?.reserve_in_usd) || 0 }))
    .filter((p) => p.addr)
    .sort((a, b) => b.resv - a.resv)
    .slice(0, 3);
}

// Top traders + trade tape via GeckoTerminal recent trades on the deepest pool(s).
async function fetchTradersLive(mint) {
  let pools = await gtPools(mint);
  if (!pools.length) pools = await dexPools(mint);
  else {
    // Merge DexScreener pair if GT list is thin / stale.
    const dex = await dexPools(mint);
    const seen = new Set(pools.map((p) => p.addr));
    for (const p of dex) {
      if (!seen.has(p.addr)) { pools.push(p); seen.add(p.addr); }
    }
    pools = pools.sort((a, b) => b.resv - a.resv).slice(0, 3);
  }
  if (!pools.length) return { traders: [], trades: [], source: "none" };

  const agg = new Map();
  const tape = [];
  const seenTx = new Set();

  const tradeResults = await Promise.all(
    pools.slice(0, 2).map((pool) =>
      gtFetch(`/networks/solana/pools/${pool.addr}/trades?trade_volume_in_usd_greater_than=0`),
    ),
  );

  for (const td of tradeResults) {
    for (const t of td?.data || []) {
      const a = t.attributes || {};
      const row = mapGtTrade(a, mint);
      if (row.txHash) {
        if (seenTx.has(row.txHash)) continue;
        seenTx.add(row.txHash);
      }
      tape.push(row);
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

  return { traders, trades: tape.slice(0, 100), source: tape.length ? "geckoterminal" : "empty" };
}

function normalizeIntelTrade(tr) {
  if (!tr || typeof tr !== "object") return null;
  const side = String(tr.side || tr.kind || "").toLowerCase() === "sell" ? "sell" : "buy";
  const volumeUsd = num(tr.volumeUsd ?? tr.usd ?? tr.amountUsd ?? tr.value);
  const tokenAmount = num(tr.tokenAmount ?? tr.amount);
  let time = tr.time ?? tr.ts ?? tr.timestamp ?? tr.block_timestamp ?? null;
  if (typeof time === "string") {
    const ms = new Date(time).getTime();
    time = Number.isFinite(ms) ? ms : null;
  } else if (typeof time === "number" && time > 0 && time < 1e12) {
    time = time * 1000;
  }
  const owner = tr.owner || tr.wallet || tr.trader || null;
  return {
    side,
    kind: side,
    time,
    volumeUsd,
    usd: volumeUsd,
    amountUsd: volumeUsd,
    tokenAmount,
    amount: tokenAmount,
    priceUsd: num(tr.priceUsd ?? tr.price),
    owner,
    wallet: owner,
    txHash: tr.txHash || tr.tx_hash || tr.signature || null,
    dex: tr.dex || "intel",
  };
}

/** INTEL_FN fallback when GT rate-limits / returns empty tape. */
async function fetchIntelTape(mint) {
  try {
    const intel = await Promise.race([
      callFn(INTEL_FN, { mint }),
      new Promise((r) => setTimeout(() => r(null), 8000)),
    ]);
    const raw = Array.isArray(intel?.trades) ? intel.trades : [];
    const trades = raw.map(normalizeIntelTrade).filter((t) => t && (t.usd != null || t.txHash || t.tokenAmount != null));
    const holders = Array.isArray(intel?.holders) ? intel.holders : [];
    return { trades: trades.slice(0, 100), holders };
  } catch {
    return { trades: [], holders: [] };
  }
}

// Traders with last-known-good fallback + intel tape backup.
async function fetchTraders(mint) {
  const live = await fetchTradersLive(mint).catch(() => ({ traders: [], trades: [], source: "error" }));
  if (live.traders?.length || live.trades?.length) {
    kvPut(`traders/${mint}.json`, { ts: Date.now(), traders: live.traders, trades: live.trades }).catch(() => {});
    return live;
  }

  // GT empty — try intel tape before serving a blank UI.
  const intelPack = await fetchIntelTape(mint);
  if (intelPack.trades.length) {
    const agg = new Map();
    for (const row of intelPack.trades) {
      const who = row.owner;
      if (!who) continue;
      const e = agg.get(who) || { owner: who, buys: 0, sells: 0, buyVol: 0, sellVol: 0 };
      const usd = row.volumeUsd || 0;
      if (row.side === "buy") { e.buys++; e.buyVol += usd; } else { e.sells++; e.sellVol += usd; }
      agg.set(who, e);
    }
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
    const pack = { traders, trades: intelPack.trades, source: "intel", intelHolders: intelPack.holders };
    kvPut(`traders/${mint}.json`, { ts: Date.now(), traders, trades: intelPack.trades }).catch(() => {});
    return pack;
  }

  const cached = await kvGet(`traders/${mint}.json`).catch(() => null);
  if (cached?.traders?.length || cached?.trades?.length) {
    return {
      traders: (cached.traders || []).map((t) => ({ ...t, stale: true })),
      trades: (cached.trades || []).map((t) => ({ ...t, stale: true })),
      source: "cache",
    };
  }
  return { traders: [], trades: [], source: live.source || "none", intelHolders: intelPack.holders };
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

function normalizeHolderRow(h, i, price) {
  if (!h || typeof h !== "object") return null;
  const owner = h.owner || h.address || h.wallet || h.tokenAccount;
  if (!owner) return null;
  const uiAmount = num(h.uiAmount ?? h.amount ?? h.balance ?? h.holdingAmount ?? h.tokens) ?? 0;
  const pct = num(h.pct ?? h.percentage ?? h.percent ?? h.holdingPct);
  let usdValue = num(h.usdValue ?? h.holdingUsd ?? h.usd ?? h.value);
  if (usdValue == null && price != null && uiAmount > 0) usdValue = uiAmount * price;
  return {
    ...h,
    rank: h.rank || i + 1,
    owner,
    uiAmount,
    amount: uiAmount,
    pct,
    usdValue,
    holdingUsd: usdValue,
    label: h.label || (pct != null && pct >= 1 ? "whale" : pct != null && pct >= 0.5 ? "large holder" : "holder"),
    boughtUsd: num(h.boughtUsd ?? h.bought ?? h.buyVol),
    soldUsd: num(h.soldUsd ?? h.sold ?? h.sellVol),
    buyVol: num(h.buyVol ?? h.boughtUsd ?? h.bought),
    sellVol: num(h.sellVol ?? h.soldUsd ?? h.sold),
  };
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const mint = (url.searchParams.get("mint") || "").trim();
  if (!mint) return send(res, 400, { ok: false, error: "mint required" });

  try {
    const [price, holderCount] = await Promise.all([fetchPrice(mint), fetchHolderCount(mint)]);
    const [holdersRes, traderPack] = await Promise.all([
      getLabeledHolders(mint, price),
      fetchTraders(mint),
    ]);

    let holders = (holdersRes.holders || [])
      .map((h, i) => normalizeHolderRow(h, i, price))
      .filter(Boolean);

    // INTEL holders backup when Helius largest-accounts is empty.
    if (!holders.length && Array.isArray(traderPack.intelHolders) && traderPack.intelHolders.length) {
      holders = traderPack.intelHolders
        .map((h, i) => normalizeHolderRow(h, i, price))
        .filter(Boolean);
    } else if (!holders.length) {
      const intelPack = await fetchIntelTape(mint);
      if (intelPack.holders.length) {
        holders = intelPack.holders.map((h, i) => normalizeHolderRow(h, i, price)).filter(Boolean);
      }
    }

    const traders = traderPack.traders || [];
    const trades = traderPack.trades || [];
    const holderMap = new Map(holders.map((h) => [h.owner, h]));
    const traderMap = new Map(traders.map((t) => [t.owner, t]));
    for (const h of holders) {
      const t = traderMap.get(h.owner);
      if (t) {
        h.buyVol = t.buyVol; h.sellVol = t.sellVol; h.buys = t.buys; h.sells = t.sells;
        h.tradeCount = t.tradeCount; h.boughtUsd = t.buyVol; h.soldUsd = t.sellVol;
        h.bought = t.buyVol; h.sold = t.sellVol;
      }
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

    const withPnl = (e, heldRaw) => {
      const cost = num(e.buyVol) || 0;
      const proceeds = num(e.sellVol) || 0;
      const held = num(heldRaw) || 0;
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

    // Never CDN-cache empty trade tapes — a GT blip was blanking the UI for 60s.
    const hasTape = trades.length > 0 || traders.length > 0;
    if (hasTape) cache(res, 45, 300);
    else cache(res, 3, 10);

    return send(res, 200, {
      ok: true, mint, holders, traders, trades,
      tradeCount: trades.length,
      holderCount, // total from Jupiter — distinct from holders.length (top-N sample)
      topHoldersCount: holders.length,
      holdersSource: holdersRes.source, holdersStale: holdersRes.stale,
      tradesSource: traderPack.source || null,
    });
  } catch (e) {
    cache(res, 3, 10);
    return send(res, 200, { ok: false, mint, holders: [], traders: [], trades: [], holderCount: null, error: String(e?.message || e) });
  }
}
