/**
 * QA harness — trade-parameter fixes (F5/F6).
 *
 * F5 root cause: signUserSwap() hardcoded `slippageBps=200` in the Jupiter
 * quote URL. Every desk buy/sell — orbitx_app_buy, orbitx_app_sell, and all
 * five strategy-family fills (limits, trailing, ladder, alerts, copy, sniper),
 * which all execute through appWalletBuy/appWalletSell — ran at 200bps with
 * no caller control.
 *
 * F6 root cause: appWalletSell silently clamped out-of-range sizes instead of
 * rejecting them — percent=0 sold 1% and reported ok:true ("no-op success"),
 * percent=150 liquidated 100% ("over-fill"), negative percent sold 1%.
 * appWalletLimit's trigger pct<=0 armed an order whose target was already hit
 * (silent immediate fill on the next tick), and trigger:0 silently became 15%
 * via `|| 15`.
 *
 * Fix: slippage is now a validated caller-supplied parameter (integer bps,
 * 0–5000, default 200) threaded through buy/sell/limit (persisted on armed
 * limit orders and honored at fill time); sell percent/fraction and the limit
 * trigger are range-validated with clear errors.
 *
 * Read-only: no network, no DB, no fills executed. The helpers under test are
 * pure and sliced out of the handler sources (same technique as the other
 * qa-* harnesses). If a handler is refactored (block moved/renamed), the
 * extractor throws at collection time and EVERY test fails loudly.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WALLET_SRC = readFileSync(
  path.resolve(HERE, "../api/orbitx/_handlers/_user-trading-wallet.js"),
  "utf8"
);
const APP_SRC = readFileSync(
  path.resolve(HERE, "../api/orbitx/_handlers/_mcp-app-wallet.js"),
  "utf8"
);

function extractBlock(src, startAnchor, endAnchor, label) {
  const s = src.indexOf(startAnchor);
  const e = src.indexOf(endAnchor);
  if (s < 0 || e < 0 || e <= s) {
    throw new Error(`${label}: anchors not found — handler was refactored, update the extractor`);
  }
  return src.slice(s, e).replace(/^export /gm, "");
}

// F5 block: SOL_MINT + JUP + slippage consts + coerceSlippageBps + jupiterQuoteUrl.
const f5Block = extractBlock(
  WALLET_SRC,
  "export const SOL_MINT",
  "/* End slippage validation (F5). */",
  "qa-trade-params/f5"
);
const {
  SLIPPAGE_BPS_DEFAULT,
  SLIPPAGE_BPS_MAX,
  coerceSlippageBps,
  jupiterQuoteUrl,
  // eslint-disable-next-line no-new-func
} = new Function(`${f5Block}; return { SLIPPAGE_BPS_DEFAULT, SLIPPAGE_BPS_MAX, coerceSlippageBps, jupiterQuoteUrl };`)();

if (SLIPPAGE_BPS_DEFAULT !== 200) throw new Error("qa-trade-params: SLIPPAGE_BPS_DEFAULT extraction failed");
if (typeof coerceSlippageBps !== "function") throw new Error("qa-trade-params: coerceSlippageBps extraction failed");

// F6 block: validateSellSize + validateTriggerPct (pure, no imports).
const f6Block = extractBlock(
  APP_SRC,
  "/* Trade-parameter validation (F5/F6).",
  "/* End trade-parameter validation (F5/F6). */",
  "qa-trade-params/f6"
);
const {
  validateSellSize,
  validateTriggerPct,
  // eslint-disable-next-line no-new-func
} = new Function(`${f6Block}; return { validateSellSize, validateTriggerPct };`)();

if (typeof validateSellSize !== "function") throw new Error("qa-trade-params: validateSellSize extraction failed");
if (typeof validateTriggerPct !== "function") throw new Error("qa-trade-params: validateTriggerPct extraction failed");

// fillArgsFor: standalone function, extracted by regex to the closing brace at col 0.
const fillMatch = APP_SRC.match(/function fillArgsFor\(order\) \{[\s\S]*?\n\}/);
if (!fillMatch) throw new Error("qa-trade-params: fillArgsFor not found — handler was refactored, update the extractor");
const { fillArgsFor } = new Function(`${fillMatch[0]}; return { fillArgsFor };`)(); // eslint-disable-line no-new-func
if (typeof fillArgsFor !== "function") throw new Error("qa-trade-params: fillArgsFor extraction failed");

/* ------------------------------------------------------------------ */
/* F5: slippage validation                                            */
/* ------------------------------------------------------------------ */

describe("F5 coerceSlippageBps", () => {
  it("defaults to 200 when absent", () => {
    expect(coerceSlippageBps(undefined)).toBe(200);
    expect(coerceSlippageBps(null)).toBe(200);
    expect(coerceSlippageBps("")).toBe(200);
  });
  it("accepts the valid range 0–5000", () => {
    expect(coerceSlippageBps(0)).toBe(0);
    expect(coerceSlippageBps(200)).toBe(200);
    expect(coerceSlippageBps(5000)).toBe(5000);
    expect(coerceSlippageBps("250")).toBe(250);
  });
  it("rounds fractional bps to an integer", () => {
    expect(coerceSlippageBps(199.6)).toBe(200);
  });
  it("rejects absurd values that guarantee a bad fill", () => {
    expect(() => coerceSlippageBps(5001)).toThrow(/out of range/);
    expect(() => coerceSlippageBps(10000)).toThrow(/out of range/);
    expect(() => coerceSlippageBps(-1)).toThrow(/out of range/);
    expect(() => coerceSlippageBps(-200)).toThrow(/out of range/);
  });
  it("rejects non-numeric garbage", () => {
    expect(() => coerceSlippageBps("abc")).toThrow(/must be a number/);
    expect(() => coerceSlippageBps(NaN)).toThrow();
    expect(() => coerceSlippageBps(Infinity)).toThrow();
  });
});

describe("F5 jupiterQuoteUrl", () => {
  it("interpolates the caller-supplied slippage instead of a hardcode", () => {
    const url = jupiterQuoteUrl("IN", "OUT", 1000, 350);
    expect(url).toContain("slippageBps=350");
    expect(url).not.toContain("slippageBps=200");
  });
  it("uses the default when the caller passes nothing", () => {
    const url = jupiterQuoteUrl("IN", "OUT", 1000, coerceSlippageBps(undefined));
    expect(url).toContain("slippageBps=200");
  });
});

describe("F5 regression locks (source)", () => {
  it("signUserSwap no longer hardcodes slippageBps=200", () => {
    const body = WALLET_SRC.slice(WALLET_SRC.indexOf("export async function signUserSwap"));
    const fnEnd = body.indexOf("export async function loadDeskKeypair");
    const fn = body.slice(0, fnEnd);
    expect(fn).not.toContain("slippageBps=200");
    expect(fn).toContain("coerceSlippageBps(slippageBps)");
    expect(fn).toContain("jupiterQuoteUrl(");
  });
  it("buy/sell/limit validate slippage before any network call", () => {
    expect(APP_SRC).toContain("coerceSlippageBps(args.slippageBps)");
  });
});

/* ------------------------------------------------------------------ */
/* F6: sell size validation — the dangerous inputs from the finding    */
/* ------------------------------------------------------------------ */

describe("F6 validateSellSize", () => {
  it("rejects percent=0 (was: silent 1% sell reported ok:true)", () => {
    const r = validateSellSize({ percent: 0 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("bad_percent");
  });
  it("rejects percent>100 (was: silent 100% liquidation)", () => {
    const r = validateSellSize({ percent: 150 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("bad_percent");
  });
  it("rejects negative percent (was: silent 1% sell)", () => {
    const r = validateSellSize({ percent: -5 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("bad_percent");
  });
  it("rejects non-numeric percent", () => {
    expect(validateSellSize({ percent: "abc" }).ok).toBe(false);
  });
  it("rejects out-of-range fraction", () => {
    expect(validateSellSize({ fraction: 0 }).error).toBe("bad_fraction");
    expect(validateSellSize({ fraction: 1.5 }).error).toBe("bad_fraction");
    expect(validateSellSize({ fraction: -0.2 }).error).toBe("bad_fraction");
  });
  it("accepts the valid domains", () => {
    expect(validateSellSize({ percent: 1 })).toEqual({ ok: true, fraction: 0.01 });
    expect(validateSellSize({ percent: 100 })).toEqual({ ok: true, fraction: 1 });
    expect(validateSellSize({ percent: 25 })).toEqual({ ok: true, fraction: 0.25 });
    expect(validateSellSize({ fraction: 0.5 })).toEqual({ ok: true, fraction: 0.5 });
    expect(validateSellSize({})).toEqual({ ok: true, fraction: 1 });
  });
  it("fraction wins over percent when both are given", () => {
    expect(validateSellSize({ percent: 50, fraction: 0.25 })).toEqual({ ok: true, fraction: 0.25 });
  });
});

/* ------------------------------------------------------------------ */
/* F6: limit trigger validation                                        */
/* ------------------------------------------------------------------ */

describe("F6 validateTriggerPct", () => {
  it("rejects trigger=0 (was: silently became 15% via || 15)", () => {
    const r = validateTriggerPct({ trigger: 0 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("bad_trigger");
  });
  it("rejects negative trigger (was: immediate fill on next tick)", () => {
    const r = validateTriggerPct({ trigger: -10 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("bad_trigger");
  });
  it("rejects trigger>100", () => {
    expect(validateTriggerPct({ trigger: 150 }).error).toBe("bad_trigger");
  });
  it("rejects garbage trigger text (was: silently became 15%)", () => {
    expect(validateTriggerPct({ trigger: "abc" }).error).toBe("bad_trigger");
  });
  it("accepts the valid domain and the legacy aliases", () => {
    expect(validateTriggerPct({ trigger: 15 })).toEqual({ ok: true, pct: 15 });
    expect(validateTriggerPct({ trigger: "15%" })).toEqual({ ok: true, pct: 15 });
    expect(validateTriggerPct({ percent: 25 })).toEqual({ ok: true, pct: 25 });
    expect(validateTriggerPct({ up: 10 })).toEqual({ ok: true, pct: 10 });
    expect(validateTriggerPct({})).toEqual({ ok: true, pct: 15 });
  });
});

/* ------------------------------------------------------------------ */
/* Fill-time passthrough: armed slippage reaches the fill args          */
/* ------------------------------------------------------------------ */

describe("fillArgsFor slippage passthrough", () => {
  it("passes armed slippageBps through on sell fills", () => {
    const a = fillArgsFor({ side: "sell", mint: "MINT", size: { fraction: 0.5, slippageBps: 350 } });
    expect(a.slippageBps).toBe(350);
    expect(a.fraction).toBe(0.5);
  });
  it("passes armed slippageBps through on buy fills", () => {
    const a = fillArgsFor({ side: "buy", mint: "MINT", size: { usd: 5, slippageBps: 120 } });
    expect(a.slippageBps).toBe(120);
    expect(a.usd).toBe(5);
  });
  it("omits slippageBps for legacy orders armed without it (default 200 applies)", () => {
    const a = fillArgsFor({ side: "sell", mint: "MINT", size: { fraction: 1 } });
    expect("slippageBps" in a).toBe(false);
  });
});

describe("wiring regression locks (source)", () => {
  it("appWalletSell validates size via validateSellSize", () => {
    expect(APP_SRC).toContain("validateSellSize(args)");
  });
  it("appWalletLimit validates the trigger via validateTriggerPct", () => {
    expect(APP_SRC).toContain("validateTriggerPct(args)");
  });
  it("limit orders persist slippageBps on the armed size", () => {
    expect(APP_SRC).toContain("size.slippageBps = slip");
  });
  it("tool schemas advertise slippageBps on buy/sell/limit", () => {
    for (const name of ["orbitx_app_buy", "orbitx_app_sell", "orbitx_app_limit"]) {
      const i = APP_SRC.indexOf(`name: "${name}"`);
      expect(i).toBeGreaterThan(-1);
      const schema = APP_SRC.slice(i, i + 1200);
      expect(schema).toContain("slippageBps");
    }
  });
});
