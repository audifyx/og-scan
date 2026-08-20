/**
 * Launch MCP gate for Telegram, Claude/Grok MCP, and OrbitX AI (/ai).
 *
 * First 25 unique identities that send the phrase "Orbitx mcp" get unlimited
 * free access forever. After that, buy $ORBITX then burn 500 and paste a
 * Solscan tx link for verification.
 */

import { ORBITX_BURN_MINT, prepareAccessBurn, verifyOrbitxBurn } from "./mcp-burn-access.js";
import { isTokenGateExemptAny, normalizeGateWallet } from "./token-hold.js";

export const MCP_LAUNCH_CODE = "Orbitx mcp";
export const MCP_LAUNCH_FREE_SLOTS = 25;
export const MCP_LAUNCH_BURN_TOKENS = 500;
export const MCP_LAUNCH_X = "https://x.com/orbitx_wrld";
export const MCP_LAUNCH_BUY_URL = `https://jup.ag/swap/SOL-${ORBITX_BURN_MINT}`;
export const MCP_LAUNCH_DEX = `https://www.orbitx.world/ORBITX_DEX/token/${ORBITX_BURN_MINT}`;
export const MCP_LAUNCH_MINT = ORBITX_BURN_MINT;

const SIG_RE = /(?:https?:\/\/)?(?:www\.)?solscan\.io\/(?:tx|transaction)\/([1-9A-HJ-NP-Za-km-z]{64,128})/i;
const BARE_SIG_RE = /\b([1-9A-HJ-NP-Za-km-z]{86,88})\b/;

export function normalizeLaunchCode(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/[.,!?;:]+$/g, "")
    .replace(/['"]/g, "")
    .replace(/\s+/g, " ");
}

export function isLaunchCode(text) {
  const n = normalizeLaunchCode(text);
  return n === "orbitx mcp" || n === "orbitxmcp" || n === "orbitx-mcp";
}

export function extractSolscanSignature(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const fromUrl = raw.match(SIG_RE);
  if (fromUrl?.[1]) return fromUrl[1];
  if (/solscan\.io/i.test(raw)) return "";
  const bare = raw.match(BARE_SIG_RE);
  return bare?.[1] || "";
}

export function launchGateMessage({ remainingFree = 0 } = {}) {
  const freeLine =
    remainingFree > 0
      ? `First ${MCP_LAUNCH_FREE_SLOTS} people unlock forever with the code. ${remainingFree} free slot${remainingFree === 1 ? "" : "s"} left.`
      : `The ${MCP_LAUNCH_FREE_SLOTS} free codes are claimed. Buy $ORBITX, burn 500, then send the Solscan tx link.`;
  return [
    "Please send the authorization code to gain access or get access right away by burning 500 $ORBITX.",
    "",
    `Code (first ${MCP_LAUNCH_FREE_SLOTS}): ${MCP_LAUNCH_CODE}`,
    freeLine,
    `Burn 500 $ORBITX then paste https://solscan.io/tx/<signature> here.`,
    `Buy: ${MCP_LAUNCH_BUY_URL}`,
    `If you have trouble, DM us on X and we will get it fixed: ${MCP_LAUNCH_X}`,
  ].join("\n");
}

export function launchGateHtml(status = {}) {
  const remaining = Number(status.remainingFree || 0);
  const freeLine =
    remaining > 0
      ? `First <b>${MCP_LAUNCH_FREE_SLOTS}</b> people unlock forever with the code. <b>${remaining}</b> free slot${remaining === 1 ? "" : "s"} left.`
      : `The <b>${MCP_LAUNCH_FREE_SLOTS}</b> free codes are claimed. Buy $ORBITX, burn <b>500</b>, then send the Solscan tx link.`;
  return [
    "🔐 <b>OrbitX MCP locked</b>",
    "Please send the authorization code to gain access or get access right away by burning 500 $ORBITX.",
    "",
    `Code (first ${MCP_LAUNCH_FREE_SLOTS}): <code>${MCP_LAUNCH_CODE}</code>`,
    freeLine,
    `Burn 500 $ORBITX → paste the <a href="https://solscan.io">Solscan</a> tx link.`,
    `<a href="${MCP_LAUNCH_BUY_URL}">Buy $ORBITX</a> · <a href="${MCP_LAUNCH_DEX}">OrbitX DEX</a>`,
    `Trouble? DM us on X <a href="${MCP_LAUNCH_X}">@orbitx_wrld</a> and we will get it fixed.`,
  ].join("\n");
}

export function launchGatePayload(extra = {}) {
  const remainingFree = extra.remainingFree ?? 0;
  return {
    ok: false,
    error: "mcp_launch_gate",
    locked: true,
    code: MCP_LAUNCH_CODE,
    freeSlots: MCP_LAUNCH_FREE_SLOTS,
    remainingFree,
    burnTokens: MCP_LAUNCH_BURN_TOKENS,
    mint: MCP_LAUNCH_MINT,
    buyUrl: MCP_LAUNCH_BUY_URL,
    dexUrl: MCP_LAUNCH_DEX,
    xUrl: MCP_LAUNCH_X,
    tool: "orbitx_mcp_unlock",
    message: launchGateMessage({ remainingFree }),
    ...extra,
  };
}

export function launchGateInlineKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "Buy $ORBITX", url: MCP_LAUNCH_BUY_URL },
        { text: "OrbitX DEX", url: MCP_LAUNCH_DEX },
      ],
      [{ text: "Trouble? DM us on X", url: MCP_LAUNCH_X }],
    ],
  };
}

export function launchUnlockTelegramHtml(result = {}) {
  if (result.ok) {
    return [
      "✅ <b>OrbitX MCP unlocked forever</b>",
      result.message || "You now have unlimited access on this account.",
    ].join("\n");
  }
  if (result.error === "promo_sold_out") {
    return [
      "🔐 <b>The 25 free codes are claimed</b>",
      "Buy $ORBITX, burn <b>500</b>, then send the Solscan tx link to unlock forever.",
      `<a href="${MCP_LAUNCH_BUY_URL}">Buy $ORBITX</a> · Trouble? DM <a href="${MCP_LAUNCH_X}">@orbitx_wrld</a>`,
    ].join("\n");
  }
  const detail = result.message || "Could not verify that unlock.";
  return [
    `⚠️ ${detail}`,
    "",
    launchGateHtml({ remainingFree: result.remainingFree || 0 }),
  ].join("\n");
}

/** Tools Claude/Grok may call while MCP is still locked. */
export const LAUNCH_UNLOCK_PUBLIC_TOOLS = new Set([
  "orbitx_mcp_unlock",
  "orbitx_auth_link",
  "orbitx_auth_status",
]);

export function isLaunchUnlockPublicTool(name) {
  return LAUNCH_UNLOCK_PUBLIC_TOOLS.has(String(name || "").trim());
}

function isSchemaMissing(e) {
  return /relation|does not exist|42P01|mcp_launch_unlocks/i.test(String(e?.message || e?.code || e));
}

function identitiesFrom(input = {}) {
  return {
    telegramUserId: input.telegramUserId ? String(input.telegramUserId).trim() : "",
    userId: input.userId ? String(input.userId).trim() : "",
    wallet: normalizeGateWallet(input.wallet || input.walletAddress || input.publicKey || ""),
    mcpSessionId: input.mcpSessionId ? String(input.mcpSessionId).trim() : "",
    email: input.email || null,
  };
}

export function collectUnlockProbe(args = {}, extraText = "") {
  const bags = [
    extraText,
    args.code,
    args.authCode,
    args.phrase,
    args.query,
    args.text,
    args.message,
    args.prompt,
    args.solscan,
    args.signature,
    args.txSignature,
    args.tx,
  ];
  return bags.map((v) => (v == null ? "" : String(v))).filter(Boolean).join("\n");
}

async function loadUnlockRows(sb, ids) {
  const rows = [];
  const tryGet = async (query) => {
    try {
      const found = await sb(query);
      if (Array.isArray(found)) rows.push(...found.filter(Boolean));
    } catch (e) {
      if (!isSchemaMissing(e)) throw e;
      const err = new Error("schema_missing");
      err.schemaMissing = true;
      throw err;
    }
  };
  if (ids.telegramUserId) {
    await tryGet(
      `mcp_launch_unlocks?telegram_user_id=eq.${encodeURIComponent(ids.telegramUserId)}&select=*&limit=1`,
    );
  }
  if (ids.userId) {
    await tryGet(`mcp_launch_unlocks?user_id=eq.${encodeURIComponent(ids.userId)}&select=*&limit=1`);
  }
  if (ids.wallet) {
    await tryGet(
      `mcp_launch_unlocks?wallet_address=eq.${encodeURIComponent(ids.wallet)}&select=*&limit=1`,
    );
  }
  if (ids.mcpSessionId) {
    await tryGet(
      `mcp_launch_unlocks?mcp_session_id=eq.${encodeURIComponent(ids.mcpSessionId)}&select=*&limit=1`,
    );
  }
  return rows[0] || null;
}

export async function countPromoUnlocks(sb) {
  try {
    const rows = await sb(`mcp_launch_unlocks?source=eq.promo_code&select=id`);
    return Array.isArray(rows) ? rows.length : 0;
  } catch (e) {
    if (isSchemaMissing(e)) return 0;
    throw e;
  }
}

export async function remainingFreeSlots(sb) {
  const used = await countPromoUnlocks(sb);
  return Math.max(0, MCP_LAUNCH_FREE_SLOTS - used);
}

export async function getLaunchUnlock(sb, input = {}) {
  const ids = identitiesFrom(input);
  if (isTokenGateExemptAny({ wallets: [ids.wallet], email: ids.email })) {
    return {
      allowed: true,
      source: "exempt",
      remainingFree: await remainingFreeSlots(sb).catch(() => 0),
    };
  }
  if (!ids.telegramUserId && !ids.userId && !ids.wallet && !ids.mcpSessionId) {
    return {
      allowed: false,
      remainingFree: await remainingFreeSlots(sb).catch(() => 0),
    };
  }
  try {
    const row = await loadUnlockRows(sb, ids);
    if (row) {
      return {
        allowed: true,
        source: row.source,
        unlock: row,
        remainingFree: await remainingFreeSlots(sb),
      };
    }
  } catch (e) {
    if (e?.schemaMissing) {
      return { allowed: false, remainingFree: MCP_LAUNCH_FREE_SLOTS, schemaMissing: true };
    }
    throw e;
  }
  return {
    allowed: false,
    remainingFree: await remainingFreeSlots(sb),
  };
}

function identityBody(ids, extra = {}) {
  return {
    telegram_user_id: ids.telegramUserId || null,
    user_id: ids.userId || null,
    wallet_address: ids.wallet || null,
    mcp_session_id: ids.mcpSessionId || null,
    ...extra,
  };
}

export async function redeemLaunchCode(sb, input = {}) {
  const ids = identitiesFrom(input);
  if (!ids.telegramUserId && !ids.userId && !ids.wallet && !ids.mcpSessionId) {
    return {
      ok: false,
      error: "identity_required",
      message: "Send the code from Telegram, /ai, or a connected MCP session so we can bind forever access.",
    };
  }
  const existing = await getLaunchUnlock(sb, ids);
  if (existing.allowed) {
    return {
      ok: true,
      already: true,
      source: existing.source,
      message: "MCP already unlocked forever on this account.",
    };
  }
  const used = await countPromoUnlocks(sb);
  if (used >= MCP_LAUNCH_FREE_SLOTS) {
    return {
      ok: false,
      error: "promo_sold_out",
      remainingFree: 0,
      message: launchGateMessage({ remainingFree: 0 }),
    };
  }
  const slot = used + 1;
  try {
    const rows = await sb("mcp_launch_unlocks", {
      method: "POST",
      body: JSON.stringify(
        identityBody(ids, {
          source: "promo_code",
          promo_slot: slot,
        }),
      ),
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      ok: true,
      source: "promo_code",
      promoSlot: slot,
      remainingFree: Math.max(0, MCP_LAUNCH_FREE_SLOTS - slot),
      unlock: row,
      message: `MCP unlocked forever. You are free slot ${slot} of ${MCP_LAUNCH_FREE_SLOTS}.`,
    };
  } catch (e) {
    if (isSchemaMissing(e)) {
      return {
        ok: false,
        error: "schema_missing",
        message: "Apply sql/Aug_SQL/12_mcp_launch_unlocks.sql then retry the code.",
      };
    }
    if (/23505|duplicate|unique/i.test(String(e?.message || e?.code || ""))) {
      const again = await getLaunchUnlock(sb, ids);
      if (again.allowed) {
        return {
          ok: true,
          already: true,
          source: again.source,
          message: "MCP already unlocked forever on this account.",
        };
      }
      return {
        ok: false,
        error: "promo_sold_out",
        remainingFree: 0,
        message: launchGateMessage({ remainingFree: 0 }),
      };
    }
    throw e;
  }
}

export async function confirmLaunchBurn(sb, input = {}) {
  const ids = identitiesFrom(input);
  const signature = extractSolscanSignature(input.signature || input.solscan || input.text) || String(input.signature || "").trim();
  const verified = await verifyOrbitxBurn(signature, {
    minTokens: MCP_LAUNCH_BURN_TOKENS,
    wallet: ids.wallet || undefined,
  });
  if (!verified.ok) return verified;
  if (Number(verified.tokensBurned) + 1e-6 < MCP_LAUNCH_BURN_TOKENS) {
    return {
      ok: false,
      error: "amount_too_low",
      tokensBurned: verified.tokensBurned,
      message: `Burned ${verified.tokensBurned} $ORBITX — need ${MCP_LAUNCH_BURN_TOKENS} for forever MCP access.`,
    };
  }

  const existing = await getLaunchUnlock(sb, { ...ids, wallet: verified.wallet || ids.wallet });
  if (existing.allowed) {
    return {
      ok: true,
      already: true,
      source: existing.source,
      signature: verified.signature,
      explorer: verified.explorer,
      message: "This account already has forever MCP access.",
    };
  }

  try {
    const prior = await sb(
      `mcp_launch_unlocks?tx_signature=eq.${encodeURIComponent(verified.signature)}&select=*&limit=1`,
    );
    if (Array.isArray(prior) && prior[0]) {
      return {
        ok: true,
        already: true,
        source: "burn_500",
        signature: verified.signature,
        explorer: verified.explorer,
        message: "This burn already unlocked MCP forever.",
      };
    }
  } catch (e) {
    if (!isSchemaMissing(e)) throw e;
  }

  try {
    const rows = await sb("mcp_launch_unlocks", {
      method: "POST",
      body: JSON.stringify(
        identityBody(
          { ...ids, wallet: verified.wallet || ids.wallet },
          {
            source: "burn_500",
            tx_signature: verified.signature,
          },
        ),
      ),
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      ok: true,
      source: "burn_500",
      signature: verified.signature,
      explorer: verified.explorer,
      tokensBurned: verified.tokensBurned,
      unlock: row,
      message: `Burn verified. MCP unlocked forever. ${verified.explorer}`,
    };
  } catch (e) {
    if (isSchemaMissing(e)) {
      return {
        ok: false,
        error: "schema_missing",
        message: "Apply sql/Aug_SQL/12_mcp_launch_unlocks.sql then resend the Solscan link.",
        explorer: verified.explorer,
      };
    }
    if (/23505|duplicate|unique/i.test(String(e?.message || e?.code || ""))) {
      return {
        ok: true,
        already: true,
        source: "burn_500",
        signature: verified.signature,
        explorer: verified.explorer,
        message: "This burn already unlocked MCP forever.",
      };
    }
    throw e;
  }
}

export async function prepareLaunchBurn({ publicKey }) {
  const out = await prepareAccessBurn({ publicKey, packageId: "day" });
  if (!out?.ok) {
    return {
      ...out,
      tokens: MCP_LAUNCH_BURN_TOKENS,
      label: "MCP forever",
      message: out?.message || "Connect Phantom, buy $ORBITX, then burn 500.",
    };
  }
  const decimals = Number(out.decimals) || 6;
  const amountRaw = BigInt(Math.floor(MCP_LAUNCH_BURN_TOKENS * 10 ** decimals));
  const balanceRaw = BigInt(out.balanceRaw || "0");
  if (amountRaw > balanceRaw) {
    return {
      ok: false,
      error: "insufficient_balance",
      tokens: MCP_LAUNCH_BURN_TOKENS,
      mint: MCP_LAUNCH_MINT,
      buyUrl: MCP_LAUNCH_BUY_URL,
      message: `Need ${MCP_LAUNCH_BURN_TOKENS} $ORBITX in this wallet. Buy first, then burn.`,
    };
  }
  return {
    ...out,
    packageId: "forever",
    label: "MCP forever",
    tokens: MCP_LAUNCH_BURN_TOKENS,
    durationLabel: "forever",
    amountRaw: amountRaw.toString(),
    closesAccount: amountRaw >= balanceRaw,
    note: `Burn ${MCP_LAUNCH_BURN_TOKENS} $ORBITX to unlock MCP forever. After Phantom confirms, paste the Solscan tx link.`,
  };
}

/**
 * If the text/args contain the promo code or a Solscan burn, try to unlock.
 * @returns {{ handled: boolean, granted?: boolean, result?: object }}
 */
export async function tryLaunchUnlockFromText(sb, text, input = {}) {
  const blob = String(text || "").trim();
  if (!blob) return { handled: false };
  if (isLaunchCode(blob)) {
    const result = await redeemLaunchCode(sb, input);
    return { handled: true, granted: Boolean(result.ok), result };
  }
  if (extractSolscanSignature(blob) || /solscan\.io\/tx\//i.test(blob)) {
    const result = await confirmLaunchBurn(sb, { ...input, text: blob, signature: extractSolscanSignature(blob) });
    return { handled: true, granted: Boolean(result.ok), result };
  }
  return { handled: false };
}
