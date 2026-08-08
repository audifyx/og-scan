/**
 * Shared $ORBITX buy prep for Agent MCP + X MCP.
 * Non-custodial: builds unsigned Jupiter/Pump trade → user signs in Phantom.
 * confirmMode "auto" adds ?auto=1 so the sign page opens Phantom immediately.
 */

export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
export const ORBITX_SYMBOL = "ORBITX";
export const MIN_BUY_SOL = 0.001;
export const MAX_BUY_SOL = 50;

export function askBuyOrbitxAmount() {
  return {
    ok: true,
    action: "ask_amount",
    token: ORBITX_SYMBOL,
    mint: ORBITX_MINT,
    message:
      "Ask how much SOL they want to spend on $ORBITX (any amount). Also ask: sign manually, or auto-confirm (open link → Phantom pops immediately). Then call orbitx_buy_orbitx / x_buy_orbitx with amountSol + confirmMode.",
    minSol: MIN_BUY_SOL,
    maxSol: MAX_BUY_SOL,
    confirmModes: {
      sign: "Returns signUrl — user opens and taps Sign & send",
      auto: "Returns autoSignUrl — opening the link auto-prompts Phantom (chat auto-confirm)",
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
      message: "Link a Solana wallet on https://www.orbitx.world/agent (or pass publicKey).",
      fixUrl: "https://www.orbitx.world/agent",
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
    status: mode === "auto" ? "awaiting_auto_phantom" : "awaiting_phantom_signature",
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
    signUrl,
    autoSignUrl,
    openUrl: primaryUrl,
    hasUnsignedTx: true,
    instructions:
      mode === "auto"
        ? [
            "Send the user the openUrl / autoSignUrl as a clickable link.",
            "Opening it connects Phantom and prompts Sign automatically (chat auto-confirm).",
            "If they prefer a button first, use signUrl instead.",
            "Trade is incomplete until Phantom confirms.",
          ]
        : [
            "Send the user the signUrl as a clickable link.",
            "They connect Phantom and tap Sign & send.",
            "If they say yes / confirm / auto — call orbitx_confirm_buy (or x_confirm_buy) with the same amountSol for auto Phantom prompt.",
            "Do NOT broadcast unsigned transactions yourself.",
          ],
    note:
      mode === "auto"
        ? "Chat auto-confirm: open autoSignUrl → Phantom pops. Still non-custodial — user must approve in wallet."
        : "Manual sign: open signUrl. Say “confirm” or “auto” in chat to switch to auto Phantom prompt.",
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

export async function loadLatestTradeIntent(sb, userId, { mint = ORBITX_MINT } = {}) {
  if (!userId || typeof sb !== "function") return null;
  try {
    const rows = await sb(
      `agent_trade_intents?user_id=eq.${encodeURIComponent(userId)}&mint=eq.${encodeURIComponent(mint)}&status=eq.pending&order=created_at.desc&limit=1`,
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
