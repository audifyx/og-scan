/**
 * Copy-trading shared engine — single source of truth for swap parsing,
 * mirror execution, and follow-row writeback.
 *
 * Imported by BOTH:
 *   - the 5-min tick (tickUserCopy in ./_mcp-copy.js), and
 *   - the instant Helius webhook receiver (web/api/orbitx/copy-hook.js),
 * plus the webhook provision/status helpers shared by the HTTP admin
 * endpoint (web/api/orbitx/copy-admin.js) and the orbitx_app_copy_provision
 * MCP tool.
 *
 * The webhook and the tick run the SAME claim+mirror path (mirrorNewSwaps),
 * so a swap delivered by the webhook and later re-polled by the tick cannot
 * double-fill: the webhook marks seenSigs exactly like the tick, and the
 * claim-then-execute fill mutex serializes overlapping webhook/tick runs.
 *
 * No trades execute at import time. No side effects, no top-level await.
 */
import {
  sb,
  tokenInfo,
  walletRow,
  tokenBalance,
  appWalletBuy,
  appWalletSell,
  USDC_MINT,
  claimFillRow,
  resolveFillRow,
  isFillOpen,
  FILL_STATUS,
} from "./_mcp-app-wallet.js";
import { SOL_MINT, TICK_AUTH_SOURCE } from "./_user-trading-wallet.js";

export const COPY_MODES = ["fixed_usd", "percent_of_their_size", "mirror_ratio"];
export const HELIUS_LIMIT = 15;
export const NEW_SWAPS_PER_TICK = 5;
export const SEEN_CAP = 100;
export const FILLS_CAP = 20;
export const THEIR_TRADES_CAP = 200;
export const DUST_USD = 0.5;

// Public URL of the instant webhook receiver (Vercel file routing:
// web/api/orbitx/copy-hook.js -> POST /api/orbitx/copy-hook).
export const COPY_HOOK_URL = "https://www.orbitx.world/api/orbitx/copy-hook";

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Lazy: SOL_MINT/USDC_MINT come from sibling handler modules; building the
// Set at module top-level could read the bindings before they initialize.
function quoteSet() {
  return new Set([SOL_MINT, USDC_MINT]);
}

export function heliusKey() {
  return String(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "").trim();
}

export function copyHookSecret() {
  return String(process.env.COPY_HOOK_SECRET || "").trim();
}

/* ------------------------------------------------------------------ */
/* Helius swap parsing (moved verbatim from _mcp-copy.js)              */
/* ------------------------------------------------------------------ */

export function parseSwap(tx, wallet) {
  const transfers = tx?.tokenTransfers || [];
  const looksLikeSwap =
    tx?.type === "SWAP" ||
    (transfers.some((t) => t.toUserAccount === wallet) && transfers.some((t) => t.fromUserAccount === wallet));
  if (!looksLikeSwap) return null;
  const net = {};
  for (const t of transfers) {
    const mint = t?.mint;
    if (!mint) continue;
    const amt = Number(t.tokenAmount || 0);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    net[mint] = net[mint] || 0;
    if (t.toUserAccount === wallet) net[mint] += amt;
    if (t.fromUserAccount === wallet) net[mint] -= amt;
  }
  let bought = null;
  let sold = null;
  for (const [mint, a] of Object.entries(net)) {
    if (quoteSet().has(mint)) continue; // quote leg of the swap (SOL/USDC) — not the mirrored asset
    if (a > 0 && (!bought || a > bought.amount)) bought = { mint, amount: a };
    if (a < 0 && (!sold || -a > sold.amount)) sold = { mint, amount: -a };
  }
  if (!bought && !sold) return null;
  return { signature: tx.signature, bought, sold };
}

async function mintDecimals(mint) {
  const key = heliusKey();
  const rpc = key ? `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}` : "https://api.mainnet-beta.solana.com";
  try {
    const r = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenSupply", params: [mint] }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json();
    const d = Number(j?.result?.value?.decimals);
    return Number.isFinite(d) && d >= 0 ? d : 6;
  } catch {
    return 6;
  }
}

/* ------------------------------------------------------------------ */
/* follow-row queries                                                  */
/* ------------------------------------------------------------------ */

// Moved verbatim from _mcp-copy.js. includeFilling: follow/unfollow must find
// a row even while a mirror is in-flight (otherwise follow would insert a
// duplicate row). The tick itself never uses includeFilling — that exclusion
// IS the fill mutex.
export async function activeFollowRows(client, userId, includeFilling = false) {
  const { data } = await client
    .from("ox_live_events")
    .select("id,meta")
    .eq("kind", "app_copy")
    .eq("agent_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data || []).filter((r) => {
    if (!r.meta?.followedWallet) return false;
    if (includeFilling) return isFillOpen(r.meta, "active") || r.meta?.status === FILL_STATUS;
    return isFillOpen(r.meta, "active");
  });
}

// Webhook path: the push doesn't carry a userId, so find every active follow
// row (any user) watching this wallet. Same row shape/filter convention as
// activeFollowRows (the "filling" exclusion is the fill mutex here too).
export async function findActiveFollowsByWallet(client, wallet) {
  if (!wallet) return [];
  const { data } = await client
    .from("ox_live_events")
    .select("id,agent_id,meta")
    .eq("kind", "app_copy")
    .eq("meta->>followedWallet", wallet)
    .limit(50);
  return (data || []).filter((r) => r.meta?.followedWallet === wallet && isFillOpen(r.meta, "active"));
}

/* ------------------------------------------------------------------ */
/* mirror execution (moved verbatim from _mcp-copy.js)                 */
/* ------------------------------------------------------------------ */

export async function mirrorSwap(userId, sizing, s, fills, mirrors, now) {
  const auth = { userId, source: TICK_AUTH_SOURCE };
  const pushRec = (rec) => {
    fills.push(rec);
    mirrors.push({ follow: sizing.followedWallet, theirSig: s.signature, side: rec.side, mint: rec.mint, symbol: rec.symbol, usd: rec.usd, ok: rec.ok, pending: !!rec.pending, error: rec.error, signature: rec.sig });
  };
  const priceOf = async (mint) => {
    try {
      return await tokenInfo(mint);
    } catch {
      return { symbol: "?", priceUsd: 0 };
    }
  };

  // Mirror their BUY: they accumulated a non-quote token.
  if (s.bought) {
    const { mint, amount } = s.bought;
    const info = await priceOf(mint);
    const theirUsd = info.priceUsd * amount; // estimated from price at execution time
    let usd;
    if (sizing.mode === "fixed_usd") usd = sizing.sizeValue;
    else if (sizing.mode === "percent_of_their_size") usd = (theirUsd * sizing.sizeValue) / 100;
    else usd = theirUsd * sizing.sizeValue;
    usd = Math.min(usd, sizing.maxPerTradeUsd);
    if (!(usd >= DUST_USD)) {
      pushRec({ sig: null, side: "buy", mint, symbol: info.symbol, usd: Number(usd) || 0, priceUsd: info.priceUsd, theirUsd, theirSig: s.signature, at: now, ok: false, error: "dust", skipped: true, estimate: sizing.mode !== "fixed_usd", message: `Mirror size $${(Number(usd) || 0).toFixed(2)} below dust floor — skipped.` });
    } else {
      let live;
      try {
        live = await appWalletBuy(auth, { mint, usd });
      } catch (e) {
        live = { ok: false, error: "buy_threw", message: e?.message || String(e) };
      }
      pushRec({ sig: live?.signature || null, side: "buy", mint, symbol: info.symbol, usd, priceUsd: info.priceUsd, theirUsd, theirSig: s.signature, at: now, ok: !!live?.ok, pending: !!live?.pending, error: live?.error || live?.message || null, estimate: sizing.mode !== "fixed_usd" });
    }
  }

  // Mirror their SELL: they dumped a non-quote token — exit the same fraction of OUR position.
  if (s.sold) {
    const { mint, amount } = s.sold;
    const info = await priceOf(mint);
    const theirUsd = info.priceUsd * amount; // informational only for sells
    const row = await walletRow(userId);
    if (!row) {
      pushRec({ sig: null, side: "sell", mint, symbol: info.symbol, usd: 0, priceUsd: info.priceUsd, theirUsd, theirSig: s.signature, at: now, ok: false, error: "no_wallet", skipped: true, message: "No desk wallet — nothing to mirror-sell." });
    } else {
      const raw = await tokenBalance(row.public_key, mint);
      if (!raw || raw <= 0) {
        pushRec({ sig: null, side: "sell", mint, symbol: info.symbol, usd: 0, priceUsd: info.priceUsd, theirUsd, theirSig: s.signature, at: now, ok: false, error: "no_balance", skipped: true, message: "We hold none of this token — nothing to mirror-sell." });
      } else {
        let fraction;
        if (sizing.mode === "fixed_usd") {
          const decimals = await mintDecimals(mint);
          const ourAmount = raw / 10 ** decimals;
          const ourPositionUsd = info.priceUsd * ourAmount;
          fraction = ourPositionUsd > 0 ? clamp(sizing.sizeValue / ourPositionUsd, 0.01, 1) : 1;
        } else {
          fraction = clamp(sizing.sizeValue / 100, 0.01, 1);
        }
        let live;
        try {
          live = await appWalletSell(auth, { mint, fraction });
        } catch (e) {
          live = { ok: false, error: "sell_threw", message: e?.message || String(e) };
        }
        pushRec({ sig: live?.signature || null, side: "sell", mint, symbol: info.symbol, usd: 0, priceUsd: info.priceUsd, theirUsd, fraction, theirSig: s.signature, at: now, ok: !!live?.ok, pending: !!live?.pending, error: live?.error || live?.message || null });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* theirTrades: persistent log of THEIR swap events on the follow row  */
/* ------------------------------------------------------------------ */

// Pure helper: dedupe by signature+side, drop oldest past the cap.
export function recordTheirTrades(existing, entries, cap = THEIR_TRADES_CAP) {
  const seen = new Set((existing || []).map((t) => `${t?.signature}|${t?.side}`));
  const out = [...(existing || [])];
  for (const e of entries || []) {
    if (!e?.signature) continue;
    const k = `${e.signature}|${e.side}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out.slice(-cap);
}

/* ------------------------------------------------------------------ */
/* shared claim+mirror path — used by BOTH the 5-min tick and the       */
/* instant webhook. Returns { status: "ok"|"blocked", mirrors }.        */
/* Status semantics are exactly the old tickOneFollow's: claim_lost ->  */
/* "blocked"; everything else (including resolve_lost) -> "ok".         */
/* ------------------------------------------------------------------ */

export async function mirrorNewSwaps(userId, row, client, swaps, ctx = {}) {
  const meta = row.meta || {};
  const wallet = meta.followedWallet;
  const mode = COPY_MODES.includes(meta.mode) ? meta.mode : "fixed_usd";
  const sizeValue = Number(meta.sizeValue) > 0 ? Number(meta.sizeValue) : 1;
  const maxPerTradeUsd = Number(meta.maxPerTradeUsd) > 0 ? Number(meta.maxPerTradeUsd) : 25;

  const sizing = { mode, sizeValue, maxPerTradeUsd, followedWallet: wallet };
  const fills = meta.fills || [];
  const mirrors = [];
  const seen = new Set(meta.seenSigs || []);
  const theirTrades = [];
  const now = new Date().toISOString();
  const deadlineMs = Number(ctx?.deadlineMs || 0);

  // Belt & braces: the tick pre-filters, the webhook doesn't. Marking here
  // keeps both paths identical — a signature is mirrored at most once.
  const todo = [];
  for (const s of swaps || []) {
    if (!s?.signature || seen.has(s.signature)) continue;
    todo.push(s);
  }

  // Claim-then-execute: serialize overlapping ticks/webhook deliveries at the
  // follow-row level so two runs can't mirror the same new swaps (F1).
  let claimMeta = null;
  if (todo.length > 0) {
    if (deadlineMs && Date.now() > deadlineMs) {
      mirrors.push({ follow: wallet, ok: false, error: "truncated", message: "Budget exhausted before mirroring — deferred to next tick." });
      return { status: "blocked", mirrors };
    }
    claimMeta = await claimFillRow(client, row.id, meta, { openValue: "active", bumpAttempts: false });
    if (!claimMeta) {
      mirrors.push({ follow: wallet, ok: false, error: "claim_lost", message: "Another run is mirroring this follow — skipped." });
      return { status: "blocked", mirrors };
    }
  }

  for (const s of todo) {
    if (deadlineMs && Date.now() > deadlineMs) {
      mirrors.push({ follow: wallet, theirSig: s.signature, ok: false, error: "truncated", message: "Budget exhausted — remaining mirrors deferred to next tick." });
      break;
    }
    const before = fills.length;
    try {
      await mirrorSwap(userId, sizing, s, fills, mirrors, now);
    } catch (e) {
      const rec = { sig: null, side: null, mint: null, symbol: null, usd: 0, priceUsd: 0, theirSig: s.signature, at: now, ok: false, error: "mirror_threw", message: e?.message || String(e) };
      fills.push(rec);
      mirrors.push({ follow: wallet, theirSig: s.signature, ok: false, error: "mirror_threw", message: rec.message });
    }
    seen.add(s.signature);
    // Record THEIR swap legs from the mirror records just pushed: each
    // record carries their-side data (mint/symbol/priceUsd/theirUsd); the
    // token-unit amount comes from the parsed swap. Thrown-mirror records
    // (mint null) are skipped — we couldn't price the leg.
    for (const rec of fills.slice(before)) {
      if (!rec?.mint || rec.theirSig !== s.signature) continue;
      if (rec.side !== "buy" && rec.side !== "sell") continue;
      const leg = rec.side === "buy" ? s.bought : s.sold;
      theirTrades.push({
        signature: s.signature,
        side: rec.side,
        mint: rec.mint,
        symbol: rec.symbol,
        amount: Number(leg?.amount) || 0,
        theirUsd: Number(rec.theirUsd) || 0,
        priceUsd: Number(rec.priceUsd) || 0,
        at: now,
      });
    }
  }

  const patch = {
    ...(claimMeta || meta),
    seenSigs: [...seen].slice(-SEEN_CAP),
    fills: fills.slice(-FILLS_CAP),
    theirTrades: recordTheirTrades(meta.theirTrades, theirTrades),
    lastCheckAt: now,
  };
  if (claimMeta) {
    const resolved = await resolveFillRow(client, row.id, patch, "active");
    if (!resolved) {
      // Claim lost mid-flight (re-armed/cancelled by the user, or transport
      // errors exhausted). Mirrors already executed — persist just the
      // seenSigs under a fillingAt guard so a later reap won't re-mirror
      // them, without clobbering whatever state the row is in now.
      try {
        await client.from("ox_live_events").update({ meta: patch })
          .eq("id", row.id)
          .eq("meta->>status", FILL_STATUS)
          .eq("meta->>fillingAt", claimMeta.fillingAt);
      } catch { /* best-effort dedup note */ }
      mirrors.push({ follow: wallet, ok: false, error: "resolve_lost", message: "Mirror claim lost mid-flight — mirrors executed; seenSigs write best-effort." });
    }
  } else {
    try {
      // Guarded: never clobber a concurrent "filling" claim's status.
      await client.from("ox_live_events").update({ meta: patch }).eq("id", row.id).neq("meta->>status", FILL_STATUS);
    } catch {
      /* best-effort; no fill happened on this path */
    }
  }
  return { status: "ok", mirrors };
}

/* ------------------------------------------------------------------ */
/* Helius webhook provision/status — shared by the HTTP admin endpoint  */
/* and the orbitx_app_copy_provision MCP tool. The server-side Helius   */
/* key and COPY_HOOK_SECRET are NEVER included in any returned object. */
/* ------------------------------------------------------------------ */

function maskWebhook(h) {
  if (!h || typeof h !== "object") return h;
  const { authHeader, ...rest } = h; // never leak the secret
  return { ...rest, authHeader: authHeader ? "***set***" : null };
}

async function heliusWebhooks(key) {
  const r = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${encodeURIComponent(key)}`, {
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`helius_${r.status}`);
  const j = await r.json().catch(() => []);
  return Array.isArray(j) ? j : [];
}

// Distinct followedWallet values across every active follow row (all users).
export async function copyWebhookWallets(client) {
  const { data } = await client.from("ox_live_events").select("meta").eq("kind", "app_copy").limit(500);
  const out = [];
  for (const r of data || []) {
    const m = r?.meta || {};
    if (!m.followedWallet || !isFillOpen(m, "active")) continue;
    if (!out.includes(m.followedWallet)) out.push(m.followedWallet);
  }
  return out;
}

export async function copyWebhookStatus() {
  const key = heliusKey();
  if (!key) return { ok: false, error: "helius_key_missing", message: "Server-side Helius key is not configured." };
  let hooks;
  try {
    hooks = await heliusWebhooks(key);
  } catch (e) {
    return { ok: false, error: "helius_unreachable", message: String(e?.message || e) };
  }
  const ours = hooks.find((h) => h?.webhookURL === COPY_HOOK_URL) || null;
  const client = await sb();
  const wallets = client ? await copyWebhookWallets(client) : [];
  return {
    ok: true,
    ours: Boolean(ours),
    webhook: ours ? maskWebhook(ours) : null,
    webhooks: hooks.map(maskWebhook),
    watchedWallets: wallets,
    secretConfigured: Boolean(copyHookSecret()),
  };
}

export async function copyWebhookProvision() {
  const secret = copyHookSecret();
  if (!secret) {
    return {
      ok: false,
      error: "secret_missing",
      message: "COPY_HOOK_SECRET is not set — refusing to register an unverifiable webhook. Set it in Vercel env, then provision again. The 5-min tick remains the fallback.",
    };
  }
  const key = heliusKey();
  if (!key) return { ok: false, error: "helius_key_missing", message: "Server-side Helius key is not configured." };
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable", message: "Follow store unreachable. Retry in a minute." };
  const wallets = await copyWebhookWallets(client);
  if (!wallets.length) {
    return { ok: false, error: "no_active_follows", message: "No actively-followed wallets to watch — add a follow first." };
  }
  let hooks;
  try {
    hooks = await heliusWebhooks(key);
  } catch (e) {
    return { ok: false, error: "helius_unreachable", message: String(e?.message || e) };
  }
  const existing = hooks.find((h) => h?.webhookURL === COPY_HOOK_URL) || null;
  const payload = {
    webhookURL: COPY_HOOK_URL,
    transactionTypes: ["SWAP"],
    accountAddresses: [...new Set([...(existing?.accountAddresses || []), ...wallets])],
    webhookType: "enhanced",
    authHeader: secret,
  };
  let res;
  try {
    if (existing?.webhookID) {
      res = await fetch(`https://api.helius.xyz/v0/webhooks/${encodeURIComponent(existing.webhookID)}?api-key=${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
    } else {
      res = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
    }
  } catch (e) {
    return { ok: false, error: "helius_unreachable", message: String(e?.message || e) };
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: "helius_rejected", status: res.status, detail: body?.error || body?.message || null };
  }
  return {
    ok: true,
    updated: Boolean(existing),
    webhook: maskWebhook(body?.webhook || body),
    watchedWallets: payload.accountAddresses,
  };
}
