// OG DEX — top holders + top traders for a token. NO Birdeye.
// Holders: Helius getTokenLargestAccounts (via rpc-proxy). Traders: GeckoTerminal
// recent pool trades aggregated by wallet (buys/sells/volume). Price: Jupiter.
import { callFn, send, cache } from "../_lib.js";

const JUP = "https://lite-api.jup.ag";
const GT = "https://api.geckoterminal.com/api/v2";
const GT_HEADERS = { Accept: "application/json;version=20230302" };
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

async function rpc(method, params) {
  try {
    const r = await callFn("rpc-proxy", { jsonrpc: "2.0", id: 1, method, params, provider: "helius" });
    return r?.data?.result ?? r?.result ?? null;
  } catch { return null; }
}

// Top holders via Helius largest token accounts, owner-resolved.
async function fetchHolders(mint) {
  const [largest, supply] = await Promise.all([
    rpc("getTokenLargestAccounts", [mint]),
    rpc("getTokenSupply", [mint]),
  ]);
  const accts = (largest?.value || []).slice(0, 20);
  const total = num(supply?.value?.uiAmount) || 0;
  let owners = {};
  try {
    const infos = await rpc("getMultipleAccounts", [accts.map((a) => a.address), { encoding: "jsonParsed" }]);
    (infos?.value || []).forEach((acc, i) => {
      const o = acc?.data?.parsed?.info?.owner;
      if (o) owners[accts[i].address] = o;
    });
  } catch { /* ignore */ }
  return accts.map((a, i) => {
    const amt = num(a.uiAmount) || 0;
    return { rank: i + 1, owner: owners[a.address] || a.address, uiAmount: amt, pct: total ? (amt / total) * 100 : null, usdValue: null };
  });
}

// Top traders via GeckoTerminal recent trades on the deepest pool.
async function fetchTraders(mint) {
  try {
    const pr = await fetch(`${GT}/networks/solana/tokens/${mint}/pools?page=1`, { headers: GT_HEADERS });
    if (!pr.ok) return [];
    const pd = await pr.json();
    const pool = pd?.data?.[0]?.attributes?.address;
    if (!pool) return [];
    const tr = await fetch(`${GT}/networks/solana/pools/${pool}/trades`, { headers: GT_HEADERS });
    if (!tr.ok) return [];
    const td = await tr.json();
    const agg = new Map();
    for (const t of td?.data || []) {
      const a = t.attributes || {};
      const who = a.tx_from_address;
      if (!who) continue;
      const e = agg.get(who) || { owner: who, buys: 0, sells: 0, buyVol: 0, sellVol: 0 };
      const usd = num(a.volume_in_usd) || 0;
      if ((a.kind || "").toLowerCase() === "buy") { e.buys++; e.buyVol += usd; } else { e.sells++; e.sellVol += usd; }
      agg.set(who, e);
    }
    return [...agg.values()]
      .map((e) => ({ ...e, tradeCount: e.buys + e.sells, volume: e.buyVol + e.sellVol, realizedPnl: null, unrealizedPnl: null, netPnl: null, isHolder: false, holdingPct: null, holdingAmount: null }))
      .sort((a, b) => b.volume - a.volume).slice(0, 50)
      .map((t, i) => ({ rank: i + 1, ...t }));
  } catch { return []; }
}

async function fetchPrice(mint) {
  try {
    const r = await fetch(`${JUP}/price/v3?ids=${mint}`);
    if (!r.ok) return null;
    const d = await r.json();
    return num(d[mint]?.usdPrice);
  } catch { return null; }
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const mint = (url.searchParams.get("mint") || "").trim();
  if (!mint) return send(res, 400, { ok: false, error: "mint required" });
  cache(res, 60, 300);
  try {
    const [holders, traders, price] = await Promise.all([fetchHolders(mint), fetchTraders(mint), fetchPrice(mint)]);
    if (price) for (const h of holders) h.usdValue = h.uiAmount * price;
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
    return send(res, 200, { ok: true, mint, holders, traders });
  } catch (e) {
    return send(res, 200, { ok: false, mint, error: String(e?.message || e) });
  }
}
