/**
 * MCP trading wallet — backend signs. No Phantom popup. No sign link.
 * Key is AES-GCM encrypted in agent_delegated_wallets.
 * Private keys are NEVER returned through MCP. Export is platform-only:
 * the signed-in OrbitX app (delegated-wallet endpoint, session auth).
 */
import {
  getUserWallet,
  createUserWallet,
  revokeUserWallet,
  signUserSwap,
  signAndSendUserTx,
  loadDeskKeypair,
  coerceSlippageBps,
  SLIPPAGE_BPS_DEFAULT,
  getDeskSolLamports,
  getDeskFunds,
  SOL_MINT,
  isSigningAuth,
  TICK_AUTH_SOURCE,
  getTxConfirmationStatus,
  getWalletLockState,
} from "./_user-trading-wallet.js";
import { appLaunch, appClaimFees, appBurn, appRentRefund, appUnwrapWsol, appNftMint, appNftBuy, appNftList, appNftTransfer, appNftApproveDelegate, APP_DESK_OPS_TOOLS } from "./_mcp-app-desk-ops.js";
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
  const lock = await getWalletLockState(gate.userId).catch(() => null);
  return {
    ok: true,
    exists: true,
    pinSet: !!lock?.pinSet,
    unlocked: lock ? !!lock.unlocked : true,
    unlockUntil: lock?.unlockUntil || null,
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
    exportHint: "Private keys can only be exported inside the OrbitX platform while signed in — never through MCP.",
  };
}

export async function appWalletExport(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  // Hard rule (2026-10-21): MCP never returns private keys. Export happens
  // only in the OrbitX platform, behind the user's signed-in session.
  return {
    ok: false,
    error: "export_platform_only",
    message: "Private keys are never given out through MCP. To export this wallet's key, open OrbitX while signed in and use Wallet → Export there.",
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
  if (name === "orbitx_app_rent_refund") return appRentRefund(auth, args || {});
  if (name === "orbitx_app_unwrap_wsol") return appUnwrapWsol(auth, args || {});
  if (name === "orbitx_app_nft_mint") return appNftMint(auth, args || {});
  if (name === "orbitx_app_nft_buy") return appNftBuy(auth, args || {});
  if (name === "orbitx_app_nft_list") return appNftList(auth, args || {});
  if (name === "orbitx_app_nft_transfer") return appNftTransfer(auth, args || {});
  if (name === "orbitx_app_nft_approve_delegate") return appNftApproveDelegate(auth, args || {});
  if (name === "orbitx_send_sol") return appSendSol(auth, args || {});
  if (name === "orbitx_tip") return appTip(auth, args || {});
  if (name === "orbitx_app_tip") return appTipUsd(auth, args || {});
  if (name === "orbitx_app_airdrop") return appAirdrop(auth, args || {});
  if (name === "orbitx_dca_create") return appDcaCreate(auth, args || {});
  if (name === "orbitx_dca_list") return appDcaList(auth, args || {});
  if (name === "orbitx_dca_cancel") return appDcaCancel(auth, args || {});
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

/* ==================== SOL Transfers, Tipping & DCA ==================== */

const ORBITX_MINT_ADDR = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function validPubkey(s) {
  return PUBKEY_RE.test(String(s || "").trim());
}

async function buildAndSendTransfer(row, { toPubkey, lamports, mint }) {
  const { PublicKey, SystemProgram, Transaction, Connection } = await import("@solana/web3.js");
  const from = new PublicKey(row.public_key);
  const to = new PublicKey(toPubkey);
  // RPC URL: reuse the same helper the trading wallet uses
  const { rpcUrl } = await import("./_user-trading-wallet.js").catch(() => ({}));
  const rpc = typeof rpcUrl === "function" ? rpcUrl() : (process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com");
  const conn = new Connection(rpc, "confirmed");
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: from, recentBlockhash: blockhash });
  if (!mint || mint === "SOL" || mint === SOL_MINT) {
    tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports }));
  } else {
    // SPL token transfer
    const spl = await import("@solana/spl-token");
    const mintPk = new PublicKey(mint);
    const fromAta = await spl.getAssociatedTokenAddress(mintPk, from);
    const toAta = await spl.getAssociatedTokenAddress(mintPk, to);
    // Create recipient ATA if it doesn't exist
    const toInfo = await conn.getAccountInfo(toAta);
    if (!toInfo) {
      tx.add(spl.createAssociatedTokenAccountInstruction(from, toAta, to, mintPk));
    }
    tx.add(spl.createTransferInstruction(fromAta, toAta, from, lamports));
  }
  const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  const txBase64 = Buffer.from(serialized).toString("base64");
  return signAndSendUserTx(row, txBase64);
}

export async function appSendSol(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet", message: "Create a wallet first via orbitx_app_wallet_create." };
  const destination = String(args.destination || args.to || "").trim();
  if (!validPubkey(destination)) {
    return { ok: false, error: "bad_destination", message: "destination must be a valid Solana wallet address." };
  }
  const amountSol = Number(args.amount || args.amountSol);
  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    return { ok: false, error: "bad_amount", message: "amount must be a positive number of SOL." };
  }
  if (amountSol > 1000) {
    return { ok: false, error: "amount_too_large", message: "Transfers are capped at 1000 SOL per call for safety." };
  }
  const funds = await getDeskFunds(row.public_key);
  const lamports = Math.floor(amountSol * 1e9);
  const balanceLamports = Number(funds?.sol) * 1e9;
  if (!Number.isFinite(balanceLamports)) {
    return { ok: false, error: "balance_unavailable", message: "Could not read wallet balance — try again." };
  }
  // Keep a minimal fee buffer (~0.0001 SOL covers a basic transfer fee)
  if (balanceLamports < lamports + 100000) {
    return { ok: false, error: "insufficient_balance", message: `Insufficient SOL. Balance: ${(balanceLamports / 1e9).toFixed(4)} SOL, need ${amountSol} + fees.` };
  }
  try {
    const result = await buildAndSendTransfer(row, { toPubkey: destination, lamports });
    if (result.ok) {
      return {
        ok: true,
        signature: result.signature,
        amount: amountSol,
        token: "SOL",
        destination,
        solscan: `https://solscan.io/tx/${result.signature}`,
        confirmed: result.confirmed,
      };
    }
    return { ok: false, error: result.error || "transfer_failed", message: result.message, signature: result.signature };
  } catch (e) {
    return { ok: false, error: "transfer_error", message: String(e.message || e) };
  }
}

export async function appTip(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet", message: "Create a wallet first via orbitx_app_wallet_create." };
  let recipient = String(args.recipient || args.to || args.destination || "").trim();
  // If it's a handle (starts with @), try to resolve — for now require wallet address
  if (recipient.startsWith("@")) {
    return { ok: false, error: "handle_not_resolved", message: "Handle resolution isn't available yet — please provide the wallet address directly." };
  }
  if (!validPubkey(recipient)) {
    return { ok: false, error: "bad_recipient", message: "recipient must be a valid Solana wallet address." };
  }
  const amount = Number(args.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "bad_amount", message: "amount must be a positive number." };
  }
  const token = String(args.token || "ORBITX").toUpperCase();
  try {
    if (token === "SOL") {
      const lamports = Math.floor(amount * 1e9);
      const funds = await getDeskFunds(row.public_key);
      const balanceLamports = Number(funds?.sol) * 1e9;
      if (!Number.isFinite(balanceLamports)) {
        return { ok: false, error: "balance_unavailable", message: "Could not read wallet balance — try again." };
      }
      if (balanceLamports < lamports + 10000000) {
        return { ok: false, error: "insufficient_balance", message: `Insufficient SOL.` };
      }
      const result = await buildAndSendTransfer(row, { toPubkey: recipient, lamports });
      if (result.ok) {
        return { ok: true, signature: result.signature, amount, token: "SOL", recipient, solscan: `https://solscan.io/tx/${result.signature}` };
      }
      return { ok: false, error: result.error || "tip_failed", message: result.message };
    } else if (token === "ORBITX") {
      // ORBITX has 6 decimals (standard SPL)
      const lamports = Math.floor(amount * 1e6);
      const result = await buildAndSendTransfer(row, { toPubkey: recipient, lamports, mint: ORBITX_MINT_ADDR });
      if (result.ok) {
        return { ok: true, signature: result.signature, amount, token: "ORBITX", recipient, solscan: `https://solscan.io/tx/${result.signature}` };
      }
      return { ok: false, error: result.error || "tip_failed", message: result.message };
    } else {
      return { ok: false, error: "unsupported_token", message: "token must be SOL or ORBITX." };
    }
  } catch (e) {
    return { ok: false, error: "tip_error", message: String(e.message || e) };
  }
}

/* ==================== USD Tips & Follower Airdrops ==================== */
/* orbitx_app_tip: tip SOL to another OrbitX user by user id, $1-$10.    */
/* orbitx_app_airdrop: batch-send SOL/SPL to your followers. Backend      */
/* signs everything; amounts are USD-denominated and priced at exec time. */
/* F3: broadcast acceptance is NOT success — pending/failed never come    */
/* back as ok:true.                                                       */

const TIP_MIN_USD = 1;
const TIP_MAX_USD = 10;
const AIRDROP_MAX_RECIPIENTS = 500;
const AIRDROP_DEFAULT_RECIPIENTS = 25;
const AIRDROP_MAX_USD_PER_RECIPIENT = 5;
// Stop starting new airdrop chunks with headroom before the 120s fn cap.
const AIRDROP_DEADLINE_MS = 100000;

function transferOutcome(live, success) {
  const base = {
    signature: live?.signature || null,
    tx: live?.signature ? `https://solscan.io/tx/${live.signature}` : null,
    confirmationStatus: live?.confirmationStatus || null,
    ...(success || {}),
  };
  if (live?.pending) {
    return {
      ...base,
      ok: false,
      pending: true,
      status: "pending",
      error: live.error || "tx_unconfirmed",
      message:
        live.message ||
        "Broadcast accepted but not confirmed yet. Check the explorer before retrying; do NOT re-submit.",
    };
  }
  if (!live?.ok) {
    return {
      ...base,
      ok: false,
      status: "failed",
      error: live?.error || "transfer_failed",
      message: live?.message || "The transfer did not complete.",
    };
  }
  return { ...base, ok: true, confirmed: true };
}

function solanaRpcUrl() {
  return process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
}

async function splMintDecimals(mint) {
  const key = String(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "").trim();
  const rpc = key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : solanaRpcUrl();
  try {
    const r = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [mint, { encoding: "jsonParsed" }] }),
      signal: AbortSignal.timeout(10000),
    });
    const j = await r.json();
    const d = j?.result?.value?.data?.parsed?.info?.decimals;
    if (Number.isInteger(d)) return d;
  } catch {}
  return 6;
}

/**
 * orbitx_app_tip — send SOL from the caller's in-app wallet to another
 * user's in-app wallet. USD-denominated, priced at execution via the same
 * DexScreener source the buy/sell tools use. Enforced: $1 min / $10 max.
 */
export async function appTipUsd(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet", message: "Create a wallet first via orbitx_app_wallet_create." };
  const recipientUserId = String(args.recipient_user_id || args.recipientUserId || args.user_id || "").trim();
  if (!recipientUserId) {
    return { ok: false, error: "need_recipient", message: "Pass recipient_user_id (the OrbitX user id of the person you're tipping)." };
  }
  if (recipientUserId === gate.userId) return { ok: false, error: "self_tip", message: "You can't tip yourself." };
  const usd = Number(args.amount_usd ?? args.amountUsd ?? args.usd);
  if (!Number.isFinite(usd) || usd < TIP_MIN_USD || usd > TIP_MAX_USD) {
    return { ok: false, error: "amount_out_of_range", message: `Tips must be between $${TIP_MIN_USD} and $${TIP_MAX_USD} USD.` };
  }
  // Resolve the recipient's in-app wallet (wallet_secrets via getUserWallet —
  // the same store every other app-wallet tool reads).
  const recip = await getUserWallet(recipientUserId);
  const recipAddr = recip?.public_key;
  if (!validPubkey(recipAddr)) {
    return { ok: false, error: "recipient_has_no_wallet", message: "That user hasn't created an in-app wallet yet." };
  }
  const px = await solUsd();
  if (!px || px <= 0) return { ok: false, error: "price_unavailable", message: "SOL price unavailable — try again." };
  const lamports = Math.floor((usd / px) * 1e9);
  if (lamports <= 0) return { ok: false, error: "amount_too_small" };
  const funds = await getDeskFunds(row.public_key);
  if (Number(funds.sol) * 1e9 < lamports + 10000000) {
    return { ok: false, error: "insufficient_balance", message: `Insufficient SOL. Balance: ${Number(funds.sol).toFixed(4)} SOL.` };
  }
  let live;
  try {
    live = await buildAndSendTransfer(row, { toPubkey: recipAddr, lamports });
  } catch (e) {
    return { ok: false, error: "tip_error", message: String(e.message || e) };
  }
  return transferOutcome(live, {
    tool: "orbitx_app_tip",
    signedOn: "backend",
    clickToSign: false,
    amountUsd: usd,
    amountSol: lamports / 1e9,
    solPriceUsd: px,
    recipientUserId,
    recipientWallet: recipAddr,
  });
}

/* Build one legacy tx carrying several transfers (native SOL or SPL). */
async function buildAirdropChunkTx(row, chunk) {
  const { PublicKey, SystemProgram, Transaction, Connection } = await import("@solana/web3.js");
  const from = new PublicKey(row.public_key);
  const conn = new Connection(solanaRpcUrl(), "confirmed");
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: from, recentBlockhash: blockhash });
  const native = chunk[0]?.mint === "SOL";
  if (native) {
    for (const t of chunk) {
      tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: new PublicKey(t.to), lamports: t.amount }));
    }
  } else {
    const spl = await import("@solana/spl-token");
    const mintPk = new PublicKey(chunk[0].mint);
    const fromAta = await spl.getAssociatedTokenAddress(mintPk, from);
    for (const t of chunk) {
      const toPk = new PublicKey(t.to);
      const toAta = await spl.getAssociatedTokenAddress(mintPk, toPk);
      const info = await conn.getAccountInfo(toAta);
      if (!info) tx.add(spl.createAssociatedTokenAccountInstruction(from, toAta, toPk, mintPk));
      tx.add(spl.createTransferInstruction(fromAta, toAta, from, t.amount));
    }
  }
  const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  return Buffer.from(serialized).toString("base64");
}

/**
 * orbitx_app_airdrop — send SOL or an SPL token to N followers (people who
 * follow the caller). Recipients are batched into a few transactions
 * instead of one blocking tx per recipient. Caps: 500 recipients max,
 * $5 per recipient max. Amounts are USD-denominated at execution.
 */
export async function appAirdrop(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet", message: "Create a wallet first via orbitx_app_wallet_create." };
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };

  const mintArg = String(args.token_mint || args.mint || "").trim();
  const isSol = !mintArg || /^sol$/i.test(mintArg);
  const mint = isSol ? "SOL" : mintArg;
  if (!isSol && !validPubkey(mint)) {
    return { ok: false, error: "bad_mint", message: 'token_mint must be "SOL" or a valid SPL mint address.' };
  }
  const perUsd = Number(args.amount_per_recipient_usd ?? args.amountPerRecipientUsd ?? args.amount_usd);
  if (!Number.isFinite(perUsd) || perUsd <= 0) {
    return { ok: false, error: "bad_amount", message: "amount_per_recipient_usd must be a positive number." };
  }
  if (perUsd > AIRDROP_MAX_USD_PER_RECIPIENT) {
    return { ok: false, error: "amount_too_large", message: `Max $${AIRDROP_MAX_USD_PER_RECIPIENT} per recipient.` };
  }
  let maxN = parseInt(args.max_recipients ?? args.maxRecipients ?? AIRDROP_DEFAULT_RECIPIENTS, 10);
  if (!Number.isFinite(maxN) || maxN < 1) maxN = AIRDROP_DEFAULT_RECIPIENTS;
  maxN = Math.min(maxN, AIRDROP_MAX_RECIPIENTS);

  // Followers OF the caller.
  const { data: frows, error: ferr } = await client.from("followers").select("follower_id").eq("followee_id", gate.userId).limit(maxN);
  if (ferr) return { ok: false, error: "followers_unavailable", message: "Could not read your followers — try again." };
  const followerIds = [...new Set((frows || []).map((r) => r.follower_id).filter(Boolean))].filter((id) => String(id) !== String(gate.userId));
  if (!followerIds.length) return { ok: false, error: "no_followers", message: "No followers found to airdrop to." };

  // Resolve in-app wallets in bulk (one query per 100 ids, not per user).
  const walletMap = new Map();
  for (let i = 0; i < followerIds.length; i += 100) {
    const ids = followerIds.slice(i, i + 100);
    const { data } = await client.from("wallet_secrets").select("user_id,address").eq("chain", "solana").in("user_id", ids);
    for (const r of data || []) if (r?.address && validPubkey(r.address)) walletMap.set(String(r.user_id), String(r.address));
  }
  const recipients = followerIds.filter((id) => walletMap.has(String(id)));
  const skippedNoWallet = followerIds.length - recipients.length;
  if (!recipients.length) return { ok: false, error: "no_wallets", message: "None of your followers have an in-app wallet yet." };

  // Price + per-recipient raw amount.
  let perRaw, decimals, priceUsd, symbol;
  if (isSol) {
    priceUsd = await solUsd();
    if (!priceUsd || priceUsd <= 0) return { ok: false, error: "price_unavailable" };
    decimals = 9;
    symbol = "SOL";
    perRaw = Math.floor((perUsd / priceUsd) * 1e9);
  } else {
    const info = await tokenInfo(mint);
    priceUsd = info.priceUsd;
    symbol = info.symbol || "SPL";
    if (!priceUsd || priceUsd <= 0) return { ok: false, error: "price_unavailable", message: "Could not price that token — try again." };
    decimals = await splMintDecimals(mint);
    perRaw = Math.floor((perUsd / priceUsd) * Math.pow(10, decimals));
  }
  if (!perRaw || perRaw <= 0) return { ok: false, error: "amount_too_small", message: "Per-recipient amount rounds to zero at current price." };

  // Balance check up front.
  const funds = await getDeskFunds(row.public_key);
  if (isSol) {
    const need = BigInt(perRaw) * BigInt(recipients.length) + 10000000n;
    if (BigInt(Math.floor(Number(funds.sol) * 1e9)) < need) {
      return { ok: false, error: "insufficient_balance", message: `Need ${(Number(need) / 1e9).toFixed(4)} SOL for ${recipients.length} recipients.` };
    }
  } else {
    const haveRaw = await tokenBalance(row.public_key, mint);
    if (haveRaw < perRaw * recipients.length) {
      return { ok: false, error: "insufficient_balance", message: `Need ${(perRaw * recipients.length / Math.pow(10, decimals)).toFixed(4)} ${symbol}.` };
    }
    if (Number(funds.sol) < 0.05) {
      return { ok: false, error: "insufficient_sol_for_fees", message: "Need at least 0.05 SOL for fees/ATA rent." };
    }
  }

  const transfers = recipients.map((id) => ({ to: walletMap.get(String(id)), userId: id, amount: perRaw, mint }));
  const chunkSize = isSol ? 15 : 10;
  const chunks = [];
  for (let i = 0; i < transfers.length; i += chunkSize) chunks.push(transfers.slice(i, i + chunkSize));

  const start = Date.now();
  const signatures = [];
  const failed = [];
  let sent = 0;
  let truncated = false;
  for (let ci = 0; ci < chunks.length; ci++) {
    if (Date.now() - start > AIRDROP_DEADLINE_MS) { truncated = true; break; }
    let live;
    try {
      const txB64 = await buildAirdropChunkTx(row, chunks[ci]);
      live = await signAndSendUserTx(row, txB64);
    } catch (e) {
      live = { ok: false, error: "chunk_threw", message: String(e.message || e) };
    }
    if (live?.ok) {
      signatures.push(live.signature);
      sent += chunks[ci].length;
    } else {
      failed.push({
        chunk: ci,
        recipients: chunks[ci].length,
        error: live?.error || "chunk_failed",
        message: live?.message || null,
        signature: live?.signature || null,
        pending: !!live?.pending,
      });
      if (live?.pending) { truncated = true; break; } // unconfirmed broadcast — stop, don't keep spending
    }
  }
  const allOk = failed.length === 0 && !truncated;
  return {
    ok: allOk,
    ...(allOk ? {} : { partial: true }),
    tool: "orbitx_app_airdrop",
    signedOn: "backend",
    clickToSign: false,
    token: symbol,
    mint: isSol ? "SOL" : mint,
    amountPerRecipientUsd: perUsd,
    amountPerRecipient: perRaw / Math.pow(10, decimals),
    recipients: recipients.length,
    skippedNoWallet,
    sent,
    chunks: chunks.length,
    signatures,
    ...(failed.length ? { failed } : {}),
    ...(truncated ? { truncated: true, note: "Stopped early (time budget or unconfirmed broadcast). Re-run to continue with remaining recipients." } : {}),
    message: allOk
      ? `Airdropped ${perRaw / Math.pow(10, decimals)} ${symbol} ($${perUsd}) to ${sent} followers in ${signatures.length} tx${signatures.length === 1 ? "" : "s"}.`
      : `Partial airdrop: ${sent}/${recipients.length} sent.`,
  };
}

/* ------------------------------------------------------------------ */
/* Token-gate read helper (powers token-gated posts; no signing).      */
/* checkTokenGate(wallet, mint, minAmount) → { ok, holds, balance, ...} */
/* mint: "SOL" (or the SOL mint) for native SOL, else an SPL mint.      */
/* minAmount is in UI units (SOL, or whole tokens for SPL).             */
/* ------------------------------------------------------------------ */
export async function checkTokenGate(wallet, mint, minAmount) {
  const w = String(wallet || "").trim();
  const m = String(mint || "").trim();
  if (!validPubkey(w)) return { ok: false, error: "bad_wallet", message: "wallet must be a valid Solana address." };
  const need = Number(minAmount);
  if (!Number.isFinite(need) || need < 0) return { ok: false, error: "bad_min", message: "min must be a non-negative number." };
  if (!m || /^sol$/i.test(m) || m === SOL_MINT) {
    const funds = await getDeskFunds(w);
    const bal = Number(funds.sol) || 0;
    return { ok: true, holds: bal >= need, wallet: w, mint: "SOL", balance: bal, required: need, unit: "SOL" };
  }
  if (!validPubkey(m)) return { ok: false, error: "bad_mint", message: "mint must be a valid Solana token address." };
  const decimals = await splMintDecimals(m);
  const raw = await tokenBalance(w, m);
  const bal = raw / Math.pow(10, decimals);
  return { ok: true, holds: bal >= need, wallet: w, mint: m, balance: bal, required: need, decimals };
}

/* DCA schedules — NO SQL. Schedules are created by this tool (validated + formatted),
   stored in the widget's localStorage, and executed by the widget while open.
   For 24/7 server-side DCA, ask Scout to set up a cron. */
export async function appDcaCreate(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const mint = String(args.mint || args.ca || "").trim();
  if (!validPubkey(mint)) return { ok: false, error: "bad_mint", message: "mint must be a valid Solana token address." };
  const amountSol = Number(args.amountSol || args.amount);
  if (!Number.isFinite(amountSol) || amountSol <= 0) return { ok: false, error: "bad_amount" };
  if (amountSol > 100) return { ok: false, error: "amount_too_large", message: "Max 100 SOL per DCA buy." };
  const frequency = String(args.frequency || "daily").toLowerCase();
  if (!["hourly", "daily", "weekly"].includes(frequency)) {
    return { ok: false, error: "bad_frequency", message: "frequency must be hourly, daily, or weekly." };
  }
  const totalBuys = Math.min(Math.max(parseInt(args.totalBuys || args.duration || "7", 10) || 7, 1), 365);
  const scheduleId = `dca_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const schedule = {
    scheduleId,
    mint,
    amountSol,
    frequency,
    totalBuys,
    buysDone: 0,
    status: "active",
    createdAt: new Date().toISOString(),
    nextRunAt: new Date().toISOString(),
  };
  return {
    ok: true,
    schedule,
    message: `DCA ready: ${amountSol} SOL → ${mint.slice(0, 8)}… every ${frequency}, ${totalBuys} buys. Save this schedule in the Trade widget's DCA tab (it runs while the widget is open). For 24/7 execution, ask Scout to set up a cron.`,
    widgetAction: { tab: "dca", importSchedule: schedule },
  };
}

export async function appDcaList(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  return {
    ok: true,
    schedules: [],
    message: "DCA schedules are stored in the Trade widget (localStorage) — open the widget's DCA tab to view and manage them. No server database.",
  };
}

export async function appDcaCancel(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const scheduleId = String(args.scheduleId || args.id || "").trim();
  return {
    ok: true,
    scheduleId,
    message: scheduleId
      ? `Cancel schedule ${scheduleId} in the Trade widget's DCA tab.`
      : "Open the Trade widget's DCA tab to cancel schedules.",
  };
}

export function isAppWalletTool(name) {
  const n = String(name || "");
  return n.startsWith("orbitx_app_") || n.startsWith("orbitx_agentplus_") ||
    n === "orbitx_send_sol" || n === "orbitx_tip" ||
    n === "orbitx_dca_create" || n === "orbitx_dca_list" || n === "orbitx_dca_cancel";
}

const authCode = { type: "string" };

export const APP_WALLET_CORE_TOOLS = [
  { name: "orbitx_app_wallet", description: "In-app trading wallet. Backend signs. No popup.", inputSchema: { type: "object", properties: { authCode } } },
  { name: "orbitx_app_wallet_create", description: "Create trading wallet. Backend keeps encrypted key and signs in background.", inputSchema: { type: "object", properties: { authCode } } },
  { name: "orbitx_app_wallet_export", description: "Private keys are NEVER exported through MCP. Calling this returns instructions to export inside the OrbitX platform (signed-in app only).", inputSchema: { type: "object", properties: { authCode } } },
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
  {
    name: "orbitx_send_sol",
    description: "Send SOL to any wallet. Backend signs from your in-app wallet. Say 'send 0.5 sol to <address>'. Validates address and balance. Returns Solscan link.",
    inputSchema: { type: "object", properties: { destination: { type: "string", description: "Solana wallet address" }, amount: { type: "number", description: "Amount in SOL" }, authCode }, required: ["destination", "amount"] },
  },
  {
    name: "orbitx_tip",
    description: "Tip someone SOL or ORBITX. Recipient can be a wallet address. Backend signs. Defaults to ORBITX.",
    inputSchema: { type: "object", properties: { recipient: { type: "string" }, amount: { type: "number" }, token: { type: "string", description: "SOL or ORBITX, default ORBITX" }, authCode }, required: ["recipient", "amount"] },
  },
  {
    name: "orbitx_dca_create",
    description: "Set up a dollar-cost-average schedule. Backend buys automatically on schedule. frequency: hourly/daily/weekly. totalBuys: number of buys (1-365).",
    inputSchema: { type: "object", properties: { mint: { type: "string" }, amountSol: { type: "number" }, frequency: { type: "string" }, totalBuys: { type: "number" }, authCode }, required: ["mint", "amountSol"] },
  },
  {
    name: "orbitx_dca_list",
    description: "List your DCA schedules with status and progress.",
    inputSchema: { type: "object", properties: { authCode } },
  },
  {
    name: "orbitx_dca_cancel",
    description: "Cancel a DCA schedule. Pass scheduleId from orbitx_dca_list.",
    inputSchema: { type: "object", properties: { scheduleId: { type: "string" }, authCode }, required: ["scheduleId"] },
  },
  {
    name: "orbitx_app_tip",
    description: "Tip another OrbitX user SOL from your in-app wallet by their user id. Backend signs. USD-denominated: $1 min / $10 max per tip, priced at execution. Resolves their in-app wallet automatically.",
    inputSchema: { type: "object", properties: { recipient_user_id: { type: "string", description: "OrbitX user id of the recipient" }, amount_usd: { type: "number", description: "USD value to tip, $1-$10" }, authCode }, required: ["recipient_user_id", "amount_usd"] },
  },
  {
    name: "orbitx_app_airdrop",
    description: "Airdrop SOL or an SPL token to your followers (people who follow you). Backend signs batched transactions — no popup. Max $5 per recipient, max 500 recipients (default 25). token_mint: \"SOL\" or SPL mint address.",
    inputSchema: { type: "object", properties: { token_mint: { type: "string", description: "\"SOL\" or SPL mint address" }, amount_per_recipient_usd: { type: "number", description: "USD per recipient, max $5" }, max_recipients: { type: "number", description: "Cap on recipients, default 25, max 500" }, authCode }, required: ["token_mint", "amount_per_recipient_usd"] },
  },
  ...APP_DESK_OPS_TOOLS,
];
