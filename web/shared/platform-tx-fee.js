/**
 * Canonical OrbitX platform transaction fee.
 *
 * platform_fee = min(transaction_value_usd × 0.012, $10)
 *
 * Backend/on-chain builders MUST use this module. The client may preview
 * the same numbers but never decides the charged fee.
 *
 * Definitions:
 * - transaction_value_usd: notional USD of the user swap/buy (SOL×spot or quoted USD).
 * - fee_usd: amount routed to PLATFORM_FEE_WALLET for later OrbitX buy-and-burn.
 * - capApplied: true when the raw 1.2% exceeded $10.
 */
export const PLATFORM_TX_FEE_BPS = 120;
export const PLATFORM_TX_FEE_RATE = 0.012;
export const PLATFORM_TX_FEE_CAP_USD = 10;
export const PLATFORM_TX_FEE_WALLET = "45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE";

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function computePlatformTxFee({ valueUsd, valueSol, solUsd } = {}) {
  let usd = num(valueUsd, NaN);
  const sol = num(valueSol, NaN);
  const px = num(solUsd, 0);
  if (!Number.isFinite(usd) && Number.isFinite(sol) && px > 0) usd = sol * px;
  if (!Number.isFinite(usd) || usd <= 0) {
    return {
      ok: true,
      valueUsd: 0,
      valueSol: Number.isFinite(sol) ? sol : 0,
      solUsd: px,
      rateBps: PLATFORM_TX_FEE_BPS,
      capUsd: PLATFORM_TX_FEE_CAP_USD,
      feeUsd: 0,
      feeSol: 0,
      feeLamports: 0,
      capApplied: false,
      feeBpsEffective: 0,
      wallet: PLATFORM_TX_FEE_WALLET,
    };
  }
  const raw = usd * PLATFORM_TX_FEE_RATE;
  const capApplied = raw > PLATFORM_TX_FEE_CAP_USD + 1e-12;
  const feeUsd = capApplied ? PLATFORM_TX_FEE_CAP_USD : Number(raw.toFixed(8));
  const feeSol = px > 0 ? feeUsd / px : 0;
  const feeLamports = feeSol > 0 ? Math.max(0, Math.floor(feeSol * 1e9)) : 0;
  return {
    ok: true,
    valueUsd: Number(usd.toFixed(8)),
    valueSol: Number.isFinite(sol) ? sol : px > 0 ? usd / px : 0,
    solUsd: px,
    rateBps: PLATFORM_TX_FEE_BPS,
    capUsd: PLATFORM_TX_FEE_CAP_USD,
    feeUsd,
    feeSol,
    feeLamports,
    capApplied,
    feeBpsEffective: usd > 0 ? Math.round((feeUsd / usd) * 10_000) : 0,
    wallet: PLATFORM_TX_FEE_WALLET,
  };
}

/** SOL-in trade: subtract fee lamports from the swap amount. */
export function applyPlatformFeeToSolAmount(amountSol, fee) {
  const lamportsIn = Math.floor(num(amountSol) * 1e9);
  const feeLamports = Math.max(0, Math.floor(num(fee?.feeLamports)));
  if (!Number.isFinite(lamportsIn) || lamportsIn <= 0) {
    return { tradeSol: num(amountSol), tradeLamports: 0, feeLamports: 0 };
  }
  const tradeLamports = Math.max(0, lamportsIn - feeLamports);
  return {
    tradeSol: tradeLamports / 1e9,
    tradeLamports,
    feeLamports,
  };
}

const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_USD_CACHE = { v: 0, t: 0 };

export async function fetchSolUsdPrice(fetcher = fetch) {
  if (Date.now() - SOL_USD_CACHE.t < 30_000 && SOL_USD_CACHE.v > 0) return SOL_USD_CACHE.v;
  try {
    const r = await fetcher(`https://api.jup.ag/price/v2?ids=${SOL_MINT}`);
    const j = await r.json();
    const px = Number(j?.data?.[SOL_MINT]?.price);
    if (px > 0) {
      SOL_USD_CACHE.v = px;
      SOL_USD_CACHE.t = Date.now();
      return px;
    }
  } catch {
    /* keep cache */
  }
  return SOL_USD_CACHE.v || 0;
}

export async function quotePlatformTxFee({ amountSol, valueUsd } = {}) {
  const solUsd = await fetchSolUsdPrice();
  return computePlatformTxFee({ valueUsd, valueSol: amountSol, solUsd });
}
