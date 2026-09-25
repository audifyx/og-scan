/**
 * Copy trading — mirror other Solana wallets' trades from the user's desk wallet.
 *
 * Follow a wallet, pick a sizing mode (fixed_usd | percent_of_their_size | mirror_ratio),
 * and the tick reads their recent swaps (Helius) and replays them backend-signed via
 * appWalletBuy / appWalletSell. One row per (user, followedWallet) in ox_live_events
 * (kind "app_copy"), status lifecycle in meta like the limit system.
 *
 * Wired by parent: dispatchCopyTools(name, args, auth), COPY_TOOLS, tickUserCopy(userId, ctx).
 * No trades execute at import time. No side effects, no top-level await.
 */
import {
  needAuth,
  sb,
  tokenInfo,
  walletRow,
  tokenBalance,
  appWalletBuy,
  appWalletSell,
  USDC_MINT,
} from "./_mcp-app-wallet.js";
import { SOL_MINT } from "./_user-trading-wallet.js";

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const COPY_MODES = ["fixed_usd", "percent_of_their_size", "mirror_ratio"];
// Lazy: SOL_MINT/USDC_MINT come from _mcp-app-wallet.js, which imports this
// module back (cycle) — building the Set at module top-level would read the
// bindings before they initialize.
function quoteSet() {
  return new Set([SOL_MINT, USDC_MINT]);
}
const HELIUS_LIMIT = 15;
const NEW_SWAPS_PER_TICK = 5;
const SEEN_CAP = 100;
const FILLS_CAP = 20;
const DUST_USD = 0.5;

// Fatal-ish codes carried for consistency with the limit system. Copy ticks skip
// gracefully (never burn attempts), so this set is mostly documentary.
export const FATAL_COPY = new Set(["no_balance", "no_wallet", "bad_mint", "size", "need_size"]);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function heliusKey() {
  return String(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "").trim();
}

function normalizeParams(args = {}) {
  const wallet = String(args.wallet || "").trim();
  const mode = String(args.mode || "").trim();
  const sizeValue = Number(args.size);
  let maxPerTradeUsd = Number(args.maxPerTradeUsd == null ? 25 : args.maxPerTradeUsd);
  if (!Number.isFinite(maxPerTradeUsd) || maxPerTradeUsd <= 0) maxPerTradeUsd = 25;
  maxPerTradeUsd = Math.min(maxPerTradeUsd, 1000);
  const label = String(args.label || "").trim().slice(0, 64) || null;
  return { wallet, mode, sizeValue, maxPerTradeUsd, label };
}

function validateFollow({ wallet, mode, sizeValue }) {
  if (!MINT_RE.test(wallet)) return { ok: false, error: "bad_wallet", message: "wallet must be a base58 pubkey (32-44 chars)." };
  if (!COPY_MODES.includes(mode)) return { ok: false, error: "bad_mode", message: `mode must be one of: ${COPY_MODES.join(", ")}.` };
  if (!Number.isFinite(sizeValue) || sizeValue <= 0) return { ok: false, error: "bad_size", message: "size must be a number > 0." };
  if (mode === "percent_of_their_size" && (sizeValue < 0.01 || sizeValue > 100))
    return { ok: false, error: "bad_size", message: "percent_of_their_size size is a percent and must be 0.01-100." };
  if (mode === "mirror_ratio" && (sizeValue < 0.01 || sizeValue > 10))
    return { ok: false, error: "bad_size", message: "mirror_ratio size is a multiplier and must be 0.01-10." };
  return null;
}

async function activeFollowRows(client, userId) {
  const { data } = await client
    .from("ox_live_events")
    .select("id,meta")
    .eq("kind", "app_copy")
    .eq("agent_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data || []).filter((r) => (r.meta?.status || "active") === "active" && r.meta?.followedWallet);
}

/* ------------------------------------------------------------------ */
/* follow / unfollow / list                                           */
/* ------------------------------------------------------------------ */

export async function appCopyFollow(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet", message: "Create a desk wallet first (orbitx_app_wallet_create)." };
  const params = normalizeParams(args);
  const bad = validateFollow(params);
  if (bad) return bad;
  const { wallet, label, mode, sizeValue, maxPerTradeUsd } = params;
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable", message: "Follow store unreachable. Retry in a minute." };
  const rows = await activeFollowRows(client, gate.userId);
  const existing = rows.find((r) => r.meta.followedWallet === wallet);
  const now = new Date().toISOString();
  if (existing) {
    // Upsert: update params in place, keep follow history (seenSigs / fills).
    const merged = {
      ...(existing.meta || {}),
      label,
      mode,
      sizeValue,
      maxPerTradeUsd,
      status: "active",
      updatedAt: now,
    };
    await client.from("ox_live_events").update({ thesis: `copy ${label || wallet}`, meta: merged }).eq("id", existing.id);
  } else {
    const meta = {
      followedWallet: wallet,
      label,
      mode,
      sizeValue,
      maxPerTradeUsd,
      status: "active",
      seenSigs: [],
      fills: [],
      createdAt: now,
      lastCheckAt: null,
    };
    await client.from("ox_live_events").insert({
      kind: "app_copy",
      agent_id: gate.userId,
      mint: null,
      symbol: null,
      side: null,
      thesis: `copy ${label || wallet}`,
      meta,
    });
  }
  return { ok: true, following: { wallet, label, mode, sizeValue, maxPerTradeUsd } };
}

export async function appCopyUnfollow(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const wallet = String(args.wallet || "").trim();
  if (!MINT_RE.test(wallet)) return { ok: false, error: "bad_wallet", message: "wallet must be a base58 pubkey (32-44 chars)." };
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable", message: "Follow store unreachable. Retry in a minute." };
  const rows = await activeFollowRows(client, gate.userId);
  const target = rows.find((r) => r.meta.followedWallet === wallet);
  if (!target) return { ok: false, error: "not_found", message: "No active follow for that wallet." };
  await client
    .from("ox_live_events")
    .update({ meta: { ...(target.meta || {}), status: "cancelled", cancelledAt: new Date().toISOString() } })
    .eq("id", target.id);
  return { ok: true, unfollowed: wallet };
}

export async function appCopyList(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const client = await sb();
  if (!client) return { ok: true, follows: [] };
  const rows = await activeFollowRows(client, gate.userId);
  return {
    ok: true,
    follows: rows.map((r) => {
      const m = r.meta || {};
      return {
        followId: r.id,
        wallet: m.followedWallet,
        label: m.label || null,
        mode: m.mode,
        sizeValue: m.sizeValue,
        maxPerTradeUsd: m.maxPerTradeUsd,
        fills: (m.fills || []).length,
        createdAt: m.createdAt || null,
        lastCheckAt: m.lastCheckAt || null,
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Helius swap parsing                                                */
/* ------------------------------------------------------------------ */

function parseSwap(tx, wallet) {
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
/* tick                                                               */
/* ------------------------------------------------------------------ */

export async function tickUserCopy(userId, ctx) {
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const rows = await activeFollowRows(client, userId);
  const mirrors = [];
  let checked = 0;
  for (const row of rows) {
    try {
      const res = await tickOneFollow(userId, row, client, mirrors);
      if (res === "ok") checked += 1;
    } catch (e) {
      // One bad follow never stops others.
      mirrors.push({ follow: row.meta?.followedWallet || null, ok: false, error: "follow_threw", message: e?.message || String(e) });
    }
  }
  if (checked === 0 && rows.length > 0) {
    return { ok: true, checked: 0, note: "history_unavailable", mirrors };
  }
  return { ok: true, checked, mirrors };
}

async function tickOneFollow(userId, row, client, mirrors) {
  const meta = row.meta || {};
  const wallet = meta.followedWallet;
  const mode = COPY_MODES.includes(meta.mode) ? meta.mode : "fixed_usd";
  const sizeValue = Number(meta.sizeValue) > 0 ? Number(meta.sizeValue) : 1;
  const maxPerTradeUsd = Number(meta.maxPerTradeUsd) > 0 ? Number(meta.maxPerTradeUsd) : 25;

  const key = heliusKey();
  if (!key) {
    mirrors.push({ follow: wallet, ok: false, error: "history_unavailable", message: "Helius key not configured — skipped." });
    return "blocked";
  }
  let txs;
  try {
    const r = await fetch(
      `https://api.helius.xyz/v0/addresses/${encodeURIComponent(wallet)}/transactions?api-key=${encodeURIComponent(key)}&limit=${HELIUS_LIMIT}`,
      { signal: AbortSignal.timeout(12000) }
    );
    if (!r.ok) {
      mirrors.push({ follow: wallet, ok: false, error: "history_unavailable", message: `Helius responded ${r.status}.` });
      return "blocked";
    }
    txs = await r.json().catch(() => []);
  } catch {
    mirrors.push({ follow: wallet, ok: false, error: "history_unavailable", message: "Helius unreachable." });
    return "blocked";
  }

  const seen = new Set(meta.seenSigs || []);
  const swaps = [];
  for (const tx of txs || []) {
    if (!tx?.signature || seen.has(tx.signature)) continue;
    const s = parseSwap(tx, wallet);
    if (s) swaps.push(s);
  }
  swaps.reverse(); // oldest-first so history replays in order
  const todo = swaps.slice(0, NEW_SWAPS_PER_TICK);
  const fills = meta.fills || [];
  const now = new Date().toISOString();
  const sizing = { mode, sizeValue, maxPerTradeUsd, followedWallet: wallet };

  for (const s of todo) {
    try {
      await mirrorSwap(userId, sizing, s, fills, mirrors, now);
    } catch (e) {
      const rec = { sig: null, side: null, mint: null, symbol: null, usd: 0, priceUsd: 0, theirSig: s.signature, at: now, ok: false, error: "mirror_threw", message: e?.message || String(e) };
      fills.push(rec);
      mirrors.push({ follow: wallet, theirSig: s.signature, ok: false, error: "mirror_threw", message: rec.message });
    }
    seen.add(s.signature);
  }

  const patch = {
    ...meta,
    seenSigs: [...seen].slice(-SEEN_CAP),
    fills: fills.slice(-FILLS_CAP),
    lastCheckAt: now,
  };
  try {
    await client.from("ox_live_events").update({ meta: patch }).eq("id", row.id);
  } catch {
    /* status write is best-effort; the fills themselves already happened or failed */
  }
  return "ok";
}

async function mirrorSwap(userId, sizing, s, fills, mirrors, now) {
  const auth = { userId };
  const pushRec = (rec) => {
    fills.push(rec);
    mirrors.push({ follow: sizing.followedWallet, theirSig: s.signature, side: rec.side, mint: rec.mint, symbol: rec.symbol, usd: rec.usd, ok: rec.ok, error: rec.error, signature: rec.sig });
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
      pushRec({ sig: live?.signature || null, side: "buy", mint, symbol: info.symbol, usd, priceUsd: info.priceUsd, theirUsd, theirSig: s.signature, at: now, ok: !!live?.ok, error: live?.error || live?.message || null, estimate: sizing.mode !== "fixed_usd" });
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
        pushRec({ sig: live?.signature || null, side: "sell", mint, symbol: info.symbol, usd: 0, priceUsd: info.priceUsd, theirUsd, fraction, theirSig: s.signature, at: now, ok: !!live?.ok, error: live?.error || live?.message || null });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* tool defs + dispatch                                               */
/* ------------------------------------------------------------------ */

const authCode = { type: "string" };

export const COPY_TOOLS = [
  {
    name: "orbitx_app_copy_follow",
    description:
      "Follow a Solana wallet and mirror its swaps from your desk wallet. Backend signs every mirror trade. mode: fixed_usd (mirror each buy for `size` USD) | percent_of_their_size (mirror `size`% of their trade size, 0.01-100) | mirror_ratio (mirror `size`x of their trade size, 0.01-10). maxPerTradeUsd caps each mirrored trade (default 25, max 1000). Sells mirror as the same fraction of YOUR balance. Existing follow is updated, not duplicated.",
    inputSchema: {
      type: "object",
      properties: {
        wallet: { type: "string" },
        label: { type: "string" },
        mode: { type: "string" },
        size: { type: "number" },
        maxPerTradeUsd: { type: "number" },
        authCode,
      },
      required: ["wallet", "mode", "size"],
    },
  },
  {
    name: "orbitx_app_copy_unfollow",
    description: "Stop mirroring a followed wallet. Keeps the mirror-fill history, marks the follow cancelled.",
    inputSchema: { type: "object", properties: { wallet: { type: "string" }, authCode }, required: ["wallet"] },
  },
  {
    name: "orbitx_app_copy_list",
    description: "List wallets you are copy-trading: mode, size, maxPerTradeUsd, mirror-fill counts.",
    inputSchema: { type: "object", properties: { authCode } },
  },
];

export function dispatchCopyTools(name, args, auth) {
  if (name === "orbitx_app_copy_follow") return appCopyFollow(auth, args || {});
  if (name === "orbitx_app_copy_unfollow") return appCopyUnfollow(auth, args || {});
  if (name === "orbitx_app_copy_list") return appCopyList(auth);
  return null;
}
