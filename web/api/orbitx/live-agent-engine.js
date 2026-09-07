/**
 * Live agent execution — Jupiter swap + DexScreener/pump.fun screens.
 * Signing key is LIVE_AGENT_WALLET_SECRET only. Never log it.
 */
import { createClient } from "@supabase/supabase-js";
import { adminCredentialOk } from "../../shared/desk-unlock.js";
import {
  LIVE_AGENTS,
  LIVE_DISCLAIMER,
  LIVE_MAX_OPEN,
  LIVE_TRADE_USD,
  LIVE_WALLET_PUBKEY,
  SOL_MINT,
  decideLiveExit,
  emptyLiveDesk,
  huntClipUsd,
  liveAgentById,
  liveHunt,
  liveHuntList,
  liveHuntMints,
  normalizeHunt,
  parseHuntSource,
  nextLiveAgent,
  pickLiveToken,
  rankForLiveStyle,
  screenLiveCandidate,
  sizeLiveBuy,
  summarizeLiveLedger,
  mergeLiveFeed,
  writeLiveThesis,
  liveIsMajor,
  LIVE_MAX_PROBES,
  LIVE_SCALE_KEEP_PCT,
  LIVE_SCALE_SELL_PCT,
} from "../../shared/orbitx-live-desk.js";

const JUP = "https://lite-api.jup.ag";
const PUMP = "https://frontend-api-v3.pump.fun/coins";
const DEX = "https://api.dexscreener.com/latest/dex";

function trim(v) {
  return String(v || "").trim();
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function raceMs(work, ms, fallback) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(work),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function truthy(v) {
  const s = trim(v).toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export function liveDeskEnabled(env = process.env) {
  return truthy(env.LIVE_AGENT_ENABLED);
}

export function liveDeskArmedEnv(env = process.env) {
  return truthy(env.LIVE_AGENT_ARMED);
}

export function liveDeskDryRun(env = process.env) {
  return truthy(env.LIVE_AGENT_DRY_RUN);
}

export function liveWalletSecret(env = process.env) {
  return trim(env.LIVE_AGENT_WALLET_SECRET || env.LIVE_AGENT_SECRET_KEY);
}

export function adminLiveOk(provided, env = process.env) {
  return adminCredentialOk(provided, env);
}

function adminSb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Paper mode: same agents, same scans, same real prices — simulated fills, mock bank. */
const PAPER_CTX = { paper: false };
export const PAPER_START_USD_DEFAULT = 10_000;
export const PAPER_CLIP_PCT = 0.02;
export const PAPER_SIGNATURE = "paper";
export const PAPER_MAX_OPEN = 6;
export const PAPER_APE_EVERY_MS = 5 * 60_000;
const PAPER_HARD_SKIP = /bad mint|sol mint|stable \/ skip|mcap too large/;
/** Paper desk apes: only hard filters (bad mint, SOL/stables, majors, too-large MC, no price). */
export function paperApeOk(coin, screenFn = screenLiveCandidate) {
  if (!(num(coin?.price_usd) > 0)) return false;
  if (liveIsMajor(coin)) return false;
  const cheap = screenFn(coin, { canBuy: true, canSell: true });
  return !(cheap.reasons || []).some((r) => PAPER_HARD_SKIP.test(String(r)));
}
function paperCashUsd(fills, startUsd) {
  let cash = num(startUsd);
  for (const f of fills || []) {
    const usd = num(f.usd_amount);
    if (String(f.side) === "buy") cash -= usd;
    else if (String(f.side) === "sell") cash += usd;
  }
  return cash;
}

function rpcUrl() {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.HELIUS_RPC_URL ||
    (process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : "") ||
    "https://api.mainnet-beta.solana.com"
  );
}

async function rpc(method, params) {
  const r = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12_000),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "rpc_error");
  return j.result;
}

async function jget(path, timeoutMs = 10_000) {
  const r = await fetch(`${JUP}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`jupiter ${r.status}`);
  return r.json();
}

async function loadKeypair(secret) {
  const s = trim(secret);
  if (!s) return null;
  const [{ Keypair }, bs58] = await Promise.all([import("@solana/web3.js"), import("bs58")]);
  if (s.startsWith("[")) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(s)));
  }
  const decode = bs58.default?.decode || bs58.decode;
  return Keypair.fromSecretKey(decode(s));
}

async function solPriceUsd() {
  try {
    const j = await jget(`/price/v3?ids=${SOL_MINT}`, 5_000);
    const row = j?.[SOL_MINT] || j?.data?.[SOL_MINT] || j;
    const px = num(row?.usdPrice ?? row?.price ?? row?.usd);
    if (px > 0) return px;
  } catch {
    /* v2 fallback */
  }
  try {
    const j = await jget(`/price/v2?ids=${SOL_MINT}`, 5_000);
    const px = num(j?.data?.[SOL_MINT]?.price);
    if (px > 0) return px;
  } catch {
    /* ignore */
  }
  return 0;
}

async function solBalance(pubkey) {
  const r = await rpc("getBalance", [pubkey, { commitment: "confirmed" }]);
  return num(r?.value ?? r) / 1e9;
}

async function quoteSwap(inputMint, outputMint, amount, slippageBps = 150) {
  try {
    const q = await jget(
      `/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`,
    );
    if (!q || q.error || !q.outAmount) return null;
    return q;
  } catch {
    return null;
  }
}

export async function probeSellability(mint, amountLamports = 15_000_000) {
  const buyQ = await quoteSwap(SOL_MINT, mint, amountLamports, 150);
  if (!buyQ) return { canBuy: false, canSell: false, bondingOnly: false };
  const buyImpactPct = buyQ.priceImpactPct != null ? Math.abs(num(buyQ.priceImpactPct)) * 100 : null;
  const sellQ = await quoteSwap(mint, SOL_MINT, buyQ.outAmount, 200);
  if (!sellQ) return { canBuy: true, canSell: false, buyImpactPct, roundTripLossPct: null };
  const solBack = num(sellQ.outAmount);
  const roundTripLossPct = ((amountLamports - solBack) / amountLamports) * 100;
  return {
    canBuy: true,
    canSell: true,
    buyImpactPct,
    sellImpactPct: sellQ.priceImpactPct != null ? Math.abs(num(sellQ.priceImpactPct)) * 100 : null,
    roundTripLossPct: Math.max(0, roundTripLossPct),
    buyQuote: buyQ,
  };
}

function fromDexPair(p) {
  const base = p?.baseToken || {};
  const mint = base.address;
  if (!mint) return null;
  const created = num(p?.pairCreatedAt);
  const ageMin = created > 0 ? (Date.now() - created) / 60_000 : null;
  const socials = Array.isArray(p?.info?.socials) ? p.info.socials : [];
  const websites = Array.isArray(p?.info?.websites) ? p.info.websites : [];
  const twitter = socials.find((s) => String(s.type || "").toLowerCase() === "twitter")?.url || null;
  const telegram = socials.find((s) => String(s.type || "").toLowerCase() === "telegram")?.url || null;
  const website = websites[0]?.url || websites[0] || null;
  const h1 = p?.txns?.h1 || {};
  return {
    mint,
    symbol: String(base.symbol || mint.slice(0, 4)).toUpperCase(),
    name: base.name || base.symbol || mint.slice(0, 6),
    image: p?.info?.imageUrl || null,
    price_usd: num(p?.priceUsd),
    change_5m: p?.priceChange?.m5 == null ? null : num(p.priceChange.m5),
    change_15m: p?.priceChange?.m15 == null ? null : num(p.priceChange.m15),
    change_1h: p?.priceChange?.h1 == null ? null : num(p.priceChange.h1),
    change_24h: p?.priceChange?.h24 == null ? null : num(p.priceChange.h24),
    volume_1h: num(p?.volume?.h1),
    volume_24h: num(p?.volume?.h24),
    liquidity_usd: num(p?.liquidity?.usd),
    market_cap: num(p?.marketCap || p?.fdv),
    pair_age_min: ageMin,
    buys_1h: num(h1.buys),
    sells_1h: num(h1.sells),
    txns_1h: num(h1.buys) + num(h1.sells),
    twitter,
    telegram,
    website,
    socials,
    dex: p?.dexId || null,
    url: p?.url || `https://dexscreener.com/solana/${mint}`,
  };
}

function fromJupToken(row) {
  const mint = row?.id || row?.address || row?.mint;
  if (!mint) return null;
  return {
    mint,
    symbol: String(row.symbol || mint.slice(0, 4)).toUpperCase(),
    name: row.name || row.symbol || mint.slice(0, 6),
    image: row.icon || row.logoURI || null,
    price_usd: num(row.usdPrice ?? row.price),
    change_5m: row.stats5m?.priceChange ?? row.priceChange5m ?? null,
    change_15m: row.stats15m?.priceChange ?? row.priceChange15m ?? null,
    change_1h: num(row.stats1h?.priceChange ?? row.priceChange1h),
    change_24h: num(row.stats24h?.priceChange ?? row.priceChange24h),
    volume_24h: num(row.stats24h?.buyVolume ?? row.volume24h ?? row.v24hUSD),
    liquidity_usd: num(row.liquidity ?? row.liquidityUsd),
    market_cap: num(row.mcap ?? row.fdv ?? row.marketCap),
    pair_age_min: row.firstPool?.createdAt ? (Date.now() - Date.parse(row.firstPool.createdAt)) / 60_000 : null,
    dex: "jupiter",
    url: `https://dexscreener.com/solana/${mint}`,
  };
}

async function hydrateDex(mints) {
  const out = [];
  const chunk = mints.filter(Boolean).slice(0, 30);
  if (!chunk.length) return out;
  try {
    const r = await fetch(`${DEX}/tokens/${chunk.join(",")}`, { signal: AbortSignal.timeout(10_000) });
    const j = await r.json();
    for (const p of j?.pairs || []) {
      if (p?.chainId !== "solana") continue;
      const row = fromDexPair(p);
      if (row) out.push(row);
    }
  } catch {
    /* DexScreener optional */
  }
  return out;
}

async function loadBoostedMints() {
  const set = new Set();
  const pages = await Promise.all(
    ["token-boosts/top/v1", "token-boosts/latest/v1"].map(async (path) => {
      try {
        const r = await fetch(`https://api.dexscreener.com/${path}`, { signal: AbortSignal.timeout(7000) });
        const j = await r.json();
        return Array.isArray(j) ? j : [];
      } catch {
        return [];
      }
    }),
  );
  for (const rows of pages) {
    for (const row of rows) {
      const mint = row?.tokenAddress || row?.address;
      const chain = String(row?.chainId || "").toLowerCase();
      if (mint && (!chain || chain === "solana")) set.add(mint);
    }
  }
  return set;
}

export async function loadLiveTape() {
  const coins = [];
  const [jupRows, pumpList, boosted] = await Promise.all([
    Promise.all(
      ["/tokens/v2/toptraded/1h?limit=30", "/tokens/v2/toptraded/24h?limit=24"].map(async (path) => {
        try {
          const j = await jget(path, 8000);
          return Array.isArray(j) ? j : j?.tokens || [];
        } catch {
          return [];
        }
      }),
    ).then((windows) => windows.flat()),
    (async () => {
      try {
        const r = await fetch(`${PUMP}?limit=40&offset=0&sort=last_trade_timestamp&order=DESC&includeNsfw=false`, {
          headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(8000),
        });
        const j = await r.json();
        return Array.isArray(j) ? j : j?.coins || [];
      } catch {
        return [];
      }
    })(),
    loadBoostedMints(),
  ]);
  for (const row of jupRows) {
    const mapped = fromJupToken(row);
    if (mapped) coins.push(mapped);
  }
  for (const c of pumpList) {
    const mint = c?.mint;
    if (!mint) continue;
    coins.push({
      mint,
      symbol: String(c.symbol || mint.slice(0, 4)).toUpperCase(),
      name: c.name || c.symbol || mint.slice(0, 6),
      image: c.image_uri || null,
      price_usd: num(c.usd_market_cap) && num(c.total_supply) ? num(c.usd_market_cap) / Math.max(1, num(c.total_supply)) : 0,
      change_1h: null,
      change_24h: null,
      volume_24h: num(c.volume_24h ?? c.virtual_sol_reserves) * 150,
      liquidity_usd: num(c.virtual_sol_reserves) * 2 * 150,
      market_cap: num(c.usd_market_cap),
      pair_age_min: c.created_timestamp ? (Date.now() - num(c.created_timestamp)) / 60_000 : null,
      pump_complete: Boolean(c.complete),
      dex: "pump.fun",
      url: `https://pump.fun/${mint}`,
    });
  }
  const extra = await hydrateDex([...new Set([...liveHuntMints(), ...coins.map((c) => c.mint)])].slice(0, 30));
  coins.push(...extra);
  const byMint = new Map();
  for (const c of coins) {
    const prev = byMint.get(c.mint);
    const row = prev
      ? {
          ...prev,
          ...c,
          liquidity_usd: Math.max(num(prev.liquidity_usd), num(c.liquidity_usd)),
          volume_24h: Math.max(num(prev.volume_24h), num(c.volume_24h)),
          volume_1h: Math.max(num(prev.volume_1h), num(c.volume_1h)),
          buys_1h: Math.max(num(prev.buys_1h), num(c.buys_1h)),
          sells_1h: Math.max(num(prev.sells_1h), num(c.sells_1h)),
          txns_1h: Math.max(num(prev.txns_1h), num(c.txns_1h)),
          market_cap: num(c.market_cap) || num(prev.market_cap),
          change_5m: c.change_5m ?? prev.change_5m,
          change_15m: c.change_15m ?? prev.change_15m,
          change_1h: c.change_1h ?? prev.change_1h,
          change_24h: c.change_24h ?? prev.change_24h,
          pair_age_min: c.pair_age_min ?? prev.pair_age_min,
          pump_complete: c.pump_complete ?? prev.pump_complete,
          twitter: c.twitter || prev.twitter,
          telegram: c.telegram || prev.telegram,
          website: c.website || prev.website,
          socials: c.socials?.length ? c.socials : prev.socials,
        }
      : c;
    row.boosted = Boolean(row.boosted || prev?.boosted || boosted.has(c.mint));
    byMint.set(c.mint, row);
  }
  const all = [...byMint.values()];
  const hunts = all.filter((c) => liveHunt(c));
  const rest = all
    .filter((c) => !liveHunt(c))
    .sort((a, b) => num(b.volume_1h) - num(a.volume_1h) || num(b.volume_24h) - num(a.volume_24h))
    .slice(0, Math.max(0, 48 - hunts.length));
  return hunts.concat(rest);
}

async function pumpMeta(mint) {
  try {
    const r = await fetch(`${PUMP}/${mint}`, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

async function markPriceUsd(mint) {
  try {
    const r = await fetch(`${DEX}/tokens/${mint}`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const pairs = (j?.pairs || []).filter((p) => p?.chainId === "solana");
    pairs.sort((a, b) => num(b?.liquidity?.usd) - num(a?.liquidity?.usd));
    const px = num(pairs[0]?.priceUsd);
    const mcap = num(pairs[0]?.marketCap || pairs[0]?.fdv);
    if (px > 0) return { price: px, mcap };
  } catch {
    /* ignore */
  }
  try {
    const j = await jget(`/price/v3?ids=${mint}`);
    const px = num(j?.[mint]?.usdPrice ?? j?.data?.[mint]?.price);
    if (px > 0) return { price: px, mcap: 0 };
  } catch {
    /* ignore */
  }
  return { price: 0, mcap: 0 };
}

function unwrapMark(raw) {
  if (raw && typeof raw === "object") {
    return { price: num(raw.price ?? raw.usd ?? raw.mark), mcap: num(raw.mcap ?? raw.market_cap ?? raw.marketCap) };
  }
  return { price: num(raw), mcap: 0 };
}

async function buildAndSignSwap({ quote, owner, keypair }) {
  const r = await fetch(`${JUP}/swap/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: owner,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
    signal: AbortSignal.timeout(12_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.swapTransaction) return { ok: false, error: j.error || "jupiter swap failed" };
  const { VersionedTransaction } = await import("@solana/web3.js");
  const tx = VersionedTransaction.deserialize(Buffer.from(j.swapTransaction, "base64"));
  tx.sign([keypair]);
  const raw = Buffer.from(tx.serialize()).toString("base64");
  const sig = await rpc("sendRawTransaction", [
    raw,
    { encoding: "base64", skipPreflight: false, maxRetries: 3 },
  ]);
  return { ok: true, signature: sig, via: "jupiter", outAmount: quote.outAmount };
}

async function confirmSig(signature) {
  for (let i = 0; i < 8; i += 1) {
    try {
      const st = await rpc("getSignatureStatuses", [[signature], { searchTransactionHistory: true }]);
      const row = st?.value?.[0];
      if (row?.confirmationStatus === "confirmed" || row?.confirmationStatus === "finalized") {
        if (row.err) return { ok: false, error: "tx_err" };
        return { ok: true };
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return { ok: true, pending: true };
}

async function loadDeskRow(sb) {
  if (!sb) return { id: "main", armed: false, paused: false, last_agent_id: null };
  const { data, error } = await sb.from("ox_live_desk").select("*").eq("id", "main").maybeSingle();
  if (error || !data) return { id: "main", armed: false, paused: false, last_agent_id: null };
  return data;
}

async function upsertDesk(sb, patch) {
  if (!sb) return { error: null };
  const { error } = await sb.from("ox_live_desk").upsert(
    { id: "main", updated_at: new Date().toISOString(), ...patch },
    { onConflict: "id" },
  );
  return { error: error || null };
}

async function loadOpen(sb) {
  if (!sb) return [];
  const { data } = await sb.from("ox_live_positions").select("*").eq("status", "open").eq("paper", PAPER_CTX.paper).order("opened_at", { ascending: true });
  return data || [];
}

async function loadFills(sb, limit = 200) {
  if (!sb) return [];
  const { data } = await sb.from("ox_live_fills").select("*").eq("paper", PAPER_CTX.paper).order("created_at", { ascending: false }).limit(limit);
  return data || [];
}

async function loadEvents(sb, limit = 80) {
  if (!sb) return [];
  const { data } = await sb.from("ox_live_events").select("*").eq("paper", PAPER_CTX.paper).order("created_at", { ascending: false }).limit(limit);
  return data || [];
}

async function recordEvent(sb, row) {
  if (!sb) return;
  try {
    await sb.from("ox_live_events").insert({
      paper: PAPER_CTX.paper,
      kind: row.kind,
      agent_id: row.agent_id || null,
      mint: row.mint || null,
      symbol: row.symbol || null,
      side: row.side || null,
      usd_amount: row.usd_amount ?? row.usd ?? null,
      sol_amount: row.sol_amount ?? row.sol ?? null,
      pnl_usd: row.pnl_usd ?? null,
      thesis: row.thesis || null,
      reason: row.reason || null,
      signature: row.signature || null,
      meta: row.meta || null,
    });
  } catch {
    /* tape is best-effort */
  }
}

async function recentWalletSigs(pubkey) {
  if (!pubkey) return [];
  try {
    const rows = await rpc("getSignaturesForAddress", [pubkey, { limit: 20 }]);
    return (rows || []).map((s) => ({
      signature: s.signature,
      slot: s.slot,
      err: s.err || null,
      blockTime: s.blockTime || null,
      url: `https://solscan.io/tx/${s.signature}`,
    }));
  } catch {
    return [];
  }
}

function publicPosition(p, markUsd = null) {
  const entry = num(p.entry_price_usd);
  const mark = markUsd != null ? num(markUsd) : null;
  const pnlPct = entry > 0 && mark > 0 ? ((mark - entry) / entry) * 100 : null;
  return {
    id: p.id,
    agent_id: p.agent_id,
    agent_name: liveAgentById(p.agent_id)?.name || p.agent_id,
    mint: p.mint,
    symbol: p.symbol,
    name: p.name,
    image: p.image,
    sol_in: num(p.sol_in),
    usd_in: num(p.usd_in),
    entry_price_usd: entry,
    mark_usd: mark,
    pnl_pct: pnlPct,
    tp_pct: num(p.tp_pct) * 100,
    thesis: p.thesis,
    signature: p.signature,
    opened_at: p.opened_at,
  };
}

export async function snapshotLiveDesk(opts = {}) {
  const sb = opts.sb === undefined ? adminSb() : opts.sb;
  const secret = liveWalletSecret();
  let wallet = LIVE_WALLET_PUBKEY;
  try {
    if (secret) {
      const kp = await loadKeypair(secret);
      if (kp) wallet = kp.publicKey.toBase58();
    }
  } catch {
    /* keep deposit address */
  }
  const row = await loadDeskRow(sb).catch(() => ({ armed: false, paused: false }));
  parseHuntSource(process.env.LIVE_HUNT_JSON || process.env.LIVE_HUNT, row.note);
  const paper = Boolean(row.paper);
  PAPER_CTX.paper = paper;
  const paperStartUsd = paper ? num(row.paper_start_usd, PAPER_START_USD_DEFAULT) || PAPER_START_USD_DEFAULT : null;
  const armed = paper ? true : Boolean(row.armed) || liveDeskArmedEnv();
  const enabled = paper ? true : liveDeskEnabled();
  let solBal = null;
  let solUsd = opts.sol_usd ?? null;
  try {
    if (solUsd == null && (!opts.skipChain || paper)) solUsd = await raceMs(solPriceUsd(), 5_000, null);
  } catch {
    solUsd = null;
  }
  const openRows = await loadOpen(sb).catch(() => []);
  const fills = await loadFills(sb).catch(() => []);
  const events = await loadEvents(sb).catch(() => []);
  try {
    if (paper) solBal = solUsd ? paperCashUsd(fills, paperStartUsd) / solUsd : null;
    else if (opts.sol_balance != null) solBal = num(opts.sol_balance);
    else if (!opts.skipChain) solBal = await solBalance(wallet);
  } catch {
    solBal = null;
  }
  const chain = opts.chain || (!opts.skipChain && !paper ? await recentWalletSigs(wallet).catch(() => []) : []);
  const open = [];
  for (const p of openRows) {
    let mark = null;
    try {
      if (!opts.skipChain || paper) mark = await raceMs(markPriceUsd(p.mint), 4_000, null);
    } catch {
      mark = null;
    }
    open.push(publicPosition(p, mark || null));
  }
  const realized = fills.filter((f) => f.side === "sell").reduce((s, f) => s + num(f.pnl_usd), 0);
  const usdBal = paper ? paperCashUsd(fills, paperStartUsd) : solBal != null && solUsd ? solBal * solUsd : null;
  const unrealized = open.reduce((s, p) => {
    if (p.pnl_pct == null) return s;
    return s + (num(p.usd_in) * p.pnl_pct) / 100;
  }, 0);
  const equityUsd = usdBal != null ? usdBal + open.reduce((s, p) => s + num(p.usd_in), 0) + unrealized : null;
  let startingSol = paper ? (solUsd ? paperStartUsd / solUsd : null) : row.starting_sol != null ? num(row.starting_sol) : null;
  let startingUsd = paper ? paperStartUsd : row.starting_usd != null ? num(row.starting_usd) : null;
  if (!paper && sb && solBal != null && solBal > 0.001 && (startingSol == null || startingSol <= 0)) {
    startingSol = solBal;
    startingUsd = solUsd ? solBal * solUsd : null;
    await upsertDesk(sb, {
      wallet_pubkey: wallet,
      starting_sol: startingSol,
      starting_usd: startingUsd,
      starting_captured_at: new Date().toISOString(),
    }).catch(() => {});
  }
  const publicFills = fills.map((f) => ({
    id: f.id,
    agent_id: f.agent_id,
    mint: f.mint,
    symbol: f.symbol,
    side: f.side,
    sol_amount: num(f.sol_amount),
    usd_amount: num(f.usd_amount),
    pnl_usd: num(f.pnl_usd),
    pnl_pct: f.pnl_pct != null ? num(f.pnl_pct) : null,
    signature: f.signature,
    thesis: f.thesis,
    reason: f.reason,
    created_at: f.created_at,
  }));
  const ledger = summarizeLiveLedger({
    fills: publicFills,
    open,
    agents: LIVE_AGENTS,
    startingUsd,
    startingSol,
    solBalance: solBal,
    usdBalance: usdBal,
    equityUsd,
    realizedPnlUsd: realized,
  });
  const publicEvents = events
    .filter((e) => !(e.kind === "tick" && String(e.reason || "") === "scan"))
    .map((e) => ({
    id: e.id,
    created_at: e.created_at,
    kind: e.kind,
    agent_id: e.agent_id,
    mint: e.mint,
    symbol: e.symbol,
    usd_amount: e.usd_amount != null ? num(e.usd_amount) : null,
    sol_amount: e.sol_amount != null ? num(e.sol_amount) : null,
    pnl_usd: e.pnl_usd != null ? num(e.pnl_usd) : null,
    thesis: e.thesis,
    reason: e.reason,
    signature: e.signature,
  }));
  const feed = mergeLiveFeed({ fills: publicFills, events: publicEvents, chain, wallet });
  const lastActivity =
    row.last_tick_at || feed[0]?.at || feed[0]?.created_at || publicEvents[0]?.created_at || null;
  return emptyLiveDesk({
    wallet,
    enabled,
    armed,
    paper,
    mode: paper ? "paper" : "live",
    paper_start_usd: paperStartUsd,
    paused: Boolean(row.paused),
    configured: Boolean(secret),
    sol_usd: solUsd,
    sol_balance: solBal,
    usd_balance: usdBal,
    equity_usd: equityUsd,
    realized_pnl_usd: realized,
    starting_usd: startingUsd,
    starting_sol: startingSol,
    ledger,
    open,
    fills: publicFills,
    events: publicEvents,
    chain,
    feed,
    hunt: liveHuntList(),
    agents: ledger.books,
    last_tick_at: row.last_tick_at || lastActivity || null,
    last_activity_at: lastActivity,
    last_error: row.last_error || null,
  });
}

async function recordFill(sb, row) {
  if (!sb) return;
  await sb.from("ox_live_fills").insert({ paper: PAPER_CTX.paper, created_at: new Date().toISOString(), ...row });
}

async function closePosition(sb, id, patch) {
  if (!sb) return;
  await sb.from("ox_live_positions").update({ status: "closed", closed_at: new Date().toISOString(), ...patch }).eq("id", id);
}

async function openPosition(sb, row) {
  if (!sb) return null;
  const { data } = await sb.from("ox_live_positions").insert({ paper: PAPER_CTX.paper, ...row, status: "open" }).select("*").single();
  return data;
}

async function tokenRawBalance(owner, mint, usePublic = false) {
  const params = [owner, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }];
  const parsed = usePublic
    ? await fetch("https://api.mainnet-beta.solana.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner", params }),
        signal: AbortSignal.timeout(12_000),
      }).then((r) => r.json()).then((j) => { if (j.error) throw new Error(j.error.message); return j.result; })
    : await rpc("getTokenAccountsByOwner", params);
  const accs = parsed?.value || [];
  let raw = 0n;
  for (const a of accs) {
    const amt = a?.account?.data?.parsed?.info?.tokenAmount?.amount;
    if (amt) raw += BigInt(amt);
  }
  return raw;
}

/**
 * Market-cap take-profit ladder (ox_live_tp_orders). Independent of the
 * armed/paused hunt loop so owner exits fire every minute no matter what.
 * Orders on the same mint fill lowest target first; sell_pct applies to the
 * balance held at fill time (50% then 100% = half, then everything left).
 */
export async function runTakeProfitOrders(opts = {}) {
  const sb = opts.sb === undefined ? adminSb() : opts.sb;
  const deskRow = sb ? await loadDeskRow(sb).catch(() => ({})) : {};
  if (deskRow?.paper && !opts.force) return { skipped: "paper_mode" };
  const out = { checked: 0, filled: [], failed: [], skipped: [] };
  if (!sb) return { ...out, skipped: ["no_db"] };
  const { data: orders } = await sb
    .from("ox_live_tp_orders")
    .select("*")
    .eq("status", "open")
    .order("target_mc_usd", { ascending: true });
  if (!orders?.length) return out;

  let keypair = opts.keypair || null;
  if (!keypair) {
    const secret = liveWalletSecret();
    if (!secret) return { ...out, skipped: ["missing_wallet_secret"] };
    keypair = await loadKeypair(secret);
  }
  const owner = keypair.publicKey?.toBase58?.() || LIVE_WALLET_PUBKEY;
  const swapFn = paper
    ? async ({ quote }) => ({ ok: true, signature: PAPER_SIGNATURE, via: "paper", outAmount: quote?.outAmount })
    : opts.swap || (async ({ quote }) => buildAndSignSwap({ quote, owner, keypair }));
  const markFn = opts.mark || markPriceUsd;
  const solUsd = num(opts.sol_usd) || (await raceMs(solPriceUsd(), 5_000, 0));
  const now = new Date().toISOString();
  const marks = new Map();

  for (const o of orders) {
    out.checked += 1;
    let marked = marks.get(o.mint);
    if (!marked) {
      marked = unwrapMark(await markFn(o.mint).catch(() => 0));
      marks.set(o.mint, marked);
    }
    const mcap = num(marked.mcap);
    await sb.from("ox_live_tp_orders").update({ last_mc_usd: mcap || null, last_checked_at: now }).eq("id", o.id).catch(() => {});
    if (!(mcap > 0) || mcap < num(o.target_mc_usd)) continue;

    let raw = 0n;
    let readErr = null;
    for (let i = 0; i < 3 && raw <= 0n; i += 1) {
      try {
        raw = await tokenRawBalance(owner, o.mint, i > 0);
      } catch (e) {
        readErr = String(e?.message || e);
      }
    }
    if (raw <= 0n) {
      // Never permanently fail on a read error — retry next minute.
      await sb.from("ox_live_tp_orders").update({ last_error: readErr ? `balance_read: ${readErr}` : "no_tokens", attempts: num(o.attempts) + 1 }).eq("id", o.id).catch(() => {});
      out.failed.push({ id: o.id, mint: o.mint, error: readErr || "no_tokens" });
      continue;
    }
    const pct = Math.min(100, Math.max(0, num(o.sell_pct)));
    const sellRaw = pct >= 100 ? raw : (raw * BigInt(Math.round(pct * 100))) / 10000n;
    if (sellRaw <= 0n) continue;

    let sent = { ok: false, error: "no_route" };
    let quote = null;
    for (const slip of [300, 800, 1500]) {
      quote = await quoteSwap(o.mint, SOL_MINT, sellRaw.toString(), slip).catch(() => null);
      if (!quote) continue;
      sent = await swapFn({ quote, action: "sell", mint: o.mint }).catch((e) => ({ ok: false, error: String(e?.message || e) }));
      if (sent.ok && sent.signature) {
        const conf = await confirmSig(sent.signature).catch(() => ({ ok: true }));
        if (conf.ok === false) { sent = { ok: false, error: "tx_err" }; continue; }
        break;
      }
    }
    if (!sent.ok) {
      await sb.from("ox_live_tp_orders").update({ last_error: sent.error || "swap_failed", attempts: num(o.attempts) + 1 }).eq("id", o.id).catch(() => {});
      out.failed.push({ id: o.id, mint: o.mint, error: sent.error });
      continue;
    }
    const solOut = num(quote?.outAmount) / 1e9;
    const usdOut = solOut * solUsd;
    await sb.from("ox_live_tp_orders").update({
      status: "filled",
      filled_at: now,
      signature: sent.signature,
      sol_out: solOut,
      usd_out: usdOut,
      attempts: num(o.attempts) + 1,
      last_error: null,
    }).eq("id", o.id).catch(() => {});
    await recordFill(sb, {
      agent_id: "owner",
      mint: o.mint,
      symbol: o.symbol,
      side: "sell",
      sol_amount: solOut,
      usd_amount: usdOut,
      signature: sent.signature,
      thesis: o.note || `take profit ${pct}% at $${num(o.target_mc_usd).toLocaleString()} MC`,
      reason: "take_profit_mc",
    }).catch(() => {});
    await recordEvent(sb, {
      kind: "sell",
      side: "sell",
      agent_id: "owner",
      mint: o.mint,
      symbol: o.symbol,
      usd_amount: usdOut,
      sol_amount: solOut,
      signature: sent.signature,
      reason: `take_profit_mc ${pct}% @ $${Math.round(mcap).toLocaleString()} MC`,
    }).catch(() => {});
    if (pct >= 100) {
      await sb.from("ox_live_positions").update({ status: "closed", closed_at: now, exit_signature: sent.signature, exit_reason: "take_profit_mc" })
        .eq("mint", o.mint).eq("status", "open").catch(() => {});
    }
    out.filled.push({ id: o.id, mint: o.mint, pct, mcap, signature: sent.signature, solOut });
  }
  return out;
}

export async function tickLiveDesk(opts = {}) {
  const sb = opts.sb === undefined ? adminSb() : opts.sb;
  const dry = opts.dryRun === true || liveDeskDryRun();
  const enabled = liveDeskEnabled();
  const secret = liveWalletSecret();
  const actions = [];
  const deadline = Date.now() + 50_000;
  const snap0 = await snapshotLiveDesk({
    sb,
    sol_usd: opts.sol_usd,
    sol_balance: opts.solBalance,
    skipChain: true,
  });

  const row = await loadDeskRow(sb).catch(() => ({ armed: false, paused: false }));
  const paper = Boolean(row.paper);
  PAPER_CTX.paper = paper;
  if (!enabled && !paper) {
    await recordEvent(sb, { kind: "tick", reason: "not_enabled" });
    return { ...snap0, skipped: "not_enabled", disclaimer: LIVE_DISCLAIMER, actions };
  }
  parseHuntSource(process.env.LIVE_HUNT_JSON || process.env.LIVE_HUNT, row.note);
  const armed = paper || Boolean(row.armed) || liveDeskArmedEnv() || opts.force === true;
  if (row.paused && !opts.force) {
    await recordEvent(sb, { kind: "tick", reason: "paused" });
    return { ...snap0, skipped: "paused", armed, actions };
  }
  if (!armed) {
    await recordEvent(sb, { kind: "tick", reason: "not_armed" });
    return { ...snap0, skipped: "not_armed", armed: false, actions };
  }
  if (!opts.force && row.last_tick_at) {
    const ago = Date.now() - Date.parse(row.last_tick_at);
    if (Number.isFinite(ago) && ago >= 0 && ago < 12_000) {
      return { ...snap0, skipped: "tick_busy", armed, actions };
    }
  }
  let keypair = opts.keypair || null;
  if (!keypair && !paper) {
    if (!secret) {
      await recordEvent(sb, { kind: "tick", reason: "missing_wallet_secret" });
      return { ...snap0, skipped: "missing_wallet_secret", actions };
    }
    try {
      keypair = await loadKeypair(secret);
    } catch (e) {
      await upsertDesk(sb, { last_error: "bad_wallet_secret", last_tick_at: new Date().toISOString() }).catch(() => {});
      return { ...snap0, skipped: "bad_wallet_secret", last_error: String(e?.message || e), actions };
    }
  }
  const owner = keypair?.publicKey?.toBase58?.() || opts.owner || LIVE_WALLET_PUBKEY;
  const agent = nextLiveAgent(row.last_agent_id);
  const beatAt = new Date().toISOString();
  await upsertDesk(sb, {
    wallet_pubkey: owner,
    last_tick_at: beatAt,
    last_agent_id: agent.id,
    last_error: null,
  }).catch(() => {});

  try {
  let solUsd = num(opts.sol_usd || snap0.sol_usd);
  let bal = paper ? num(snap0.sol_balance) : opts.solBalance != null ? num(opts.solBalance) : null;
  if (paper && !(bal > 0) && snap0.sol_usd > 0) bal = num(snap0.usd_balance) / num(snap0.sol_usd);
  const [priceGot, balGot] = await Promise.all([
    solUsd > 0 ? Promise.resolve(solUsd) : raceMs(solPriceUsd(), 5_000, 0),
    bal != null ? Promise.resolve(bal) : raceMs(solBalance(owner).catch(() => 0), 8_000, 0),
  ]);
  solUsd = num(priceGot);
  bal = num(balGot);
  if (!(solUsd > 0)) {
    await recordEvent(sb, { kind: "skip", agent_id: agent.id, reason: "no_sol_price" });
    await upsertDesk(sb, { last_error: "no_sol_price", last_tick_at: new Date().toISOString(), last_agent_id: agent.id }).catch(() => {});
    const snap = await snapshotLiveDesk({ sb, skipChain: true });
    return { ...snap, skipped: "no_sol_price", actions, dry };
  }

  const swapFn = paper
    ? async ({ quote }) => ({ ok: true, signature: PAPER_SIGNATURE, via: "paper", outAmount: quote?.outAmount })
    : opts.swap || (async ({ quote }) => buildAndSignSwap({ quote, owner, keypair }));
  const safetyFn = opts.safety || ((mint) => probeSellability(mint));
  const tapeFn = opts.tape || loadLiveTape;
  const markFn = opts.mark || markPriceUsd;
  const open = await loadOpen(sb).catch(() => []);
  const fillsNow = await loadFills(sb).catch(() => []);

  for (const pos of open) {
    const marked = unwrapMark(await markFn(pos.mint).catch(() => 0));
    const mark = marked.price;
    const scaleFill = (fillsNow || []).find(
      (f) => f.mint === pos.mint && String(f.side) === "sell" && String(f.reason || "").includes("scale_out"),
    );
    const decision = decideLiveExit(pos, mark, Date.now(), {
      scaled: Boolean(scaleFill),
      scaledAt: scaleFill?.created_at,
      marketCap: marked.mcap,
    });
    if (decision.action === "hold") continue;
    let raw = dry ? 1_000n : paper ? 0n : await tokenRawBalance(owner, pos.mint).catch(() => 0n);
    if (paper) {
      try { raw = BigInt(String(pos.tokens_raw || "0").replace(/\D/g, "") || "0"); } catch { raw = 0n; }
      if (raw <= 0n) raw = 1_000_000n;
    }
    if (raw <= 0n && !dry) {
      actions.push({ type: "skip_exit", mint: pos.mint, reason: "no_tokens" });
      continue;
    }
    const sellFrac = decision.action === "scale_out" ? LIVE_SCALE_SELL_PCT : 1;
    const sellRaw = (raw * BigInt(Math.round(sellFrac * 1000))) / 1000n;
    if (sellRaw <= 0n) continue;
    const paperSellQ = () => ({
      outAmount: String(Math.max(0, Math.round(((num(pos.usd_in) * sellFrac * (1 + num(decision.pnlPct))) / solUsd) * 1e9))),
      paper: true,
    });
    const sellQ = dry
      ? { outAmount: String(sellRaw) }
      : paper
        ? (await raceMs(quoteSwap(pos.mint, SOL_MINT, sellRaw.toString(), 300).catch(() => null), 6_000, null)) || paperSellQ()
        : await quoteSwap(pos.mint, SOL_MINT, sellRaw.toString(), 300);
    if (!sellQ) {
      actions.push({ type: "skip_exit", mint: pos.mint, reason: "no_sell_route" });
      continue;
    }
    let sent = { ok: true, signature: "dry-run", via: "dry", outAmount: sellQ.outAmount };
    if (!dry) {
      sent = await swapFn({ quote: sellQ, action: "sell", mint: pos.mint });
      if (sent.ok && sent.signature && !paper) await confirmSig(sent.signature).catch(() => ({ ok: true }));
    }
    if (!sent.ok) {
      actions.push({ type: "sell_failed", mint: pos.mint, error: sent.error });
      continue;
    }
    const solOut = num(sellQ.outAmount) / 1e9;
    const usdOut = solOut * solUsd;
    const soldUsdIn = num(pos.usd_in) * sellFrac;
    const pnlUsd = usdOut - soldUsdIn;
    const pnlPct = decision.pnlPct * 100;
    await recordFill(sb, {
      agent_id: pos.agent_id,
      mint: pos.mint,
      symbol: pos.symbol,
      side: "sell",
      sol_amount: solOut,
      usd_amount: usdOut,
      pnl_usd: pnlUsd,
      pnl_pct: pnlPct,
      signature: sent.signature,
      thesis: pos.thesis,
      reason: decision.action,
    }).catch(() => {});
    if (decision.action === "scale_out") {
      const keepRaw = raw - sellRaw;
      await sb
        .from("ox_live_positions")
        .update({
          tokens_raw: keepRaw.toString(),
          usd_in: num(pos.usd_in) * LIVE_SCALE_KEEP_PCT,
          sol_in: num(pos.sol_in) * LIVE_SCALE_KEEP_PCT,
        })
        .eq("id", pos.id)
        .catch(() => {});
    } else {
      await closePosition(sb, pos.id, { exit_signature: sent.signature, exit_reason: decision.action, pnl_usd: pnlUsd }).catch(() => {});
    }
    await recordEvent(sb, {
      kind: decision.action === "scale_out" ? "scale_out" : "sell",
      side: "sell",
      agent_id: pos.agent_id,
      mint: pos.mint,
      symbol: pos.symbol,
      usd_amount: usdOut,
      sol_amount: solOut,
      pnl_usd: pnlUsd,
      thesis: pos.thesis,
      reason: decision.action,
      signature: sent.signature,
    });
    actions.push({
      type: "sell",
      agent_id: pos.agent_id,
      mint: pos.mint,
      symbol: pos.symbol,
      reason: decision.action,
      pnl_pct: pnlPct,
      keep_pct: decision.action === "scale_out" ? LIVE_SCALE_KEEP_PCT : 0,
      signature: sent.signature,
      dry,
    });
  }

  const openAfter = (await loadOpen(sb).catch(() => [])).filter((p) => p.status !== "closed");
  const stillOpen = openAfter.length
    ? openAfter
    : open.filter(
        (p) => !actions.some((a) => a.type === "sell" && a.mint === p.mint && a.reason !== "scale_out"),
      );
  const maxOpen = paper ? PAPER_MAX_OPEN : LIVE_MAX_OPEN;
  if (paper) {
    const lastBuy = (fillsNow || []).find((f) => String(f.side) === "buy");
    const sinceBuy = lastBuy?.created_at ? Date.now() - Date.parse(lastBuy.created_at) : Infinity;
    if (sinceBuy < PAPER_APE_EVERY_MS) {
      await upsertDesk(sb, { wallet_pubkey: owner, last_tick_at: new Date().toISOString(), last_agent_id: agent.id, last_error: null }).catch(() => {});
      const snap = await snapshotLiveDesk({ sb, sol_usd: solUsd, sol_balance: bal, skipChain: true });
      return { ...snap, skipped: "paper_cooldown", next_ape_in_ms: PAPER_APE_EVERY_MS - sinceBuy, actions, dry, paper };
    }
  }
  if (stillOpen.length >= maxOpen) {
    await recordEvent(sb, { kind: "tick", reason: "max_open", meta: { open: stillOpen.length } });
    await upsertDesk(sb, {
      wallet_pubkey: owner,
      last_tick_at: new Date().toISOString(),
      last_agent_id: agent.id,
      last_error: null,
    }).catch(() => {});
    const snap = await snapshotLiveDesk({ sb, sol_usd: solUsd, sol_balance: bal, skipChain: true });
    return { ...snap, skipped: "max_open", actions, dry };
  }

  const tape = await raceMs(Promise.resolve().then(() => tapeFn()), 12_000, []);
  const ranked = rankForLiveStyle(agent.style, tape);
  const huntsOnTape = ranked.filter((c) => liveHunt(c));
  const pool = huntsOnTape.length ? huntsOnTape : ranked;
  let chosen = null;
  let safety = null;
  let probes = 0;
  async function noteSkip(coin, reasons) {
    if (actions.some((a) => a.type === "screen")) return;
    const reason = (reasons || []).filter(Boolean).join("; ") || "skip";
    actions.push({ type: "screen", mint: coin.mint, symbol: coin.symbol, reason: reasons?.[0] || "skip" });
    await recordEvent(sb, {
      kind: "skip",
      agent_id: agent.id,
      mint: coin.mint,
      symbol: coin.symbol,
      reason,
    });
  }
  const cheapPass = [];
  let firstReject = null;
  if (paper) {
    chosen = pool.find((c) => !stillOpen.some((p) => p.mint === c.mint) && paperApeOk(c)) || null;
    if (chosen) safety = { canBuy: true, canSell: true, paper: true };
  }
  for (const coin of paper ? [] : pool.slice(0, 40)) {
    if (stillOpen.some((p) => p.mint === coin.mint)) continue;
    const cheap = screenLiveCandidate(coin, { canBuy: true, canSell: true });
    if (cheap.ok) {
      cheapPass.push(coin);
      continue;
    }
    const why = (cheap.reasons || []).join("; ");
    const headline = !liveIsMajor(coin) && !why.includes("mcap too large");
    if (!firstReject || (headline && !firstReject.headline)) {
      firstReject = { coin, reasons: cheap.reasons, headline };
    }
  }
  if (firstReject && !cheapPass.length && !paper) await noteSkip(firstReject.coin, firstReject.reasons);
  for (const coin of cheapPass) {
    if (Date.now() > deadline) break;
    if (probes >= LIVE_MAX_PROBES) break;
    probes += 1;
    let pump = null;
    if (!dry && !opts.tape) {
      pump = await pumpMeta(coin.mint).catch(() => null);
    }
    if (pump) {
      coin.pump_complete = Boolean(pump.complete);
      coin.pump_mcap = num(pump.usd_market_cap);
      coin.name = coin.name || pump.name;
      coin.symbol = coin.symbol || pump.symbol;
    }
    safety = await safetyFn(coin.mint);
    if (pump && pump.complete === false && !safety.canSell) safety = { ...safety, bondingOnly: true };
    const screen = screenLiveCandidate(coin, safety);
    if (!screen.ok) {
      await noteSkip(coin, screen.reasons);
      continue;
    }
    chosen = coin;
    break;
  }

  if (!chosen) {
    if (!actions.some((a) => a.type === "screen")) {
      await recordEvent(sb, {
        kind: "skip",
        agent_id: agent.id,
        reason: Array.isArray(tape) && tape.length ? "no_clean_coin" : "empty tape",
      });
    }
    await upsertDesk(sb, { wallet_pubkey: owner, last_tick_at: new Date().toISOString(), last_agent_id: agent.id, last_error: null }).catch(() => {});
    const snap = await snapshotLiveDesk({ sb, sol_usd: solUsd, sol_balance: bal, skipChain: true });
    return { ...snap, skipped: "no_clean_coin", actions, dry };
  }

  const sized = sizeLiveBuy({
    solBalance: bal,
    solUsd,
    openCount: paper ? 0 : stillOpen.length,
    tradeUsd: paper ? Math.max(LIVE_TRADE_USD, num(snap0.paper_start_usd, PAPER_START_USD_DEFAULT) * PAPER_CLIP_PCT) : huntClipUsd(chosen),
  });
  if (!sized.ok) {
    await recordEvent(sb, { kind: "skip", agent_id: agent.id, mint: chosen.mint, symbol: chosen.symbol, reason: sized.skip });
    await upsertDesk(sb, {
      wallet_pubkey: owner,
      last_tick_at: new Date().toISOString(),
      last_agent_id: agent.id,
      last_error: null,
    }).catch(() => {});
    const snap = await snapshotLiveDesk({ sb, sol_usd: solUsd, sol_balance: bal, skipChain: true });
    return { ...snap, skipped: sized.skip, actions, dry };
  }

  const thesis = writeLiveThesis(agent, chosen, safety, { usd: sized.usd, sol: sized.sol });
  const paperBuyQ = () => ({
    outAmount: String(Math.max(1, Math.round((sized.usd / Math.max(num(chosen.price_usd), 1e-12)) * 1e6))),
    inAmount: String(sized.lamports),
    paper: true,
  });
  const buyQ = dry
    ? { outAmount: "1", inAmount: String(sized.lamports) }
    : paper
      ? (await raceMs(quoteSwap(SOL_MINT, chosen.mint, sized.lamports, 150).catch(() => null), 6_000, null)) || paperBuyQ()
      : await quoteSwap(SOL_MINT, chosen.mint, sized.lamports, 150);
  if (!buyQ) {
    await recordEvent(sb, { kind: "tick", agent_id: agent.id, reason: "no_buy_quote", mint: chosen.mint, symbol: chosen.symbol });
    await upsertDesk(sb, { wallet_pubkey: owner, last_tick_at: new Date().toISOString(), last_agent_id: agent.id, last_error: null }).catch(() => {});
    const snap = await snapshotLiveDesk({ sb, sol_usd: solUsd, sol_balance: bal, skipChain: true });
    return { ...snap, skipped: "no_buy_quote", actions, dry };
  }
  let sent = { ok: true, signature: "dry-run", via: "dry", outAmount: buyQ.outAmount };
  if (!dry) {
    sent = await swapFn({ quote: buyQ, action: "buy", mint: chosen.mint });
    if (sent.ok && sent.signature && !paper) await confirmSig(sent.signature).catch(() => ({ ok: true }));
  }
  if (!sent.ok) {
    await upsertDesk(sb, { last_error: sent.error || "buy_failed", last_tick_at: new Date().toISOString() }).catch(() => {});
    const snap = await snapshotLiveDesk({ sb, sol_usd: solUsd, sol_balance: bal, skipChain: true });
    return { ...snap, skipped: "buy_failed", last_error: sent.error, actions, dry };
  }

  const entry = chosen.price_usd || (solUsd && num(buyQ.outAmount) ? (sized.usd * 1e9) / num(buyQ.outAmount) : 0);
  await openPosition(sb, {
    agent_id: agent.id,
    mint: chosen.mint,
    symbol: chosen.symbol,
    name: chosen.name,
    image: chosen.image,
    sol_in: sized.sol,
    usd_in: sized.usd,
    tokens_raw: String(buyQ.outAmount || sent.outAmount || ""),
    entry_price_usd: entry,
    tp_pct: agent.tpPct,
    thesis,
    signature: sent.signature,
  }).catch(() => {});
  await recordFill(sb, {
    agent_id: agent.id,
    mint: chosen.mint,
    symbol: chosen.symbol,
    side: "buy",
    sol_amount: sized.sol,
    usd_amount: sized.usd,
    pnl_usd: 0,
    pnl_pct: 0,
    signature: sent.signature,
    thesis,
    reason: "buy",
  }).catch(() => {});
  await recordEvent(sb, {
    kind: "buy",
    side: "buy",
    agent_id: agent.id,
    mint: chosen.mint,
    symbol: chosen.symbol,
    usd_amount: sized.usd,
    sol_amount: sized.sol,
    thesis,
    reason: "buy",
    signature: sent.signature,
  });
  await upsertDesk(sb, {
    wallet_pubkey: owner,
    last_tick_at: new Date().toISOString(),
    last_agent_id: agent.id,
    last_error: null,
  }).catch(() => {});

  actions.push({
    type: "buy",
    agent_id: agent.id,
    mint: chosen.mint,
    symbol: chosen.symbol,
    usd: sized.usd,
    sol: sized.sol,
    thesis,
    signature: sent.signature,
    tp_pct: agent.tpPct,
    dry,
  });

  const snap = await snapshotLiveDesk({ sb, sol_usd: solUsd, sol_balance: bal, skipChain: true });
  return { ...snap, actions, dry, paper, skipped: null, trade_usd: paper ? sized.usd : LIVE_TRADE_USD };
  } catch (e) {
    await recordEvent(sb, {
      kind: "skip",
      agent_id: agent.id,
      reason: `tick_error ${String(e?.message || e).slice(0, 80)}`,
    }).catch(() => {});
    await upsertDesk(sb, {
      wallet_pubkey: owner,
      last_tick_at: new Date().toISOString(),
      last_agent_id: agent.id,
      last_error: String(e?.message || e).slice(0, 180),
    }).catch(() => {});
    const snap = await snapshotLiveDesk({ sb, skipChain: true });
    return { ...snap, skipped: "tick_error", last_error: String(e?.message || e), actions, dry };
  }
}

export async function setLiveArmed({ armed, paused, sb } = {}) {
  const client = sb === undefined ? adminSb() : sb;
  await upsertDesk(client, {
    armed: armed == null ? undefined : Boolean(armed),
    paused: paused == null ? undefined : Boolean(paused),
    wallet_pubkey: LIVE_WALLET_PUBKEY,
  });
  return snapshotLiveDesk({ sb: client });
}

export async function setLiveHunt(raw, opts = {}) {
  const client = opts.sb === undefined ? adminSb() : opts.sb;
  const hunt = normalizeHunt(raw);
  if (!hunt) return { ok: false, error: "bad_mint" };
  const hunts = parseHuntSource({ hunts: [hunt] });
  await upsertDesk(client, {
    note: JSON.stringify({ hunts }),
    wallet_pubkey: LIVE_WALLET_PUBKEY,
  });
  if (opts.tick === false) {
    const snap = await snapshotLiveDesk({ sb: client, skipChain: true });
    return { ok: true, hunt, ...snap };
  }
  const out = await tickLiveDesk({ sb: client, force: true, dryRun: opts.dryRun === true });
  return { ok: true, hunt, ...out };
}
