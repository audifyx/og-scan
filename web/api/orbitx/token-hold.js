/**
 * Agent MCP token-hold gate — $10 ORBITX (or exempt wallet / owner email).
 * Used by orbitx-hub agent routes + MCP tools/call.
 *
 * Exempt list: web/shared/token-gate-exempt.js (single source of truth).
 */

import {
  TOKEN_GATE_EXEMPT_EMAILS_BASE,
  TOKEN_GATE_EXEMPT_WALLETS_BASE,
  canonicalizeExemptWallet,
  isExemptEmailInList,
  isExemptWalletInList,
  walletFromSiwsEmail,
} from "../../shared/token-gate-exempt.js";

export const AGENT_HOLD_MINT =
  process.env.AGENT_GATE_MINT || "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

export const AGENT_HOLD_MIN_USD = Number(process.env.AGENT_GATE_MIN_USD) || 10;

export { TOKEN_GATE_EXEMPT_WALLETS_BASE, TOKEN_GATE_EXEMPT_EMAILS_BASE, canonicalizeExemptWallet };

function parseCsvEnv(...keys) {
  const out = [];
  for (const key of keys) {
    const raw = process.env[key];
    if (!raw) continue;
    for (const part of String(raw).split(",")) {
      const s = part.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

/** Base + AGENT_GATE_EXEMPT_WALLETS / OWNER_WALLETS / VITE_OWNER_WALLETS env extras. */
export const TOKEN_GATE_EXEMPT_WALLETS = [
  ...TOKEN_GATE_EXEMPT_WALLETS_BASE,
  ...parseCsvEnv("AGENT_GATE_EXEMPT_WALLETS", "OWNER_WALLETS", "VITE_OWNER_WALLETS"),
].filter((w, i, arr) => arr.indexOf(w) === i);

export const TOKEN_GATE_EXEMPT_EMAILS = [
  ...TOKEN_GATE_EXEMPT_EMAILS_BASE,
  ...parseCsvEnv("AGENT_GATE_EXEMPT_EMAILS", "OWNER_EMAILS").map((e) => e.toLowerCase()),
].filter((e, i, arr) => arr.indexOf(e) === i);

export function isTokenGateExemptWallet(wallet) {
  return isExemptWalletInList(wallet, TOKEN_GATE_EXEMPT_WALLETS);
}

export function isTokenGateExemptEmail(email) {
  return isExemptEmailInList(email, TOKEN_GATE_EXEMPT_EMAILS, TOKEN_GATE_EXEMPT_WALLETS);
}

export function isTokenGateExempt({ wallet, email } = {}) {
  return isTokenGateExemptWallet(wallet) || isTokenGateExemptEmail(email);
}

/** True if any candidate wallet or email is owner/exempt. */
export function isTokenGateExemptAny({ wallets = [], email } = {}) {
  if (isTokenGateExemptEmail(email)) return true;
  for (const w of wallets) {
    if (isTokenGateExemptWallet(w)) return true;
  }
  // SIWS email may be the only identity; also try wallet extracted from it.
  const fromEmail = walletFromSiwsEmail(email, TOKEN_GATE_EXEMPT_WALLETS);
  if (fromEmail && isTokenGateExemptWallet(fromEmail)) return true;
  return false;
}

/** Prefer canonical allowlist spelling before writing wallet_address. */
export function normalizeGateWallet(wallet) {
  const raw = String(wallet || "").trim();
  if (!raw) return "";
  return canonicalizeExemptWallet(raw, TOKEN_GATE_EXEMPT_WALLETS) || raw;
}

export function holdBlockedPayload(extra = {}) {
  return {
    ok: false,
    error: "token_hold_required",
    mint: AGENT_HOLD_MINT,
    minUsd: AGENT_HOLD_MIN_USD,
    holdUrl: `https://orbitx.world/ORBITX_DEX/token/${AGENT_HOLD_MINT}`,
    buyUrl: `https://jup.ag/swap/SOL-${AGENT_HOLD_MINT}`,
    agentUrl: "https://orbitx.world/agent",
    message: `Hold at least $${AGENT_HOLD_MIN_USD} of ORBITX to use Agent MCP. Buy on Jupiter, then verify at /agent.`,
    ...extra,
  };
}

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "OrbitX-Agent-Hold/1.0" },
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: r.ok, status: r.status, data };
}

async function priceUsd(base, mint) {
  const local = await fetchJson(
    `${base}/api/ogdex/token?mint=${encodeURIComponent(mint)}&chain=solana`,
  );
  const p = Number(local.data?.token?.priceUsd ?? local.data?.priceUsd);
  if (Number.isFinite(p) && p > 0) return p;

  const jup = await fetchJson(`https://api.jup.ag/price/v2?ids=${encodeURIComponent(mint)}`);
  const jp = Number(jup.data?.data?.[mint]?.price);
  if (Number.isFinite(jp) && jp > 0) return jp;
  return null;
}

async function tokenUiAmount(base, wallet, mint) {
  const bal = await fetchJson(
    `${base}/api/ogdex/balance?owner=${encodeURIComponent(wallet)}&mint=${encodeURIComponent(mint)}`,
  );
  const ui = Number(bal.data?.token?.uiAmount);
  return Number.isFinite(ui) ? ui : 0;
}

/**
 * @returns {{
 *   ok: boolean,
 *   meetsRequirement: boolean,
 *   exempt?: boolean,
 *   wallet: string | null,
 *   mint: string,
 *   minUsd: number,
 *   holdingAmount: number,
 *   priceUsd: number | null,
 *   holdingUsd: number,
 *   holdUrl: string,
 *   buyUrl: string,
 *   error?: string,
 *   message?: string,
 * }}
 */
export async function verifyTokenHold(wallet, base = "https://orbitx.world", opts = {}) {
  const pk = normalizeGateWallet(wallet);
  const email = String(opts.email || "").trim();
  const mint = AGENT_HOLD_MINT;
  const minUsd = AGENT_HOLD_MIN_USD;
  const holdUrl = `https://orbitx.world/ORBITX_DEX/token/${mint}`;
  const buyUrl = `https://jup.ag/swap/SOL-${mint}`;

  if (isTokenGateExempt({ wallet: pk, email })) {
    return {
      ok: true,
      meetsRequirement: true,
      exempt: true,
      wallet: pk || walletFromSiwsEmail(email, TOKEN_GATE_EXEMPT_WALLETS) || null,
      mint,
      minUsd,
      holdingAmount: 0,
      priceUsd: null,
      holdingUsd: 0,
      holdUrl,
      buyUrl,
      message: "Owner/DEF exempt — hold requirement skipped.",
    };
  }

  if (!pk || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pk)) {
    return {
      ok: false,
      meetsRequirement: false,
      wallet: pk || null,
      mint,
      minUsd,
      holdingAmount: 0,
      priceUsd: null,
      holdingUsd: 0,
      holdUrl,
      buyUrl,
      error: "wallet_required",
      message: "Connect and link a Solana wallet on https://orbitx.world/agent, then verify ORBITX holdings.",
    };
  }

  try {
    const [amount, price] = await Promise.all([tokenUiAmount(base, pk, mint), priceUsd(base, mint)]);
    const holdingUsd = price != null ? amount * price : 0;
    const meets = price != null ? holdingUsd >= minUsd : amount > 0 && minUsd <= 0;

    // If price is unavailable but they hold a meaningful amount, allow with caution threshold
    const fallbackMeets = price == null && amount >= 1000;
    const meetsRequirement = meets || fallbackMeets;

    return {
      ok: meetsRequirement,
      meetsRequirement,
      exempt: false,
      wallet: pk,
      mint,
      minUsd,
      holdingAmount: amount,
      priceUsd: price,
      holdingUsd: Number(holdingUsd.toFixed(4)),
      holdUrl,
      buyUrl,
      error: meetsRequirement ? undefined : "token_hold_required",
      message: meetsRequirement
        ? `Hold OK — ~$${holdingUsd.toFixed(2)} ORBITX.`
        : `Need ≥$${minUsd} ORBITX. Current ~$${holdingUsd.toFixed(2)} (${amount.toFixed(2)} tokens). Buy then re-verify.`,
    };
  } catch (e) {
    return {
      ok: false,
      meetsRequirement: false,
      wallet: pk,
      mint,
      minUsd,
      holdingAmount: 0,
      priceUsd: null,
      holdingUsd: 0,
      holdUrl,
      buyUrl,
      error: "hold_check_failed",
      message: e?.message || "Could not verify ORBITX holdings",
    };
  }
}

/** Tools that require the ORBITX hold (everyone except exempt wallets). */
export const HOLD_GATED_TOOLS = new Set([
  "orbitx_execute_launch",
  "orbitx_create_token",
  "orbitx_prepare_launch",
  "orbitx_launch_execution",
  "orbitx_launch_token",
  "orbitx_create_coin",
  "orbitx_launch_ipfs",
  "orbitx_launch_record",
  "orbitx_vanity_mint",
  "orbitx_prepare_buy",
  "orbitx_prepare_sell",
  "orbitx_buy",
  "orbitx_sell",
  "orbitx_buy_auto",
  "orbitx_sell_pump",
  "orbitx_claim_fees",
  "orbitx_rent_refund",
  "orbitx_burn",
  "orbitx_mint_nft",
  "orbitx_social_join",
  "orbitx_social_post",
  "orbitx_social_create_community",
  "orbitx_social_leave",
  "orbitx_nft_prepare_buy",
  "orbitx_nft_submit_buy",
  "orbitx_nft_like",
  "orbitx_nft_comment",
  "orbitx_nft_follow",
  "orbitx_nft_register",
  "orbitx_nft_register_collection",
  "orbitx_nft_make_offer",
  "orbitx_nft_cancel_offer",
  "orbitx_nft_list_for_sale",
  "orbitx_nft_cancel_listing",
  "orbitx_nft_create_auction",
  "orbitx_nft_place_bid",
  "orbitx_nft_favorite",
  "orbitx_create_token_pump",
  "orbitx_create_token_custom",
]);

export function isHoldGatedTool(name) {
  // Media (image/video) is not hold-gated — API keys already require hold to mint.
  if (/^orbitx_(generate_|grok_|gen_|media_)/.test(name)) return false;
  if (HOLD_GATED_TOOLS.has(name)) return true;
  if (/^orbitx_(buy|sell)_/.test(name)) return true;
  if (/^orbitx_create_token_/.test(name)) return true;
  return false;
}
