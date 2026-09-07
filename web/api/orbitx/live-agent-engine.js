/**
 * Live agent execution — Jupiter swap + DexScreener/pump.fun screens.
 * Signing key is LIVE_AGENT_WALLET_SECRET only. Never log it.
 */
import { createClient } from "@supabase/supabase-js";
import { adminCredentialOk } from "../../shared/desk-unlock.js";
import {
  LIVE_AGENTS,
  LIVE_DISCLAIMER,
  LIVE_TRADE_USD,
  LIVE_WALLET_PUBKEY,
  SOL_MINT,
  decideLiveExit,
  emptyLiveDesk,
  liveAgentById,
  nextLiveAgent,
  pickLiveToken,
  rankForLiveStyle,
  screenLiveCandidate,
  sizeLiveBuy,
  summarizeLiveLedger,
  mergeLiveFeed,
  writeLiveThesis,
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
    const j = await jget(`/price/v3?ids=${SOL_MINT}`);
    const row = j?.[SOL_MINT] || j?.data?.[SOL_MINT] || j;
    const px = num(row?.usdPrice ?? row?.price ?? row?.usd);
    if (px > 0) return px;
  } catch {
    /* v2 fallback */
  }
  try {
    const j = await jget(`/price/v2?ids=${SOL_MINT}`);
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
  return {
    mint,
    symbol: String(base.symbol || mint.slice(0, 4)).toUpperCase(),
    name: base.name || base.symbol || mint.slice(0, 6),
    image: p?.info?.imageUrl || null,
    price_usd: num(p?.priceUsd),
    change_1h: num(p?.priceChange?.h1),
    change_24h: num(p?.priceChange?.h24),
    volume_24h: num(p?.volume?.h24),
    liquidity_usd: num(p?.liquidity?.usd),
    market_cap: num(p?.marketCap || p?.fdv),
    pair_age_min: ageMin,
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

export async function loadLiveTape() {
  const coins = [];
  try {
    const j = await jget("/tokens/v2/toptraded/24h?limit=30");
    const rows = Array.isArray(j) ? j : j?.tokens || [];
    for (const row of rows) {
      const mapped = fromJupToken(row);
      if (mapped) coins.push(mapped);
    }
  } catch {
    /* ignore */
  }
  try {
    const r = await fetch(`${PUMP}?limit=24&offset=0&sort=last_trade_timestamp&order=DESC&includeNsfw=false`, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json();
    const list = Array.isArray(j) ? j : j?.coins || [];
    for (const c of list) {
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
  } catch {
    /* pump optional */
  }
  const extra = await hydrateDex([...new Set(coins.map((c) => c.mint))].slice(0, 28));
  coins.push(...extra);
  const byMint = new Map();
  for (const c of coins) {
    const prev = byMint.get(c.mint);
    if (!prev) {
      byMint.set(c.mint, c);
      continue;
    }
    byMint.set(c.mint, {
      ...prev,
      ...c,
      liquidity_usd: Math.max(num(prev.liquidity_usd), num(c.liquidity_usd)),
      volume_24h: Math.max(num(prev.volume_24h), num(c.volume_24h)),
      market_cap: num(c.market_cap) || num(prev.market_cap),
      change_1h: c.change_1h ?? prev.change_1h,
      change_24h: c.change_24h ?? prev.change_24h,
      pair_age_min: c.pair_age_min ?? prev.pair_age_min,
      pump_complete: c.pump_complete ?? prev.pump_complete,
    });
  }
  return [...byMint.values()].sort((a, b) => num(b.volume_24h) - num(a.volume_24h)).slice(0, 40);
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
    if (px > 0) return px;
  } catch {
    /* ignore */
  }
  try {
    const j = await jget(`/price/v3?ids=${mint}`);
    const px = num(j?.[mint]?.usdPrice ?? j?.data?.[mint]?.price);
    if (px > 0) return px;
  } catch {
    /* ignore */
  }
  return 0;
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
  if (!sb) return;
  await sb.from("ox_live_desk").upsert(
    { id: "main", updated_at: new Date().toISOString(), ...patch },
    { onConflict: "id" },
  );
}

async function loadOpen(sb) {
  if (!sb) return [];
  const { data } = await sb.from("ox_live_positions").select("*").eq("status", "open").order("opened_at", { ascending: true });
  return data || [];
}

async function loadFills(sb, limit = 200) {
  if (!sb) return [];
  const { data } = await sb.from("ox_live_fills").select("*").order("created_at", { ascending: false }).limit(limit);
  return data || [];
}

async function loadEvents(sb, limit = 80) {
  if (!sb) return [];
  const { data } = await sb.from("ox_live_events").select("*").order("created_at", { ascending: false }).limit(limit);
  return data || [];
}

async function recordEvent(sb, row) {
  if (!sb) return;
  try {
    await sb.from("ox_live_events").insert({
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
  const armed = Boolean(row.armed) || liveDeskArmedEnv();
  const enabled = liveDeskEnabled();
  let solBal = null;
  let solUsd = opts.sol_usd ?? null;
  try {
    if (solUsd == null && !opts.skipChain) solUsd = await solPriceUsd();
  } catch {
    solUsd = null;
  }
  try {
    if (opts.sol_balance != null) solBal = num(opts.sol_balance);
    else if (!opts.skipChain) solBal = await solBalance(wallet);
  } catch {
    solBal = null;
  }
  const openRows = await loadOpen(sb).catch(() => []);
  const fills = await loadFills(sb).catch(() => []);
  const events = await loadEvents(sb).catch(() => []);
  const chain = opts.chain || (!opts.skipChain ? await recentWalletSigs(wallet).catch(() => []) : []);
  const open = [];
  for (const p of openRows) {
    let mark = null;
    try {
      if (!opts.skipChain) mark = await markPriceUsd(p.mint);
    } catch {
      mark = null;
    }
    open.push(publicPosition(p, mark || null));
  }
  const realized = fills.filter((f) => f.side === "sell").reduce((s, f) => s + num(f.pnl_usd), 0);
  const usdBal = solBal != null && solUsd ? solBal * solUsd : null;
  const unrealized = open.reduce((s, p) => {
    if (p.pnl_pct == null) return s;
    return s + (num(p.usd_in) * p.pnl_pct) / 100;
  }, 0);
  const equityUsd = usdBal != null ? usdBal + open.reduce((s, p) => s + num(p.usd_in), 0) + unrealized : null;
  let startingSol = row.starting_sol != null ? num(row.starting_sol) : null;
  let startingUsd = row.starting_usd != null ? num(row.starting_usd) : null;
  if (sb && solBal != null && solBal > 0.001 && (startingSol == null || startingSol <= 0)) {
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
  const publicEvents = events.map((e) => ({
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
  const feed = mergeLiveFeed({ fills: publicFills, events: publicEvents, chain });
  return emptyLiveDesk({
    wallet,
    enabled,
    armed,
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
    agents: ledger.books,
    last_tick_at: row.last_tick_at || null,
    last_error: row.last_error || null,
  });
}

async function recordFill(sb, row) {
  if (!sb) return;
  await sb.from("ox_live_fills").insert(row);
}

async function closePosition(sb, id, patch) {
  if (!sb) return;
  await sb.from("ox_live_positions").update({ status: "closed", closed_at: new Date().toISOString(), ...patch }).eq("id", id);
}

async function openPosition(sb, row) {
  if (!sb) return null;
  const { data } = await sb.from("ox_live_positions").insert({ ...row, status: "open" }).select("*").single();
  return data;
}

async function tokenRawBalance(owner, mint) {
  const parsed = await rpc("getTokenAccountsByOwner", [
    owner,
    { mint },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  const accs = parsed?.value || [];
  let raw = 0n;
  for (const a of accs) {
    const amt = a?.account?.data?.parsed?.info?.tokenAmount?.amount;
    if (amt) raw += BigInt(amt);
  }
  return raw;
}

export async function tickLiveDesk(opts = {}) {
  const sb = opts.sb === undefined ? adminSb() : opts.sb;
  const dry = opts.dryRun === true || liveDeskDryRun();
  const enabled = liveDeskEnabled();
  const secret = liveWalletSecret();
  const actions = [];
  const snap0 = await snapshotLiveDesk({
    sb,
    sol_usd: opts.sol_usd,
    sol_balance: opts.solBalance,
    skipChain: Boolean(opts.skipChain || opts.dryRun || opts.keypair),
  });

  if (!enabled) {
    await recordEvent(sb, { kind: "tick", reason: "not_enabled" });
    return { ...snap0, skipped: "not_enabled", disclaimer: LIVE_DISCLAIMER, actions };
  }
  const row = await loadDeskRow(sb).catch(() => ({ armed: false, paused: false }));
  const armed = Boolean(row.armed) || liveDeskArmedEnv() || opts.force === true;
  if (row.paused && !opts.force) {
    await recordEvent(sb, { kind: "tick", reason: "paused" });
    return { ...snap0, skipped: "paused", armed, actions };
  }
  if (!armed) {
    await recordEvent(sb, { kind: "tick", reason: "not_armed" });
    return { ...snap0, skipped: "not_armed", armed: false, actions };
  }
  let keypair = opts.keypair || null;
  if (!keypair) {
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
  const owner = keypair.publicKey?.toBase58?.() || opts.owner || LIVE_WALLET_PUBKEY;
  const solUsd = opts.sol_usd || snap0.sol_usd || (await solPriceUsd());
  const bal = opts.solBalance != null ? num(opts.solBalance) : await solBalance(owner);
  const open = await loadOpen(sb).catch(() => []);

  const swapFn = opts.swap || (async ({ quote }) => buildAndSignSwap({ quote, owner, keypair }));
  const safetyFn = opts.safety || ((mint) => probeSellability(mint));
  const tapeFn = opts.tape || loadLiveTape;
  const markFn = opts.mark || markPriceUsd;

  for (const pos of open) {
    const mark = await markFn(pos.mint).catch(() => 0);
    const decision = decideLiveExit(pos, mark);
    if (decision.action === "hold") continue;
    const raw = dry ? 1n : await tokenRawBalance(owner, pos.mint).catch(() => 0n);
    if (raw <= 0n && !dry) {
      actions.push({ type: "skip_exit", mint: pos.mint, reason: "no_tokens" });
      continue;
    }
    const sellQ = dry
      ? { outAmount: "1" }
      : await quoteSwap(pos.mint, SOL_MINT, raw.toString(), 300);
    if (!sellQ) {
      actions.push({ type: "skip_exit", mint: pos.mint, reason: "no_sell_route" });
      continue;
    }
    let sent = { ok: true, signature: "dry-run", via: "dry", outAmount: sellQ.outAmount };
    if (!dry) {
      sent = await swapFn({ quote: sellQ, action: "sell", mint: pos.mint });
      if (sent.ok && sent.signature) await confirmSig(sent.signature).catch(() => ({ ok: true }));
    }
    if (!sent.ok) {
      actions.push({ type: "sell_failed", mint: pos.mint, error: sent.error });
      continue;
    }
    const solOut = num(sellQ.outAmount) / 1e9;
    const usdOut = solOut * solUsd;
    const pnlUsd = usdOut - num(pos.usd_in);
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
    await closePosition(sb, pos.id, { exit_signature: sent.signature, exit_reason: decision.action, pnl_usd: pnlUsd }).catch(() => {});
    await recordEvent(sb, {
      kind: "sell",
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
      signature: sent.signature,
      dry,
    });
  }

  const openAfter = (await loadOpen(sb).catch(() => [])).filter((p) => p.status !== "closed");
  const stillOpen = openAfter.length ? openAfter : open.filter((p) => !actions.some((a) => a.type === "sell" && a.mint === p.mint));
  const sized = sizeLiveBuy({ solBalance: bal, solUsd, openCount: stillOpen.length });
  if (!sized.ok) {
    await recordEvent(sb, { kind: "tick", reason: sized.skip, meta: { open: stillOpen.length } });
    await upsertDesk(sb, {
      wallet_pubkey: owner,
      last_tick_at: new Date().toISOString(),
      last_error: null,
    }).catch(() => {});
    const snap = await snapshotLiveDesk({ sb, sol_usd: solUsd, sol_balance: bal, skipChain: dry });
    return { ...snap, skipped: sized.skip, actions, dry };
  }

  const agent = nextLiveAgent(row.last_agent_id);
  const tape = await tapeFn();
  const ranked = rankForLiveStyle(agent.style, tape);
  let chosen = null;
  let safety = null;
  for (const coin of ranked.slice(0, 12)) {
    if (stillOpen.some((p) => p.mint === coin.mint)) continue;
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
      if (!actions.some((a) => a.type === "screen")) {
        actions.push({ type: "screen", mint: coin.mint, symbol: coin.symbol, reason: screen.reasons[0] });
        await recordEvent(sb, {
          kind: "skip",
          agent_id: agent.id,
          mint: coin.mint,
          symbol: coin.symbol,
          reason: screen.reasons.join("; "),
        });
      }
      continue;
    }
    chosen = coin;
    break;
  }

  if (!chosen) {
    await recordEvent(sb, { kind: "tick", agent_id: agent.id, reason: "no_clean_coin" });
    await upsertDesk(sb, { wallet_pubkey: owner, last_tick_at: new Date().toISOString(), last_agent_id: agent.id, last_error: null }).catch(() => {});
    const snap = await snapshotLiveDesk({ sb, sol_usd: solUsd, sol_balance: bal, skipChain: dry });
    return { ...snap, skipped: "no_clean_coin", actions, dry };
  }

  const thesis = writeLiveThesis(agent, chosen, safety, { usd: sized.usd, sol: sized.sol });
  const buyQ = dry
    ? { outAmount: "1", inAmount: String(sized.lamports) }
    : await quoteSwap(SOL_MINT, chosen.mint, sized.lamports, 150);
  if (!buyQ) {
    const snap = await snapshotLiveDesk({ sb, sol_usd: solUsd, sol_balance: bal, skipChain: dry });
    return { ...snap, skipped: "no_buy_quote", actions, dry };
  }
  let sent = { ok: true, signature: "dry-run", via: "dry", outAmount: buyQ.outAmount };
  if (!dry) {
    sent = await swapFn({ quote: buyQ, action: "buy", mint: chosen.mint });
    if (sent.ok && sent.signature) await confirmSig(sent.signature).catch(() => ({ ok: true }));
  }
  if (!sent.ok) {
    await upsertDesk(sb, { last_error: sent.error || "buy_failed", last_tick_at: new Date().toISOString() }).catch(() => {});
    const snap = await snapshotLiveDesk({ sb, sol_usd: solUsd, sol_balance: bal, skipChain: dry });
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

  const snap = await snapshotLiveDesk({ sb, sol_usd: solUsd, sol_balance: bal, skipChain: dry });
  return { ...snap, actions, dry, skipped: null, trade_usd: LIVE_TRADE_USD };
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
