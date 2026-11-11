// ── OG score — single source of truth ───────────────────────────────────────
// The REAL scanner scoring engine, moved verbatim out of
// web/src/crypto/hooks/useTokenIntel.ts (which only re-exports it now).
// Pure logic, zero imports: no fetch, no React, no Vite aliases, so it loads
// identically in the Vite client AND in Vercel serverless functions.
// Used by:
//   - web/src/crypto/hooks/useTokenIntel.ts (web scanner, via re-export)
//   - web/api/ogdex/_routes/_tg-scan.js (Telegram Mini App scanner)
// Never duplicate this math anywhere else — if the scoring changes, it
// changes HERE and both callers move together.
//
// Rules baked in (from the hook file, unchanged):
// unknown is always "unknown" — a missing signal scores 0 points for its
// category and is listed in `unknowns`, never invented. Hard caps: rugged
// ≤15, cannot-sell ≤20, a bigger same-name clone ≤30. Bundle / X /
// source-trace adjustments apply AFTER the category sum, and an unavailable
// signal adjusts 0 — an unrun scan is never evidence of anything.

/**
 * @typedef {"pass" | "warn" | "fail" | "unknown"} VerdictState
 */

/**
 * Minimal safety-probe shape (subset of the client's SafetyPayload — only
 * the fields these checks read). Any object with these fields is accepted.
 * @typedef {Object} SafetyProbe
 * @property {boolean | null | undefined} [canBuy]
 * @property {boolean | null | undefined} [canSell]
 * @property {number | null | undefined} [roundTripLossPct]
 */

/**
 * @typedef {"low" | "moderate" | "high"} BundleRiskLevel
 */

// ── W1 contract: bundle analysis ─────────────────────────────────────────────
// W1 delivers `analyzeBundles(mint)` returning this shape. It is NOT in the
// tree yet (checked 2026-11-08) — this is the documented interface W3 codes
// against; the coordinator reconciles field names when W1 lands. Percentages
// are 0–100 (share of supply), matching RugScore's existing bundlePct
// convention. `available: false` means the scan did not run / returned
// nothing — the score treats that as "no information", never as "clean".

/**
 * @typedef {Object} BundleAnalysis
 * @property {boolean} available
 * @property {number | null} bundledSupplyPct Share of supply in detected bundled clusters, 0-100.
 * @property {number | null} clusterCount
 * @property {number | null} largestClusterPct
 * @property {BundleRiskLevel | null} bundleRisk
 * @property {string | null | undefined} [note]
 */

/**
 * @typedef {"available" | "partial" | "unavailable"} XAvailability
 */

// ── W2 contract: X intel ─────────────────────────────────────────────────────
// W2 delivers `fetchXIntel(mint)` returning this shape. It is NOT in the
// tree yet (checked 2026-11-08) — this is the documented interface W3 codes
// against; the coordinator reconciles field names when W2 lands. Every field
// is nullable: real X data only, never a fabricated count. `availability`
// carries the honest state — "unavailable" means the X lookup failed or the
// token has no discoverable X presence, and it must NEVER lower the score.

/**
 * @typedef {Object} XIntel
 * @property {XAvailability} availability
 * @property {string | null} handle Linked X handle without the @.
 * @property {number | null} followers
 * @property {number | null} mentions24h Real mentions in the last 24h, null when unmeasured.
 * @property {number | null} kolMentions
 * @property {"positive" | "neutral" | "negative" | null} sentiment
 * @property {number | null} accountAgeDays
 * @property {string | null | undefined} [note]
 */

// ── Source-wallet trace (user spec 2026-11-08, Solscan-style) ───────────────
// Every fresh wallet was funded from a source wallet (DEX / pump.fun /
// on-ramp), so a dev launching from a "new" wallet is still on-chain
// connected to their source. The backend walk (Helius/RPC funding graph) is
// W1-owned — no new web/api file may be added under the 12-function cap, so
// this is the documented interface W3 codes against and the coordinator
// reconciles it with W1's route. Unavailable = no penalty, same rule as X.

/**
 * @typedef {Object} SourceWalletTrace
 * @property {boolean} available
 * @property {string | null} devWallet
 * @property {string | null} fundedBy Wallet that directly funded the dev wallet.
 * @property {number | null} fundingHops
 * @property {string | null} sourceWallet Root funding wallet.
 * @property {number | null} sourceTokensCreated
 * @property {string[] | null} sourceOtherLaunches
 * @property {string | null | undefined} [note]
 */

/**
 * @typedef {Object} OgScoreInput
 * @property {boolean | null | undefined} [mintRenounced]
 * @property {boolean | null | undefined} [freezeRenounced]
 * @property {number | null | undefined} [lpLockedPct]
 * @property {boolean | null | undefined} [rugged]
 * @property {number | null | undefined} [liquidityUsd]
 * @property {number | null | undefined} [marketCapUsd]
 * @property {number | null | undefined} [volume24h]
 * @property {number | null | undefined} [top10Pct]
 * @property {number | null | undefined} [totalHolders]
 * @property {number | null | undefined} [whaleCount]
 * @property {boolean | null | undefined} [canBuy]
 * @property {boolean | null | undefined} [canSell]
 * @property {number | null | undefined} [roundTripLossPct]
 * @property {string | null | undefined} [tokenProgram] SPL token program id — when known, "Token program" is no longer listed as unknown.
 * @property {boolean | null | undefined} [devSold]
 * @property {boolean | null | undefined} [devSerial]
 * @property {number | null | undefined} [creatorTokensCount]
 * @property {number | null | undefined} [ageDays]
 * @property {number | null | undefined} [cloneCount]
 * @property {boolean | null | undefined} [biggerClone]
 * @property {BundleAnalysis | null | undefined} [bundle]
 * @property {XIntel | null | undefined} [x]
 * @property {SourceWalletTrace | null | undefined} [sourceTrace]
 */

/**
 * @typedef {Object} OgScoreCategory
 * @property {string} id
 * @property {string} label
 * @property {number} points
 * @property {number} max
 * @property {string} note
 */

/**
 * @typedef {Object} OgScoreAdjustment
 * @property {"bundle" | "x" | "source-trace"} id
 * @property {string} label
 * @property {number} points Signed points, e.g. -5. Zero adjustments are omitted.
 */

/**
 * @typedef {Object} OgScore
 * @property {number | null} score 0-100, higher = safer. Null when there is no evidence at all.
 * @property {string} band
 * @property {string} label
 * @property {OgScoreCategory[]} categories
 * @property {string[]} caps
 * @property {string[]} unknowns
 * @property {OgScoreAdjustment[]} adjustments
 */

/**
 * @param {boolean | null | undefined} renounced
 * @returns {{ state: VerdictState, label: string }}
 */
export function authorityVerdict(renounced) {
  if (renounced === true) return { state: "pass", label: "Revoked" };
  if (renounced === false) return { state: "fail", label: "Live" };
  return { state: "unknown", label: "Unknown" };
}

/**
 * Honeypot-style checks from the Jupiter round-trip safety probe.
 * @param {SafetyProbe | null | undefined} safety
 * @returns {Array<{ id: string, state: VerdictState, label: string, detail: string }>}
 */
export function honeypotChecks(safety) {
  if (!safety) {
    return [{ id: "tradeability", state: "unknown", label: "Tradeability unknown", detail: "Safety probe returned nothing." }];
  }
  const out = [];
  if (safety.canBuy === false) {
    out.push({ id: "can-buy", state: "fail", label: "Cannot buy", detail: "No Jupiter buy route found." });
  } else if (safety.canBuy === true) {
    out.push({ id: "can-buy", state: "pass", label: "Buy route open", detail: "Jupiter quotes a buy." });
  }
  if (safety.canSell === false) {
    out.push({
      id: "can-sell",
      state: "fail",
      label: "Cannot sell — honeypot-style",
      detail: "A buy route exists but no sell route could be found.",
    });
  } else if (safety.canSell === true) {
    out.push({ id: "can-sell", state: "pass", label: "Sell route open", detail: "Round-trip quote succeeded." });
  }
  const rt = safety.roundTripLossPct;
  if (rt != null && Number.isFinite(rt)) {
    out.push({
      id: "round-trip",
      state: rt >= 35 ? "fail" : rt >= 15 ? "warn" : "pass",
      label: `Round-trip cost ${rt.toFixed(1)}%`,
      detail:
        rt >= 35
          ? "Loses a third or more to tax, fees and impact — likely high-tax or very thin."
          : rt >= 15
            ? "Elevated cost — trade small and mind slippage."
            : "Low round-trip cost.",
    });
  }
  if (!out.length) {
    out.push({ id: "tradeability", state: "unknown", label: "Tradeability unknown", detail: "Safety probe returned no route data." });
  }
  return out;
}

/** Bundle risk → human verdict. Unavailable is always "unknown". */
/**
 * @param {BundleAnalysis | null | undefined} bundle
 * @returns {{ state: VerdictState, label: string, detail: string }}
 */
export function bundleRiskVerdict(bundle) {
  if (!bundle || bundle.available !== true) {
    return { state: "unknown", label: "Unknown", detail: "Bundle scan has not run for this mint — no clusters checked, nothing assumed clean." };
  }
  const pct = bundle.bundledSupplyPct;
  if (bundle.bundleRisk === "high" || (pct != null && pct >= 30)) {
    return { state: "fail", label: `High bundle risk${pct != null ? ` — ${pct.toFixed(1)}% bundled` : ""}`, detail: "A large share of supply sits in wallets funded from a common source — coordinated sell pressure is one decision away." };
  }
  if (bundle.bundleRisk === "moderate" || (pct != null && pct >= 15)) {
    return { state: "warn", label: `Moderate bundle risk${pct != null ? ` — ${pct.toFixed(1)}% bundled` : ""}`, detail: "Some supply is clustered under common funding — watch it, don't trust it." };
  }
  return { state: "pass", label: `Low bundle risk${pct != null ? ` — ${pct.toFixed(1)}% bundled` : ""}`, detail: "No material bundled supply detected." };
}

/**
 * Bundle score adjustment (applied AFTER the 0–100 category sum, BEFORE the
 * hard caps, clamped to 0–100). Weights: high −5, moderate −2, low 0,
 * unavailable 0. Unavailable NEVER penalises — an unrun scan is not evidence
 * of bundling.
 * @param {BundleAnalysis | null | undefined} bundle
 * @returns {number}
 */
export function bundleScoreAdjustment(bundle) {
  if (!bundle || bundle.available !== true) return 0;
  if (bundle.bundleRisk === "high") return -5;
  if (bundle.bundleRisk === "moderate") return -2;
  const pct = bundle.bundledSupplyPct;
  if (pct != null && Number.isFinite(pct)) {
    if (pct >= 30) return -5;
    if (pct >= 15) return -2;
  }
  return 0;
}

/**
 * X score adjustment (applied AFTER the category sum, BEFORE the hard caps,
 * clamped to 0–100). Weights — deliberately small, X is a weak signal:
 * available + positive sentiment +2, available + negative sentiment −2,
 * everything else 0. Unavailable/partial-without-sentiment NEVER moves the
 * score in either direction.
 * @param {XIntel | null | undefined} x
 * @returns {number}
 */
export function xScoreAdjustment(x) {
  if (!x || x.availability !== "available") return 0;
  if (x.sentiment === "positive") return 2;
  if (x.sentiment === "negative") return -2;
  return 0;
}

/**
 * Source-trace score adjustment. Weights: source behind ≥5 launches −3,
 * 2–4 launches −1, 0–1 launches 0, unavailable 0. A fresh wallet funded by
 * a serial launcher's source is the same risk as the serial launcher.
 * @param {SourceWalletTrace | null | undefined} trace
 * @returns {number}
 */
export function sourceTraceAdjustment(trace) {
  if (!trace || trace.available !== true) return 0;
  const n = trace.sourceTokensCreated;
  if (n != null && Number.isFinite(n)) {
    if (n >= 5) return -3;
    if (n >= 2) return -1;
  }
  if (trace.sourceOtherLaunches && trace.sourceOtherLaunches.length >= 5) return -3;
  if (trace.sourceOtherLaunches && trace.sourceOtherLaunches.length >= 2) return -1;
  return 0;
}

/**
 * @param {number | null} score
 * @returns {{ band: string, label: string }}
 */
export function ogScoreBand(score) {
  if (score == null) return { band: "Unknown", label: "Unverified — not enough signals" };
  if (score >= 90) return { band: "Excellent", label: "Excellent" };
  if (score >= 80) return { band: "Strong", label: "Strong" };
  if (score >= 70) return { band: "Good", label: "Good" };
  if (score >= 60) return { band: "Fair", label: "Fair" };
  if (score >= 40) return { band: "Risky", label: "Risky" };
  if (score >= 20) return { band: "High risk", label: "High risk" };
  return { band: "Critical", label: "Critical" };
}

/**
 * OG score — 0–100 (higher = safer), composed from the same evidence the
 * risk engine uses. Missing data scores 0 for its category and is listed in
 * `unknowns`; it never invents a value. Hard caps: rugged ≤15, cannot-sell
 * ≤20, a bigger same-name clone ≤30.
 * @param {OgScoreInput} input
 * @returns {OgScore}
 */
export function computeOgScore(input) {
  const cats = [];
  const caps = [];
  const unknowns = [];
  let evidence = 0;

  // Contract — 25
  let pts = 0;
  if (input.mintRenounced === true) { pts += 13; evidence++; }
  else if (input.mintRenounced === false) { evidence++; }
  else unknowns.push("Mint authority");
  if (input.freezeRenounced === true) { pts += 12; evidence++; }
  else if (input.freezeRenounced === false) { evidence++; }
  else unknowns.push("Freeze authority");
  unknowns.push("Mutable metadata"); // no source reports this yet
  // Token program IS reported by Jupiter (tokenProgram) — only unknown when
  // the caller didn't supply it.
  if (input.tokenProgram == null) unknowns.push("Token program");
  cats.push({
    id: "contract",
    label: "Contract",
    points: pts,
    max: 25,
    note:
      input.mintRenounced === true && input.freezeRenounced === true
        ? "Both authorities revoked."
        : input.mintRenounced === false || input.freezeRenounced === false
          ? "A live authority can change supply or freeze wallets."
          : "Authority state unknown.",
  });

  // Liquidity — 20
  pts = 0;
  const liq = input.liquidityUsd;
  if (liq != null && Number.isFinite(liq)) {
    evidence++;
    if (liq >= 100_000) pts += 8;
    else if (liq >= 25_000) pts += 5;
    else if (liq >= 5_000) pts += 3;
    else if (liq > 0) pts += 1;
  } else {
    unknowns.push("Liquidity");
  }
  const lp = input.lpLockedPct;
  if (lp != null && Number.isFinite(lp)) {
    evidence++;
    if (lp >= 90) pts += 12;
    else if (lp >= 50) pts += 8;
    else if (lp > 0) pts += 4;
  } else {
    unknowns.push("LP lock status");
  }
  cats.push({
    id: "liquidity",
    label: "Liquidity",
    points: pts,
    max: 20,
    note: liq != null ? `Total liquidity ${liq >= 1000 ? `$${Math.round(liq).toLocaleString()}` : `$${liq.toFixed(2)}`}.` : "Liquidity unknown.",
  });

  // Holders — 15
  pts = 0;
  const top10 = input.top10Pct;
  if (top10 != null && Number.isFinite(top10)) {
    evidence++;
    if (top10 <= 20) pts += 9;
    else if (top10 <= 35) pts += 6;
    else if (top10 <= 50) pts += 3;
  } else {
    unknowns.push("Top-10 concentration");
  }
  const holders = input.totalHolders;
  if (holders != null && Number.isFinite(holders)) {
    evidence++;
    if (holders >= 1000) pts += 4;
    else if (holders >= 100) pts += 2;
    else if (holders > 0) pts += 1;
  } else {
    unknowns.push("Holder count");
  }
  const whales = input.whaleCount;
  if (whales != null && Number.isFinite(whales)) {
    evidence++;
    if (whales === 0) pts += 2;
    else if (whales <= 3) pts += 1;
  }
  cats.push({
    id: "holders",
    label: "Holders",
    points: pts,
    max: 15,
    note:
      top10 != null
        ? `Top 10 hold ${top10.toFixed(1)}% of supply.`
        : "Holder concentration unknown.",
  });

  // Deployer — 15
  pts = 0;
  if (input.devSold === true) {
    evidence++;
  } else if (input.devSold === false) {
    pts += 8;
    evidence++;
  } else {
    unknowns.push("Dev position");
  }
  if (input.devSerial === true) {
    evidence++;
  } else if (input.devSerial === false) {
    pts += 4;
    evidence++;
  } else {
    unknowns.push("Deployer history");
  }
  if (input.creatorTokensCount != null && Number.isFinite(input.creatorTokensCount)) {
    evidence++;
    if (input.creatorTokensCount <= 1) pts += 3;
  }
  cats.push({
    id: "deployer",
    label: "Deployer",
    points: pts,
    max: 15,
    note:
      input.devSold === true
        ? "Deployer has exited their position."
        : input.devSold === false
          ? "Deployer still holds."
          : "Deployer position unknown.",
  });

  // Trading — 10
  pts = 0;
  if (input.canBuy === true && input.canSell === true) {
    pts += 6;
    evidence++;
  } else if (input.canBuy === true || input.canSell === true) {
    evidence++;
  } else if (input.canBuy === false || input.canSell === false) {
    evidence++;
  } else {
    unknowns.push("Tradeability");
  }
  const rt = input.roundTripLossPct;
  if (rt != null && Number.isFinite(rt)) {
    evidence++;
    if (rt < 5) pts += 4;
    else if (rt < 15) pts += 2;
  }
  cats.push({
    id: "trading",
    label: "Trading",
    points: pts,
    max: 10,
    note:
      input.canSell === false
        ? "No sell route — honeypot-style."
        : input.canBuy === true && input.canSell === true
          ? "Buys and sells route cleanly."
          : "Tradeability unknown.",
  });

  // Market / maturity — 15
  pts = 0;
  const age = input.ageDays;
  if (age != null && Number.isFinite(age)) {
    evidence++;
    if (age >= 30) pts += 5;
    else if (age >= 7) pts += 3;
    else if (age >= 1) pts += 1;
  } else {
    unknowns.push("Token age");
  }
  const vol = input.volume24h;
  if (vol != null && Number.isFinite(vol) && liq != null && Number.isFinite(liq) && liq > 0) {
    evidence++;
    const ratio = vol / liq;
    if (ratio >= 0.15 && ratio <= 8) pts += 5;
    else if (ratio > 8) pts += 1; // wash-trading territory
    else pts += 2; // quiet
  } else if (vol != null && Number.isFinite(vol)) {
    evidence++;
    pts += 2;
  }
  if (input.marketCapUsd != null && Number.isFinite(input.marketCapUsd) && input.marketCapUsd > 0) {
    pts += 2;
    evidence++;
  }
  if (input.cloneCount != null && Number.isFinite(input.cloneCount)) {
    evidence++;
    if (input.cloneCount > 0) pts += 0; // clones add no points; they cap below
    else pts += 3;
  }
  cats.push({
    id: "market",
    label: "Market",
    points: pts,
    max: 15,
    note:
      age != null
        ? `Pair is ${age < 1 ? "less than a day" : `${Math.round(age)} days`} old.`
        : "Token age unknown.",
  });

  let score = cats.reduce((s, c) => s + c.points, 0);
  if (input.rugged === true) {
    score = Math.min(score, 15);
    caps.push("Flagged rugged — score capped at 15.");
    evidence++;
  }
  if (input.canSell === false) {
    score = Math.min(score, 20);
    caps.push("No sell route — score capped at 20.");
  }
  if (input.biggerClone === true) {
    score = Math.min(score, 30);
    caps.push("A bigger same-name token exists — score capped at 30.");
  }

  // Post-category adjustments (bundle / X / source-trace): applied AFTER the
  // category sum and caps, clamped to 0–100. Unavailable signals adjust 0 —
  // an unrun scan is never evidence of anything.
  const adjustments = [];
  const bundleAdj = bundleScoreAdjustment(input.bundle);
  if (bundleAdj !== 0) adjustments.push({ id: "bundle", label: `Bundle risk ${bundleAdj}`, points: bundleAdj });
  const xAdj = xScoreAdjustment(input.x);
  if (xAdj !== 0) adjustments.push({ id: "x", label: `X sentiment ${xAdj > 0 ? `+${xAdj}` : xAdj}`, points: xAdj });
  const traceAdj = sourceTraceAdjustment(input.sourceTrace);
  if (traceAdj !== 0) adjustments.push({ id: "source-trace", label: `Serial-launcher source ${traceAdj}`, points: traceAdj });
  if (adjustments.length > 0) {
    score = Math.max(0, Math.min(100, score + adjustments.reduce((s, a) => s + a.points, 0)));
  }

  if (evidence === 0) {
    return { score: null, band: "Unknown", label: "Unverified — not enough signals", categories: cats, caps, unknowns, adjustments: [] };
  }
  const { band, label } = ogScoreBand(score);
  return { score, band, label, categories: cats, caps, unknowns, adjustments };
}
