/**
 * Shared $ORBITX buy prep for Agent MCP + X MCP.
 * Non-custodial: builds unsigned Jupiter swap → user signs in Jupiter Wallet.
 * confirmMode "auto" adds ?auto=1 so the sign page opens Jupiter immediately.
 * Phantom Connect is never used.
 */
import { PLATFORM_TX_FEE_BPS } from "../../shared/platform-tx-fee.js";

export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
export const ORBITX_SYMBOL = "ORBITX";
export const MIN_BUY_SOL = 0.001;
export const MAX_BUY_SOL = 50;
/** Desk / dev wallet — platform fee from x_buy / orbitx_buy_orbitx SOL buys */
export const PLATFORM_FEE_WALLET = "45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE";
export const PLATFORM_FEE_BPS = PLATFORM_TX_FEE_BPS;

export function askBuyOrbitxAmount() {
  return {
    ok: true,
    action: "ask_amount",
    token: ORBITX_SYMBOL,
    mint: ORBITX_MINT,
    message:
      "Ask how much SOL they want to spend on $ORBITX (any amount). Also ask: sign manually, or auto-confirm (open link → Jupiter Wallet prompts). Then call orbitx_buy_orbitx / x_buy_orbitx with amountSol + confirmMode.",
    minSol: MIN_BUY_SOL,
    maxSol: MAX_BUY_SOL,
    confirmModes: {
      sign: "Returns signUrl — user opens and taps Sign & send in Jupiter",
      auto: "Returns autoSignUrl — opening the link auto-prompts Jupiter Wallet (chat auto-confirm)",
    },
    examples: [
      "buy 0.1 SOL of $ORBITX",
      "auto buy 0.5 SOL ORBITX",
      "yes / confirm → orbitx_confirm_buy with the same amountSol",
    ],
  };
}

export function normalizeConfirmMode(raw, { preferAuto = false } = {}) {
  const s = String(raw || "").trim().toLowerCase();
  if (["auto", "automatic", "autoconfirm", "auto_confirm", "chat", "yes"].includes(s)) return "auto";
  if (["sign", "manual", "phantom", "link"].includes(s)) return "sign";
  if (preferAuto) return "auto";
  return "sign";
}

const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_USD_CACHE = { v: 0, t: 0 };

export async function fetchSolUsdPrice() {
  if (Date.now() - SOL_USD_CACHE.t < 60_000 && SOL_USD_CACHE.v > 0) return SOL_USD_CACHE.v;
  try {
    const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`);
    const d = await r.json();
    const px = Number(d?.[SOL_MINT]?.usdPrice) || 0;
    if (px > 0) {
      SOL_USD_CACHE.v = px;
      SOL_USD_CACHE.t = Date.now();
      return px;
    }
  } catch {
    /* try coingecko */
  }
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
    const d = await r.json();
    const px = Number(d?.solana?.usd) || 0;
    if (px > 0) {
      SOL_USD_CACHE.v = px;
      SOL_USD_CACHE.t = Date.now();
      return px;
    }
  } catch {
    /* ignore */
  }
  return SOL_USD_CACHE.v || 0;
}

/** Convert a USD/USDC spend into SOL for /api/ogdex/trade (SOL-denominated buys). */
export async function usdToSol(amountUsd) {
  const usd = Number(amountUsd);
  if (!Number.isFinite(usd) || usd <= 0) {
    return { ok: false, error: "invalid_usd", message: "amountUsd must be a positive number" };
  }
  const px = await fetchSolUsdPrice();
  if (!px) {
    return {
      ok: false,
      error: "sol_price_unavailable",
      message: "Could not quote SOL/USD. Retry with an amount in SOL (e.g. 0.1 SOL).",
    };
  }
  return { ok: true, amountSol: usd / px, solUsd: px, amountUsd: usd };
}

export function parseBuySol(amountSol) {
  const n = Number(amountSol);
  if (!Number.isFinite(n)) {
    return { ok: false, error: "invalid_amount", message: "amountSol must be a number (SOL)" };
  }
  if (n < MIN_BUY_SOL) {
    return { ok: false, error: "amount_too_low", message: `Minimum buy is ${MIN_BUY_SOL} SOL`, minSol: MIN_BUY_SOL };
  }
  if (n > MAX_BUY_SOL) {
    return { ok: false, error: "amount_too_high", message: `Maximum buy is ${MAX_BUY_SOL} SOL`, maxSol: MAX_BUY_SOL };
  }
  return { ok: true, amountSol: n };
}

/**
 * @param {{ base: string, wallet: string, amountSol: number, slippage?: number, pool?: string, confirmMode?: string, preferAuto?: boolean, fetchJson: Function }} opts
 */
export async function prepareBuyOrbitx(opts) {
  const {
    base,
    wallet,
    amountSol,
    slippage = 10,
    pool = "auto",
    confirmMode,
    preferAuto = false,
    fetchJson,
  } = opts;

  const pk = String(wallet || "").trim();
  if (!pk || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pk)) {
    return {
      ok: false,
      error: "wallet_required",
      mint: ORBITX_MINT,
      token: ORBITX_SYMBOL,
      message: "Link Jupiter Wallet on https://www.orbitx.world/telegram after /login, then send /buy again.",
      loginUrl: "https://www.orbitx.world/telegram",
      fixUrl: "https://www.orbitx.world/telegram",
    };
  }

  const parsed = parseBuySol(amountSol);
  if (!parsed.ok) return parsed;

  const mode = normalizeConfirmMode(confirmMode, { preferAuto });
  const slip = Math.min(Math.max(Number(slippage) || 10, 1), 50);
  const poolVal = String(pool || "auto");

  let data;
  try {
    data = await fetchJson(`${base}/api/ogdex/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: pk,
        action: "buy",
        mint: ORBITX_MINT,
        amount: parsed.amountSol,
        denominatedInSol: true,
        slippage: slip,
        pool: poolVal,
        platformFee: true,
      }),
    });
  } catch (e) {
    return {
      ok: false,
      status: "prepare_failed",
      error: e?.message || "Could not build $ORBITX buy",
      mint: ORBITX_MINT,
      amountSol: parsed.amountSol,
      wallet: pk,
    };
  }

  if (!data?.ok || !data?.tx) {
    return {
      ok: false,
      status: "prepare_failed",
      requiresSignature: false,
      error: data?.error || "Could not build $ORBITX buy",
      mint: ORBITX_MINT,
      amountSol: parsed.amountSol,
      wallet: pk,
    };
  }

  const platformFee = data.platformFee || {
    enabled: true,
    bps: PLATFORM_FEE_BPS,
    wallet: PLATFORM_FEE_WALLET,
  };

  const qs = new URLSearchParams({
    action: "buy",
    mint: ORBITX_MINT,
    amount: String(parsed.amountSol),
    publicKey: pk,
    slippage: String(slip),
    pool: poolVal,
  });
  const signUrl = `${base}/agent/sign?${qs.toString()}`;
  const autoQs = new URLSearchParams(qs);
  autoQs.set("auto", "1");
  const autoSignUrl = `${base}/agent/sign?${autoQs.toString()}`;
  const primaryUrl = mode === "auto" ? autoSignUrl : signUrl;

  return {
    ok: true,
    status: mode === "auto" ? "awaiting_auto_jupiter" : "awaiting_jupiter_signature",
    requiresSignature: true,
    confirmMode: mode,
    token: ORBITX_SYMBOL,
    mint: ORBITX_MINT,
    amountSol: parsed.amountSol,
    wallet: pk,
    slippage: slip,
    pool: poolVal,
    via: data.via || null,
    routePool: data.pool || null,
    platformFee,
    feeWallet: PLATFORM_FEE_WALLET,
    signUrl,
    autoSignUrl,
    openUrl: primaryUrl,
    hasUnsignedTx: true,
    hasFeeTx: Boolean(data.feeTx),
    solscanToken: `https://solscan.io/token/${ORBITX_MINT}`,
    solscanAccount: `https://solscan.io/account/${pk}`,
    instructions:
      mode === "auto"
        ? [
            "Send the user the openUrl / autoSignUrl as a clickable link.",
            "Opening it connects Jupiter Wallet and prompts Sign automatically (chat auto-confirm).",
            `1.2% (max $10) platform fee SOL routes to desk wallet ${PLATFORM_FEE_WALLET}.`,
            "If they prefer a button first, use signUrl instead.",
            "Trade is incomplete until Jupiter confirms.",
          ]
        : [
            "Send the user the signUrl as a clickable link.",
            "They connect Jupiter Wallet and tap Sign & send.",
            `1.2% (max $10) platform fee SOL routes to desk wallet ${PLATFORM_FEE_WALLET}.`,
            "If they say yes / confirm / auto — call orbitx_confirm_buy (or x_confirm_buy) with the same amountSol for auto Jupiter prompt.",
            "Do NOT broadcast unsigned transactions yourself.",
          ],
    note:
      mode === "auto"
        ? `Chat auto-confirm: open autoSignUrl → Jupiter Wallet prompts. Platform fee (1.2% (max $10) SOL) → ${PLATFORM_FEE_WALLET}.`
        : `Manual sign: open signUrl. Platform fee (1.2% (max $10) SOL) → ${PLATFORM_FEE_WALLET}.`,
    jupiter: `https://jup.ag/swap/SOL-${ORBITX_MINT}`,
    dex: `https://www.orbitx.world/ORBITX_DEX/token/${ORBITX_MINT}`,
  };
}

/** Persist pending intent so “yes / confirm” in chat can reopen auto sign. */
export async function saveTradeIntent(sb, userId, payload) {
  if (!userId || typeof sb !== "function") return null;
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  try {
    // Expire older pending for this user+mint
    await sb(
      `agent_trade_intents?user_id=eq.${encodeURIComponent(userId)}&mint=eq.${encodeURIComponent(payload.mint)}&status=eq.pending`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
        headers: { Prefer: "return=minimal" },
      },
    );
  } catch {
    /* ignore */
  }
  try {
    const rows = await sb("agent_trade_intents", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        mint: payload.mint,
        amount_sol: payload.amountSol,
        confirm_mode: payload.confirmMode || "sign",
        slippage: payload.slippage || 10,
        pool: payload.pool || "auto",
        status: "pending",
        expires_at: expires,
        meta: { token: ORBITX_SYMBOL },
      }),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  } catch {
    return null;
  }
}

export async function loadLatestTradeIntent(sb, userId, { mint } = {}) {
  if (!userId || typeof sb !== "function") return null;
  try {
    const mintQ = mint ? `&mint=eq.${encodeURIComponent(mint)}` : "";
    const rows = await sb(
      `agent_trade_intents?user_id=eq.${encodeURIComponent(userId)}${mintQ}&status=eq.pending&order=created_at.desc&limit=1`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      try {
        await sb(`agent_trade_intents?id=eq.${encodeURIComponent(row.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "expired" }),
          headers: { Prefer: "return=minimal" },
        });
      } catch {
        /* ignore */
      }
      return null;
    }
    return row;
  } catch {
    return null;
  }
}

export async function getChatTradeAuto(sb, agentId) {
  if (!agentId || typeof sb !== "function") return false;
  try {
    const rows = await sb(
      `agent_settings?agent_id=eq.${encodeURIComponent(agentId)}&select=chat_trade_auto&limit=1`,
    );
    return Boolean(Array.isArray(rows) && rows[0]?.chat_trade_auto);
  } catch {
    return false;
  }
}

export async function setChatTradeAuto(sb, agentId, enabled) {
  if (!agentId || typeof sb !== "function") return false;
  const on = Boolean(enabled);
  try {
    await sb(`agent_settings?agent_id=eq.${encodeURIComponent(agentId)}`, {
      method: "PATCH",
      body: JSON.stringify({ chat_trade_auto: on }),
      headers: { Prefer: "return=minimal" },
    });
    return true;
  } catch {
    return false;
  }
}
