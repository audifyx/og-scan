// OG DEX — Tradeability / honeypot + tax check. Uses Jupiter round-trip quotes
// to answer the #1 trader question: "Can I actually SELL this?" plus an estimate
// of the round-trip cost (tax + price impact). No API key, no custody.
import { jup, send, cache } from "../_lib.js";

const SOL = "So11111111111111111111111111111111111111112";
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

async function quote(inputMint, outputMint, amount, slippageBps = 300) {
  try {
    const q = await jup(`/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`);
    if (!q || q.error || !q.outAmount) return null;
    return q;
  } catch { return null; }
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const mint = url.searchParams.get("mint") || "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return send(res, 400, { ok: false, error: "valid mint required" });
  cache(res, 30, 120);

  try {
    const TEST_SOL = 100_000_000; // 0.1 SOL probe
    const buyQ = await quote(SOL, mint, TEST_SOL);
    const canBuy = !!buyQ;
    let canSell = false, roundTripLossPct = null, sellImpact = null, buyImpact = null;

    if (buyQ) {
      buyImpact = num(buyQ.priceImpactPct) != null ? num(buyQ.priceImpactPct) * 100 : null;
      const tokensOut = buyQ.outAmount;
      const sellQ = await quote(mint, SOL, tokensOut);
      if (sellQ) {
        canSell = true;
        sellImpact = num(sellQ.priceImpactPct) != null ? num(sellQ.priceImpactPct) * 100 : null;
        const solBack = Number(sellQ.outAmount);
        roundTripLossPct = ((TEST_SOL - solBack) / TEST_SOL) * 100; // tax + both-leg impact + fees
      }
    }

    // Verdict
    let verdict, tone, note;
    if (!canBuy) { verdict = "No route"; tone = "bad"; note = "No liquidity route found to trade this token."; }
    else if (!canSell) { verdict = "Honeypot risk"; tone = "bad"; note = "A sell route could not be found. You may be able to buy but NOT sell. Avoid."; }
    else if (roundTripLossPct != null && roundTripLossPct >= 35) { verdict = "High tax / impact"; tone = "bad"; note = `A round trip loses ~${roundTripLossPct.toFixed(0)}% to tax, fees and price impact. Likely a high-tax token or very thin liquidity.`; }
    else if (roundTripLossPct != null && roundTripLossPct >= 15) { verdict = "Elevated cost"; tone = "warn"; note = `A round trip costs ~${roundTripLossPct.toFixed(0)}%. Trade small and mind slippage.`; }
    else { verdict = "Sellable"; tone = "good"; note = `Buys and sells route cleanly. Estimated round-trip cost ~${roundTripLossPct != null ? roundTripLossPct.toFixed(1) : "—"}%.`; }

    return send(res, 200, {
      ok: true, mint, canBuy, canSell,
      roundTripLossPct: roundTripLossPct != null ? Math.max(0, roundTripLossPct) : null,
      buyImpactPct: buyImpact, sellImpactPct: sellImpact,
      verdict, tone, note,
    });
  } catch (e) {
    return send(res, 200, { ok: false, mint, error: String(e?.message || e) });
  }
}
