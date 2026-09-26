/**
 * MCP trading wallet — backend signs. No Phantom popup. No sign link.
 * Key is AES-GCM encrypted in agent_delegated_wallets. User can export anytime.
 */
import {
  getUserWallet,
  createUserWallet,
  exportUserWalletSecret,
  revokeUserWallet,
  signUserSwap,
  coerceSlippageBps,
  SLIPPAGE_BPS_DEFAULT,
  getDeskSolLamports,
  getDeskFunds,
  SOL_MINT,
  isSigningAuth,
  TICK_AUTH_SOURCE,
  getTxConfirmationStatus,
} from "./_user-trading-wallet.js";
import { appLaunch, appClaimFees, appBurn, APP_DESK_OPS_TOOLS } from "./_mcp-app-desk-ops.js";
// NOTE: strategy feature modules (_mcp-copy, _mcp-trailing, _mcp-sniper,
// _mcp-alerts, _mcp-pnl) import helpers from THIS file. This file must NOT
// statically import them back (ESM cycle → TDZ crash when a feature module
// is the import-graph entry). Their TOOLS arrays are registered in
// orbitx-hub.js CORE_TOOLS; dispatch below reaches them via dynamic import
// (module-cache hit in production).

const DASH = "https://www.orbitx.world/supercomputer?tab=inapp";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC = USDC_MINT;

export function needAuth(auth) {
  // F2: { userId } alone is NOT enough — require provenance. Every credential
  // minted by the dashboard auth flow carries `source` (bearer | oauth_token |
  // link_auth | link_session); the server-side auto-fill tick stamps "tick".
  // A forged literal with no source is rejected like a missing credential.
  if (isSigningAuth(auth)) return { userId: auth.userId };
  return { ok: false, error: "auth_required", dashboard: DASH, message: "Link OrbitX auth first." };
}

export async function sb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function tokenInfo(mint) {
  const r = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + mint, { signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => ({}));
  const p = (j.pairs || []).find((x) => String(x.chainId || "").toLowerCase() === "solana") || (j.pairs || [])[0] || {};
  return {
    mint,
    symbol: p.baseToken?.symbol || "?",
    name: p.baseToken?.name || "",
    priceUsd: Number(p.priceUsd || 0),
    mcap: Number(p.marketCap || p.fdv || 0),
    liquidity: Number(p.liquidity?.usd || 0),
    url: p.url || "",
  };
}

export async function solUsd() {
  const t = await tokenInfo(SOL_MINT);
  return t.priceUsd || 110;
}

export async function walletRow(userId) {
  return getUserWallet(userId);
}

async function ensureWallet(userId, agentId) {
  const existing = await walletRow(userId);
  if (existing) return existing;
  await createUserWallet(userId);
  return walletRow(userId);
}

function receipt({ side, info, usd, signature, owner, payWith, slippageBps }) {
  return {
    ok: true,
    signedOn: "backend",
    clickToSign: false,
    side,
    payWith: payWith || "SOL",
    symbol: info.symbol,
    mint: info.mint,
    entryUsd: info.priceUsd,
    entryMcap: info.mcap,
    usd,
    slippageBps: slippageBps ?? SLIPPAGE_BPS_DEFAULT,
    signature,
    wallet: owner,
    tx: signature ? `https://solscan.io/tx/${signature}` : null,
    chart: info.url,
    headline: `${side.toUpperCase()} ${info.symbol} @ $${info.priceUsd} · MC $${Math.round(info.mcap).toLocaleString()}`,
    imagePrompt: `Dark neon crypto trade receipt card, OrbitX, ${side.toUpperCase()} ${info.symbol}, entry $${info.priceUsd}, market cap $${Math.round(info.mcap).toLocaleString()}, tx success, no logos of other brands.`,
  };
}

/* F3: interpret a signUserSwap result honestly. Broadcast acceptance is NOT
 * success — a pending (unconfirmed) or failed swap must never come back as
 * an ok:true receipt. Returns { kind: "filled" | "pending" | "failed", ... }.
 * Tick families branch on kind === "pending" to renew the fill claim with
 * the signature instead of re-executing (which would double-fill). */
function swapOutcome({ side, info, usd, live, payWith, slippageBps }) {
  const base = {
    side,
    payWith: payWith || "SOL",
    symbol: info.symbol,
    mint: info.mint,
    usd,
    slippageBps: slippageBps ?? SLIPPAGE_BPS_DEFAULT,
    signature: live?.signature || null,
    wallet: live?.owner || null,
    tx: live?.signature ? `https://solscan.io/tx/${live.signature}` : null,
    chart: info.url,
  };
  if (live?.pending) {
    return {
      ...base,
      ok: false,
      pending: true,
      status: "pending",
      error: live.error || "tx_unconfirmed",
      confirmationStatus: live.confirmationStatus || "unknown",
      headline: `${side.toUpperCase()} ${info.symbol} broadcast — awaiting confirmation`,
      message:
        live.message ||
        "Swap broadcast accepted by the RPC but not confirmed yet. It may still land — check the explorer before retrying; do NOT blindly re-submit.",
    };
  }
  if (!live?.ok) {
    return {
      ...base,
      ok: false,
      status: "failed",
      error: live?.error || "swap_failed",
      confirmationStatus: live?.confirmationStatus || null,
      headline: `${side.toUpperCase()} ${info.symbol} failed`,
      message: live?.message || "The swap did not complete.",
    };
  }
  const rec = receipt({ side, info, usd, signature: live.signature, owner: live.owner, payWith, slippageBps });
  rec.confirmed = true;
  rec.confirmationStatus = live.confirmationStatus || "confirmed";
  return rec;
}

export async function tokenBalance(owner, mint) {
  const key = String(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "").trim();
  const rpc = key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : "https://api.mainnet-beta.solana.com";
  const r = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [owner, { mint }, { encoding: "jsonParsed" }],
    }),
    signal: AbortSignal.timeout(10000),
  });
  const j = await r.json();
  return (j?.result?.value || []).reduce((s, a) => s + Number(a?.account?.data?.parsed?.info?.tokenAmount?.amount || 0), 0);
}

async function solLamports(owner) {
  const key = String(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "").trim();
  const rpc = key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : "https://api.mainnet-beta.solana.com";
  const r = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [owner] }),
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json();
  return Number(j?.result?.value || 0);
}

export async function appWalletStatus(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) {
    return { ok: true, exists: false, signedOn: "backend", dashboard: DASH, message: "No wallet yet. Say create a wallet." };
  }
  const funds = await getDeskFunds(row.public_key);
  const px = await solUsd();
  const solUsdVal = funds.sol * px;
  const totalUsd = solUsdVal + funds.usdc;
  return {
    ok: true,
    exists: true,
    signedOn: "backend",
    clickToSign: false,
    publicKey: row.public_key,
    sol: funds.sol,
    solUsd: solUsdVal,
    usdc: funds.usdc,
    wsol: funds.wsol,
    totalUsd,
    rpc: funds.rpc,
    rpcError: funds.error,
    perTradeCapUsd: Number(row.per_trade_cap_usd) || 250,
    dashboard: DASH,
    message: `Desk ${row.public_key} · ${funds.sol.toFixed(4)} SOL ($${solUsdVal.toFixed(2)}) + ${funds.usdc.toFixed(2)} USDC = $${totalUsd.toFixed(2)} spendable.`,
  };
}

export async function appWalletCreate(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await ensureWallet(gate.userId, auth?.agentId);
  return {
    ok: true,
    created: true,
    publicKey: row.public_key,
    signedOn: "backend",
    clickToSign: false,
    owner: "user",
    notOrbitXTreasury: true,
    fund: "This pubkey is YOURS. Fund YOUR SOL or USDC. Not the OrbitX owner wallet.",
    exportHint: "Say export wallet for YOUR private key.",
  };
}

export async function appWalletExport(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet" };
  const secret = await exportUserWalletSecret(row);
  return {
    ok: true,
    publicKey: row.public_key,
    secretKeyBase58: secret,
    warning: "Private key. Anyone with it can empty the wallet.",
  };
}

export async function appWalletRevoke(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  await revokeUserWallet(gate.userId);
  return { ok: true, revoked: true };
}

/* ------------------------------------------------------------------ */
/* Trade-parameter validation (F5/F6). Pure helpers — no network, no   */
/* DB. Extracted by web/shared/qa-trade-params.test.js via the        */
/* anchors below; keep this block self-contained (no imports).         */
/*                                                                    */
/* F6 root cause: appWalletSell silently clamped out-of-range sizes —  */
/* percent=0 → 1% sell reported ok:true ("no-op success"),            */
/* percent=150 → full 100% liquidation ("over-fill"), negative → 1%.  */
/* F6 root cause (limit trigger): pct<=0 armed an order whose target  */
/* was already hit → silent immediate fill on the next tick.           */
/* ------------------------------------------------------------------ */
export function validateSellSize(args = {}) {
  if (args.fraction != null && args.fraction !== "") {
    const f = Number(args.fraction);
    if (!Number.isFinite(f) || f <= 0 || f > 1) {
      return { ok: false, error: "bad_fraction", message: "fraction must be > 0 and ≤ 1 (fraction of position)." };
    }
    return { ok: true, fraction: f };
  }
  if (args.percent != null && args.percent !== "") {
    const p = Number(args.percent);
    if (!Number.isFinite(p) || p <= 0 || p > 100) {
      return { ok: false, error: "bad_percent", message: "percent must be > 0 and ≤ 100 (percent of position)." };
    }
    return { ok: true, fraction: p / 100 };
  }
  return { ok: true, fraction: 1 };
}

export function validateTriggerPct(args = {}) {
  const raw = args.trigger ?? args.percent ?? args.up;
  if (raw == null || String(raw).trim() === "") return { ok: true, pct: 15 };
  const pct = Number(String(raw).replace(/[^\d.\-]/g, ""));
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
    return { ok: false, error: "bad_trigger", message: "trigger must be > 0 and ≤ 100 (percent price move)." };
  }
  return { ok: true, pct };
}
/* End trade-parameter validation (F5/F6). */

export async function appWalletBuy(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet", message: "Create a wallet first." };
  const mint = String(args.mint || args.ca || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return { ok: false, error: "bad_mint" };
  let slip;
  try {
    slip = coerceSlippageBps(args.slippageBps);
  } catch (e) {
    return { ok: false, error: "bad_slippage", message: String(e.message || e).replace(/^bad_slippage:\s*/, "") };
  }
  const funds = await getDeskFunds(row.public_key);
  const pay = String(args.payWith || args.currency || args.with || "").toLowerCase();
  let useUsdc = pay.includes("usdc");
  if (!pay) useUsdc = funds.usdc >= 1 && funds.sol * 110 < 1;
  const px = await solUsd();
  let usd = Number(args.usd || args.amountUsd || 0);
  if (!usd && args.amountSol) usd = Number(args.amountSol) * px;
  if (!usd && args.amountUsdc) usd = Number(args.amountUsdc);
  if (!usd) usd = Number(args.amount) || 1;
  const info = await tokenInfo(mint);
  let inputMint = SOL_MINT;
  let amount = Math.floor((usd / px) * 1e9);
  if (useUsdc) {
    inputMint = USDC;
    amount = Math.floor(usd * 1e6);
  }
  if (amount <= 0) return { ok: false, error: "size" };
  const live = await signUserSwap(row, { inputMint, outputMint: mint, amount, slippageBps: slip });
  const out = swapOutcome({ side: "buy", info, usd, live, payWith: useUsdc ? "USDC" : "SOL", slippageBps: slip });
  if (out.ok) out.imageHint = "Call orbitx_generate_image with imagePrompt to show the fill card.";
  return out;
}

export async function appWalletSell(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet" };
  const mint = String(args.mint || args.ca || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return { ok: false, error: "bad_mint" };
  let slip;
  try {
    slip = coerceSlippageBps(args.slippageBps);
  } catch (e) {
    return { ok: false, error: "bad_slippage", message: String(e.message || e).replace(/^bad_slippage:\s*/, "") };
  }
  const sizeCheck = validateSellSize(args);
  if (!sizeCheck.ok) return sizeCheck;
  const raw = await tokenBalance(row.public_key, mint);
  let amt;
  if (args.amount != null && args.amount !== "" && args.percent == null && args.fraction == null) {
    const q = Number(args.amount);
    if (!Number.isFinite(q) || q <= 0) return { ok: false, error: "bad_amount", message: "amount must be a positive number of tokens." };
    amt = Math.floor(q);
  } else {
    amt = Math.floor(raw * sizeCheck.fraction);
  }
  if (amt <= 0) return { ok: false, error: "no_balance" };
  const info = await tokenInfo(mint);
  const live = await signUserSwap(row, { inputMint: mint, outputMint: SOL_MINT, amount: amt, slippageBps: slip });
  return swapOutcome({ side: "sell", info, usd: 0, live, payWith: "SOL", slippageBps: slip });
}

export async function appWalletLimit(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet" };
  const mint = String(args.mint || args.ca || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return { ok: false, error: "bad_mint" };
  const info = await tokenInfo(mint);
  const trig = validateTriggerPct(args);
  if (!trig.ok) return trig;
  const pct = trig.pct;
  let slip;
  try {
    slip = coerceSlippageBps(args.slippageBps);
  } catch (e) {
    return { ok: false, error: "bad_slippage", message: String(e.message || e).replace(/^bad_slippage:\s*/, "") };
  }
  const side = String(args.side || "sell").toLowerCase() === "buy" ? "buy" : "sell";
  const target = info.priceUsd * (side === "sell" ? 1 + pct / 100 : 1 - Math.abs(pct) / 100);
  // Persist the fill size so the tick fills exactly what was armed (not a hardcoded default).
  const size = {};
  if (side === "sell") {
    // NOTE: `percent` is the trigger here (legacy); sell size uses `fraction` (0-1) or `amount` (raw tokens).
    if (args.fraction != null && args.fraction !== "") {
      const sc = validateSellSize({ fraction: args.fraction });
      if (!sc.ok) return sc;
      size.fraction = sc.fraction;
    } else if (args.amount != null && args.amount !== "") {
      const q = Number(args.amount);
      if (!Number.isFinite(q) || q <= 0) return { ok: false, error: "bad_amount", message: "amount must be a positive number of tokens." };
      size.amount = String(args.amount);
    } else size.fraction = 1;
  } else {
    if (args.usd != null && args.usd !== "") size.usd = Number(args.usd);
    else if (args.amountUsd != null && args.amountUsd !== "") size.usd = Number(args.amountUsd);
    else if (args.amountSol != null && args.amountSol !== "") size.amountSol = Number(args.amountSol);
    else if (args.amountUsdc != null && args.amountUsdc !== "") size.amountUsdc = Number(args.amountUsdc);
    else size.usd = 1;
    const buySize = Number(size.usd ?? size.amountSol ?? size.amountUsdc);
    if (!Number.isFinite(buySize) || buySize <= 0) return { ok: false, error: "bad_size", message: "buy size must be > 0." };
    if (args.payWith) size.payWith = String(args.payWith);
  }
  size.slippageBps = slip;
  const client = await sb();
  const order = {
    userId: gate.userId,
    wallet: row.public_key,
    mint,
    symbol: info.symbol,
    side,
    size,
    triggerPct: pct,
    entryUsd: info.priceUsd,
    targetUsd: target,
    entryMcap: info.mcap,
    status: "open",
    attempts: 0,
    at: new Date().toISOString(),
  };
  if (!client) {
    return { ok: false, error: "db_unavailable", message: "Limit could not be armed — order store unreachable. Retry in a minute." };
  }
  await client.from("ox_live_events").insert({
    kind: "app_limit",
    agent_id: gate.userId,
    mint,
    symbol: info.symbol,
    side,
    thesis: `${side} ${info.symbol} at ${pct}%`,
    meta: order,
  });
  const sizeTxt = side === "sell"
    ? (size.fraction != null ? `${Math.round(size.fraction * 100)}%` : `${size.amount} tokens`)
    : (size.usd != null ? `$${size.usd}` : size.amountSol != null ? `${size.amountSol} SOL` : `${size.amountUsdc} USDC`);
  return { ok: true, signedOn: "backend", order, message: `Limit armed. ${side.toUpperCase()} ${sizeTxt} ${info.symbol} when price hits $${target.toFixed(8)} (${pct}%). Backend auto-fills. No click.` };
}

export async function appWalletOrders(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const client = await sb();
  if (!client) return { ok: true, orders: [] };
  const { data } = await client.from("ox_live_events").select("id,meta,created_at,mint,symbol,side").eq("kind", "app_limit").eq("agent_id", gate.userId).order("created_at", { ascending: false }).limit(40);
  return { ok: true, orders: (data || []).map((r) => ({ orderId: r.id, ...(r.meta || {}), at: r.created_at })) };
}

function fillArgsFor(order) {
  const s = order.size || {};
  const slip = s.slippageBps != null ? { slippageBps: s.slippageBps } : {};
  if (order.side === "sell") {
    if (s.fraction != null) return { mint: order.mint, fraction: Number(s.fraction), ...slip };
    if (s.amount != null) return { mint: order.mint, amount: s.amount, ...slip };
    return { mint: order.mint, fraction: 1, ...slip };
  }
  const a = { mint: order.mint, ...slip };
  if (s.usd != null) a.usd = Number(s.usd);
  else if (s.amountSol != null) a.amountSol = Number(s.amountSol);
  else if (s.amountUsdc != null) a.amountUsdc = Number(s.amountUsdc);
  else a.usd = 1;
  if (s.payWith) a.payWith = s.payWith;
  return a;
}

/* ------------------------------------------------------------------ */
/* Fill-claim mutex (double-fill race fix).                            */
/*                                                                    */
/* Every strategy family used to do read → execute-on-chain →          */
/* unconditional status writeback. Two overlapping tick invocations   */
/* (cron + manual tick, or a retried tick after a 504) could both read */
/* "open"/"active" and both fill — the user trades twice. The claim    */
/* flips the row to status "filling" atomically (conditional on it     */
/* still being open) BEFORE any on-chain execution; only the claim     */
/* winner executes. A 10-minute stale window lets a later tick reap   */
/* claims orphaned by a killed invocation.                             */
/* ------------------------------------------------------------------ */

export const FILL_STATUS = "filling";
export const FILL_CLAIM_MS = 10 * 60 * 1000;

export function fillClaimIsStale(meta) {
  const at = Date.parse(meta?.fillingAt || "");
  return Number.isFinite(at) && Date.now() - at > FILL_CLAIM_MS;
}

// Convention-aware "may this row be fill-attempted now?"
// openValue: "open" (limits/trailing/ladder/alerts) or "active" (copy/sniper).
export function isFillOpen(meta, openValue = "open") {
  const s = meta?.status ?? openValue;
  if (s === openValue) return true;
  if (s === FILL_STATUS && fillClaimIsStale(meta)) return true;
  return false;
}

const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Atomically claim a row for filling. Returns the claim patch (meta with
 * status "filling") on success, or null when another tick owns the row.
 * Missing status counts as open (family convention); a stale "filling"
 * claim (older than FILL_CLAIM_MS) may be reaped.
 *
 * F3: a stale "filling" claim carrying a pendingSignature is a
 * broadcast-but-unconfirmed fill. It is settled by signature status —
 * confirmed → marked filled, failed/expired → clean reap, unknown but
 * recent → claim renewed — and NEVER re-executed blindly (that would
 * double-fill if the first tx lands late). Returns null unless the claim
 * was cleanly reaped, in which case the returned patch has the pending
 * fields cleared.
 */
export async function claimFillRow(client, rowId, meta, opts = {}) {
  const { openValue = "open", bumpAttempts = true, getTxStatus } = opts;
  if (meta?.status === FILL_STATUS && meta?.pendingSignature && fillClaimIsStale(meta)) {
    const settle = await settlePendingClaim(client, rowId, meta, getTxStatus);
    if (settle.action !== "reap") return null; // filled, renewed, or lost — never re-execute
    meta = settle.meta; // clean reap: pending fields cleared, safe to claim
  }
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - FILL_CLAIM_MS).toISOString();
  const patch = { ...(meta || {}), status: FILL_STATUS, fillingAt: now, lastCheckAt: now };
  if (bumpAttempts) patch.attempts = Number(meta?.attempts || 0) + 1;
  const orCond =
    `meta->>status.is.null,meta->>status.eq.${openValue},` +
    `and(meta->>status.eq.${FILL_STATUS},meta->>fillingAt.lt.${staleBefore})`;
  try {
    const { data, error } = await client
      .from("ox_live_events")
      .update({ meta: patch })
      .eq("id", rowId)
      .or(orCond)
      .select("id");
    if (error || !data || data.length === 0) return null;
    return patch;
  } catch {
    return null;
  }
}

/**
 * Resolve a claim after execution. Guarded on status="filling" so a claim
 * we no longer own (re-armed, cancelled, or re-claimed) is never clobbered.
 * Retries transport errors; returns true when the row was resolved.
 */
export async function resolveFillRow(client, rowId, metaPatch, finalStatus) {
  const patch = { ...(metaPatch || {}) };
  delete patch.fillingAt;
  patch.status = finalStatus;
  for (let i = 0; i < 3; i++) {
    try {
      const { data, error } = await client
        .from("ox_live_events")
        .update({ meta: patch })
        .eq("id", rowId)
        .eq("meta->>status", FILL_STATUS)
        .select("id");
      if (!error && data && data.length > 0) return true;
      if (!error) return false; // guard didn't match — not ours anymore; don't retry
    } catch {
      /* transport error — retry below */
    }
    await _sleep(250 * (i + 1));
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Pending-fill settlement (F3).                                       */
/*                                                                     */
/* A fill that was broadcast but never confirmed leaves a "filling"    */
/* claim carrying pendingSignature/pendingSince. When the claim goes    */
/* stale, the next tick settles it by the signature's on-chain status: */
/*                                                                     */
/*   confirmed/finalized → the tx landed while unwatched: mark filled  */
/*   (per-tranche for ladders), NEVER re-execute.                       */
/*   failed on-chain   → the tx died: clean reap, safe to retry.        */
/*   unknown + recent  → may still land: renew the claim, keep waiting. */
/*   unknown + old     → blockhash long dead, cannot land: clean reap.  */
/*                                                                     */
/* The guarded updates (status=filling AND fillingAt match) keep this  */
/* atomic against overlapping ticks: only one settler wins.            */
/* ------------------------------------------------------------------ */

export const PENDING_SIG_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Renew a "filling" claim we still own (e.g. after a pending broadcast).
 * Guarded on status="filling" so a re-armed/cancelled row is never clobbered.
 * Returns true when the renewal landed.
 */
export async function renewFillClaim(client, rowId, metaPatch) {
  const now = new Date().toISOString();
  const patch = { ...(metaPatch || {}), status: FILL_STATUS, fillingAt: now, lastCheckAt: now };
  try {
    const { data, error } = await client
      .from("ox_live_events")
      .update({ meta: patch })
      .eq("id", rowId)
      .eq("meta->>status", FILL_STATUS)
      .select("id");
    return !error && !!data && data.length > 0;
  } catch {
    return false;
  }
}

function clearPending(t) {
  const c = { ...(t || {}) };
  delete c.pendingSignature;
  delete c.pendingSince;
  return c;
}

/**
 * Settle a stale "filling" claim that carries a pendingSignature.
 * getTxStatus defaults to the real getTxConfirmationStatus; tests inject a stub.
 * Returns { action, meta? } — action ∈ filled | renewed | reap | lost.
 */
export async function settlePendingClaim(client, rowId, meta, getTxStatus) {
  const sig = meta?.pendingSignature;
  const getStatus =
    getTxStatus ||
    (typeof getTxConfirmationStatus === "function" ? getTxConfirmationStatus : null);
  if (!sig || !getStatus) {
    return { action: "reap", meta: clearPending(meta) };
  }
  let st = null;
  try {
    st = await getStatus(sig, { searchHistory: true });
  } catch {
    st = null; // RPC hiccup — treat as unknown below, never as failure
  }
  const now = new Date().toISOString();
  // NOTE: a tx can be "confirmed" (included in a block) yet failed execution
  // (err set) — check failed FIRST, never treat it as a landed fill.
  const failed = !!st?.failed;
  const confirmed = !failed && (st?.status === "confirmed" || st?.status === "finalized");
  const cleanTranches = (tr) =>
    (Array.isArray(tr) ? tr : []).map((t) =>
      t?.pendingSignature === sig
        ? confirmed
          ? { ...clearPending(t), status: "filled", filledAt: now, signature: sig, lastError: null }
          : { ...clearPending(t), status: "open", lastError: st?.failed ? `tx_failed_onchain: ${JSON.stringify(st.err)}` : t.lastError || "tx_unconfirmed_expired" }
        : t
    );
  if (confirmed) {
    // Landed while unwatched — mark it filled. Never re-execute.
    const hasTranches = Array.isArray(meta.tranches);
    const patch = {
      ...clearPending(meta),
      lastCheckAt: now,
      filledAt: now,
      lastFill: { signature: sig, at: now, confirmed: true, settled: "stale_claim", confirmationStatus: st.status },
    };
    let finalStatus = "filled";
    if (hasTranches) {
      const tranches = cleanTranches(meta.tranches);
      patch.tranches = tranches;
      const allDone = tranches.length > 0 && tranches.every((t) => t.status === "filled" || t.status === "failed");
      if (!allDone) { finalStatus = "open"; delete patch.filledAt; }
    }
    const ok = await resolveFillRow(client, rowId, patch, finalStatus);
    return { action: ok ? "filled" : "lost" };
  }
  const pendingSince = Date.parse(meta.pendingSince || meta.fillingAt || "") || 0;
  const expired = !!st?.failed || Date.now() - pendingSince > PENDING_SIG_MAX_AGE_MS;
  if (expired) {
    // Died on-chain, or the blockhash is long dead so it cannot land — clean reap.
    const cleaned = { ...clearPending(meta), lastCheckAt: now };
    if (Array.isArray(meta.tranches)) cleaned.tranches = cleanTranches(meta.tranches);
    return { action: "reap", meta: cleaned };
  }
  // Unknown but possibly still alive — renew the claim; do NOT re-execute.
  const patch = { ...(meta || {}), fillingAt: now, lastCheckAt: now };
  try {
    const { data, error } = await client
      .from("ox_live_events")
      .update({ meta: patch })
      .eq("id", rowId)
      .eq("meta->>status", FILL_STATUS)
      .eq("meta->>fillingAt", meta.fillingAt)
      .select("id");
    if (!error && data && data.length > 0) return { action: "renewed" };
  } catch {
    /* lost below */
  }
  return { action: "lost" };
}

// Errors that will never succeed on retry — fail the order immediately.
const LIMIT_FATAL = new Set(["no_balance", "no_wallet", "bad_mint", "size", "need_size"]);
const LIMIT_MAX_ATTEMPTS = 10;

export async function tickUserLimits(userId, ctx = {}) {
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const { data } = await client.from("ox_live_events").select("id,meta").eq("kind", "app_limit").eq("agent_id", userId).order("created_at", { ascending: false }).limit(100);
  const fills = [];
  let checked = 0;
  let truncated = false;
  const deadlineMs = Number(ctx?.deadlineMs || 0);
  for (const r of data || []) {
    if (deadlineMs && Date.now() > deadlineMs) { truncated = true; break; }
    const o = r.meta || {};
    if (!isFillOpen(o)) continue;
    if (!o.mint || !o.targetUsd) continue;
    checked += 1;
    let info;
    try {
      info = await tokenInfo(o.mint);
    } catch {
      continue; // price feed hiccup — retry next tick, don't burn an attempt
    }
    if (!info.priceUsd) continue;
    const hit = o.side === "sell" ? info.priceUsd >= Number(o.targetUsd) : info.priceUsd <= Number(o.targetUsd);
    if (!hit) continue;
    if (deadlineMs && Date.now() > deadlineMs) { truncated = true; break; } // don't start a fill we can't resolve
    // Claim-then-execute: only the claim winner fills (double-fill race fix).
    const claimed = await claimFillRow(client, r.id, o);
    if (!claimed) continue; // lost the race — another tick owns this fill
    const auth = { userId, source: TICK_AUTH_SOURCE };
    let fill;
    try {
      fill = o.side === "sell" ? await appWalletSell(auth, fillArgsFor(o)) : await appWalletBuy(auth, fillArgsFor(o));
    } catch (e) {
      fill = { ok: false, error: "fill_threw", message: e?.message || String(e) };
    }
    // F3: broadcast-but-unconfirmed — renew the claim with the signature so
    // later ticks settle by signature status. NEVER fall through to "open"
    // here: re-executing would double-fill if the first tx lands late.
    if (fill?.pending) {
      const nowIso = new Date().toISOString();
      await renewFillClaim(client, r.id, { ...claimed, pendingSignature: fill.signature, pendingSince: nowIso });
      fills.push({ orderId: r.id, mint: o.mint, side: o.side, status: "pending", attempts: Number(claimed.attempts || 0), renewed: true, fill: { ok: false, pending: true, error: fill.error || "tx_unconfirmed", signature: fill.signature || null } });
      continue;
    }
    const attempts = Number(claimed.attempts || 0);
    const fatal = fill && !fill.ok && LIMIT_FATAL.has(String(fill.error || ""));
    const status = fill && fill.ok ? "filled" : fatal || attempts >= LIMIT_MAX_ATTEMPTS ? "failed" : "open";
    const resolved = await resolveFillRow(client, r.id, {
      ...claimed,
      attempts,
      lastCheckAt: new Date().toISOString(),
      ...(status !== "open"
        ? { filledAt: new Date().toISOString(), lastFill: { ok: !!fill?.ok, error: fill?.error || null, message: fill?.message || null, signature: fill?.signature || null, priceUsd: info?.priceUsd ?? null, size: o.size || null } }
        : { lastError: fill?.error || fill?.message || null }),
    }, status);
    fills.push({ orderId: r.id, mint: o.mint, side: o.side, status, attempts, resolved, fill: { ok: !!fill?.ok, error: fill?.error || null, signature: fill?.signature || null } });
  }
  return { ok: true, checked, fills, ...(truncated ? { truncated: true } : {}) };
}

export async function appWalletTickLimits(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  return tickUserLimits(gate.userId);
}

/** Cron sweep: tick every user that has limit rows. Per-user failures never stop the sweep. */
export async function tickAllLimits({ maxUsers = 200 } = {}) {
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const { data } = await client.from("ox_live_events").select("agent_id").eq("kind", "app_limit").limit(2000);
  const users = [...new Set((data || []).map((r) => r.agent_id).filter(Boolean))].slice(0, maxUsers);
  const results = [];
  for (const userId of users) {
    try {
      const r = await tickUserLimits(userId);
      if ((r.fills || []).length || !r.ok) results.push({ userId, ...r });
    } catch (e) {
      results.push({ userId, ok: false, error: e?.message || String(e) });
    }
  }
  return { ok: true, users: users.length, active: results.length, results };
}

export async function appWalletCancelOrder(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const idArg = String(args.orderId || args.id || "").trim();
  const mintArg = String(args.mint || args.ca || "").trim();
  if (!idArg && !mintArg) return { ok: false, error: "need_order", message: "Pass orderId (from orbitx_app_orders) or mint." };
  const { data } = await client.from("ox_live_events").select("id,meta").eq("kind", "app_limit").eq("agent_id", gate.userId).limit(100);
  const targets = (data || []).filter((r) => {
    if ((r.meta?.status || "open") !== "open") return false;
    if (idArg) return String(r.id) === idArg;
    return String(r.meta?.mint || "") === mintArg;
  });
  if (!targets.length) return { ok: false, error: "order_not_found", message: "No open order matches." };
  const now = new Date().toISOString();
  for (const t of targets) {
    await client.from("ox_live_events").update({ meta: { ...(t.meta || {}), status: "cancelled", cancelledAt: now } }).eq("id", t.id);
  }
  return { ok: true, cancelled: targets.map((t) => ({ orderId: t.id, mint: t.meta?.mint, side: t.meta?.side, symbol: t.meta?.symbol })) };
}

export async function dispatchAppWalletTool(name, args, auth) {
  if (name === "orbitx_app_wallet") return appWalletStatus(auth);
  if (name === "orbitx_app_wallet_create") return appWalletCreate(auth);
  if (name === "orbitx_app_wallet_export") return appWalletExport(auth);
  if (name === "orbitx_app_wallet_revoke") return appWalletRevoke(auth);
  if (name === "orbitx_app_buy") return appWalletBuy(auth, args || {});
  if (name === "orbitx_app_sell") return appWalletSell(auth, args || {});
  if (name === "orbitx_app_limit") return appWalletLimit(auth, args || {});
  if (name === "orbitx_app_orders") return appWalletOrders(auth);
  if (name === "orbitx_app_cancel_order") return appWalletCancelOrder(auth, args || {});
  if (name === "orbitx_app_limits_tick") return appWalletTickLimits(auth);
  if (name === "orbitx_app_launch") return appLaunch(auth, args || {});
  if (name === "orbitx_app_claim" || name === "orbitx_app_claim_fees") return appClaimFees(auth, args || {});
  if (name === "orbitx_app_burn") return appBurn(auth, args || {});
  // Strategy families: copy-trading, trailing stops + ladders, sniper,
  // alerts, PnL. Dynamic import so a broken strategy module can never
  // take down the core trading dispatcher.
  const strategyDispatchers = [
    ["./_mcp-copy.js", "dispatchCopyTools"],
    ["./_mcp-trailing.js", "dispatchTrailingTools"],
    ["./_mcp-sniper.js", "dispatchSniperTools"],
    ["./_mcp-alerts.js", "dispatchAlertTools"],
    ["./_mcp-pnl.js", "dispatchPnlTools"],
    ["./_mcp-agentplus.js", "dispatchAgentPlusTools"],
  ];
  for (const [modPath, fnName] of strategyDispatchers) {
    try {
      const mod = await import(modPath);
      const fn = mod[fnName];
      if (typeof fn === "function") {
        const out = await fn(name, args, auth);
        if (out) return out;
      }
    } catch {
      /* strategy module failure is isolated; core tools keep working */
    }
  }
  return null;
}

export function isAppWalletTool(name) {
  const n = String(name || "");
  return n.startsWith("orbitx_app_") || n.startsWith("orbitx_agentplus_");
}

const authCode = { type: "string" };

export const APP_WALLET_CORE_TOOLS = [
  { name: "orbitx_app_wallet", description: "In-app trading wallet. Backend signs. No popup.", inputSchema: { type: "object", properties: { authCode } } },
  { name: "orbitx_app_wallet_create", description: "Create trading wallet. Backend keeps encrypted key and signs in background.", inputSchema: { type: "object", properties: { authCode } } },
  { name: "orbitx_app_wallet_export", description: "Export private key to the user. Only when they ask.", inputSchema: { type: "object", properties: { authCode } } },
  { name: "orbitx_app_wallet_revoke", description: "Revoke backend signing for this wallet.", inputSchema: { type: "object", properties: { authCode } } },
  {
    name: "orbitx_app_buy",
    description: "Buy a token now. Backend signs. payWith: sol | usdc. usd or amountSol or amountUsdc. slippageBps: slippage tolerance in basis points, 0-5000, default 200.",
    inputSchema: { type: "object", properties: { mint: { type: "string" }, usd: { type: "number" }, amountSol: { type: "number" }, amountUsdc: { type: "number" }, payWith: { type: "string" }, slippageBps: { type: "number", description: "Slippage tolerance in basis points, 0-5000. Default 200." }, authCode }, required: ["mint"] },
  },
  {
    name: "orbitx_app_sell",
    description: "Sell now. Backend signs. percent 1-100 or fraction 0-1. slippageBps: slippage tolerance in basis points, 0-5000, default 200.",
    inputSchema: { type: "object", properties: { mint: { type: "string" }, percent: { type: "number" }, fraction: { type: "number" }, slippageBps: { type: "number", description: "Slippage tolerance in basis points, 0-5000. Default 200." }, authCode }, required: ["mint"] },
  },
  {
    name: "orbitx_app_limit",
    description: "Arm a backend limit order. trigger/percent = trigger move % (1-100, e.g. 15 = sell when up 15%). Sell size: fraction 0-1 or amount (raw tokens), default 100%. Buy size: usd/amountSol/amountUsdc, default $1. slippageBps: slippage tolerance for the fill, 0-5000, default 200. Backend checks every few minutes and signs the fill when hit. No click.",
    inputSchema: { type: "object", properties: { mint: { type: "string" }, trigger: { type: "string" }, percent: { type: "number" }, fraction: { type: "number" }, amount: { type: ["number", "string"] }, usd: { type: "number" }, amountSol: { type: "number" }, amountUsdc: { type: "number" }, payWith: { type: "string" }, side: { type: "string" }, slippageBps: { type: "number", description: "Slippage tolerance in basis points for the auto-fill, 0-5000. Default 200." }, authCode }, required: ["mint"] },
  },
  {
    name: "orbitx_app_cancel_order",
    description: "Cancel an open backend limit order. Pass orderId (from orbitx_app_orders) or mint to cancel all open orders for that mint.",
    inputSchema: { type: "object", properties: { orderId: { type: "string" }, mint: { type: "string" }, authCode }, },
  },
  { name: "orbitx_app_orders", description: "List limit orders (open, filled, failed, cancelled) with orderId.", inputSchema: { type: "object", properties: { authCode } } },
  { name: "orbitx_app_limits_tick", description: "Check open limits and fill any that hit. Backend signs.", inputSchema: { type: "object", properties: { authCode } } },
  ...APP_DESK_OPS_TOOLS,
];
