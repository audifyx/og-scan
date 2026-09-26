/**
 * Copy trading — mirror other Solana wallets' trades from the user's desk wallet.
 *
 * Follow a wallet, pick a sizing mode (fixed_usd | percent_of_their_size | mirror_ratio),
 * and the tick reads their recent swaps (Helius) and replays them backend-signed via
 * appWalletBuy / appWalletSell. One row per (user, followedWallet) in ox_live_events
 * (kind "app_copy"), status lifecycle in meta like the limit system.
 *
 * Swap parsing, mirror execution, and the claim+mirror writeback path live in
 * ./_mcp-copy-engine.js — shared verbatim with the instant Helius webhook
 * receiver (web/api/orbitx/copy-hook.js) so the two can never double-fill.
 *
 * Wired by parent: dispatchCopyTools(name, args, auth), COPY_TOOLS, tickUserCopy(userId, ctx).
 * No trades execute at import time. No side effects, no top-level await.
 */
import {
  needAuth,
  sb,
  walletRow,
  FILL_STATUS,
} from "./_mcp-app-wallet.js";
import {
  COPY_MODES,
  HELIUS_LIMIT,
  NEW_SWAPS_PER_TICK,
  heliusKey,
  parseSwap,
  markStaleBuys,
  activeFollowRows,
  mirrorNewSwaps,
  copyWebhookStatus,
  copyWebhookProvision,
} from "./_mcp-copy-engine.js";

// Re-exported so the tick's staleness contract is testable at the tick module.
export { markStaleBuys };

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Fatal-ish codes carried for consistency with the limit system. Copy ticks skip
// gracefully (never burn attempts), so this set is mostly documentary.
export const FATAL_COPY = new Set(["no_balance", "no_wallet", "bad_mint", "size", "need_size"]);

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
  const rows = await activeFollowRows(client, gate.userId, true);
  const existing = rows.find((r) => r.meta.followedWallet === wallet);
  const now = new Date().toISOString();
  if (existing) {
    // Upsert: update params in place, keep follow history (seenSigs / fills).
    // Never clobber a "filling" claim — preserve the in-flight status so the
    // mirroring tick's resolve isn't orphaned (that would re-mirror on reap).
    const merged = {
      ...(existing.meta || {}),
      label,
      mode,
      sizeValue,
      maxPerTradeUsd,
      status: existing.meta?.status === FILL_STATUS ? FILL_STATUS : "active",
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
      theirTrades: [],
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
  const rows = await activeFollowRows(client, gate.userId, true);
  const target = rows.find((r) => r.meta.followedWallet === wallet);
  if (!target) return { ok: false, error: "not_found", message: "No active follow for that wallet." };
  // Cancelling wins over an in-flight mirror: the tick's guarded resolve
  // won't clobber this, and a cancelled row is never reaped for re-mirroring.
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
        theirTrades: (m.theirTrades || []).length,
        createdAt: m.createdAt || null,
        lastCheckAt: m.lastCheckAt || null,
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* webhook provision/status (MCP tool — same impl as the HTTP admin)   */
/* ------------------------------------------------------------------ */

export async function appCopyProvision(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const action = String(args.action || "status").trim().toLowerCase();
  if (action === "provision") return copyWebhookProvision();
  return copyWebhookStatus();
}

/* ------------------------------------------------------------------ */
/* tick                                                               */
/* ------------------------------------------------------------------ */

export async function tickUserCopy(userId, ctx = {}) {
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const rows = await activeFollowRows(client, userId);
  const mirrors = [];
  let checked = 0;
  let truncated = false;
  const deadlineMs = Number(ctx?.deadlineMs || 0);
  for (const row of rows) {
    if (deadlineMs && Date.now() > deadlineMs) { truncated = true; break; }
    try {
      const res = await tickOneFollow(userId, row, client, mirrors, ctx);
      if (res === "ok") checked += 1;
    } catch (e) {
      // One bad follow never stops others.
      mirrors.push({ follow: row.meta?.followedWallet || null, ok: false, error: "follow_threw", message: e?.message || String(e) });
    }
  }
  if (checked === 0 && rows.length > 0 && !truncated) {
    return { ok: true, checked: 0, note: "history_unavailable", mirrors };
  }
  return { ok: true, checked, mirrors, ...(truncated ? { truncated: true } : {}) };
}

async function tickOneFollow(userId, row, client, mirrors, ctx = {}) {
  const meta = row.meta || {};
  const wallet = meta.followedWallet;

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
  // Staleness guard: flag buys the leader already exited (sold the same
  // mint in a newer swap) so the mirror never buys what was already dumped.
  markStaleBuys(swaps);
  const todo = swaps.slice(0, NEW_SWAPS_PER_TICK);

  // Shared claim+mirror path with the instant webhook (same seenSigs marking,
  // same fill mutex, same meta writeback) — the tick stays the fallback and
  // the reconciliation pass even with the webhook live.
  const res = await mirrorNewSwaps(userId, row, client, todo, ctx);
  mirrors.push(...res.mirrors);
  return res.status;
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
  {
    name: "orbitx_app_copy_provision",
    description:
      "Check or register the instant Helius webhook that pushes the followed wallets' swaps here seconds after they confirm (the 5-min tick stays the fallback). action=status: show the registered webhook, watched wallets, and whether the webhook secret is configured. action=provision: create (or update) the Helius enhanced webhook for all actively-followed wallets. Refuses to provision unless COPY_HOOK_SECRET is set server-side. Uses the server-side Helius key — never exposed.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["status", "provision"] },
        authCode,
      },
    },
  },
];

export function dispatchCopyTools(name, args, auth) {
  if (name === "orbitx_app_copy_follow") return appCopyFollow(auth, args || {});
  if (name === "orbitx_app_copy_unfollow") return appCopyUnfollow(auth, args || {});
  if (name === "orbitx_app_copy_list") return appCopyList(auth);
  if (name === "orbitx_app_copy_provision") return appCopyProvision(auth, args || {});
  return null;
}
