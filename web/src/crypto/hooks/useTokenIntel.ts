import { useCallback, useEffect, useMemo, useState } from "react";
import {
  scanTokenFull,
  isValidMint,
  fetchDexPairs,
  fetchForensics,
  fetchResearchTyped,
  fetchWalletIntel,
  type DevWalletIntel,
  type DexPair,
  type ForensicsPayload,
  type ResearchPayload,
  type SafetyPayload,
  type TokenPayload,
} from "../api/client";
import { composeRisk, type ComposedRisk } from "../risk/composeRisk";
import { holderEntropyScore } from "@/lib/intelligence";
import { fetchBundleAnalysis, type BundleAnalysis as RawBundleAnalysis } from "../bundle";
import {
  computeLiveRisk,
  fetchDevHistory,
  fetchFundingChain,
  fetchSameDev,
  fetchTradeTape,
  fetchDeepIntel,
  fetchWalletAges,
  fetchHolderOverlap,
  fetchBundleDecay,
  convictionLabel,
  slippageForSize,
  simulateDevSell,
  entryExitFor1Pct,
  detectWashTrading,
  bundleDecayTrend,
  dangerScoreForOutcome,
  KNOWN_CEX_HOT_WALLETS,
  type BundleCluster,
  type DeepIntel,
  type WalletAge,
  type HolderOverlapEntry,
  type BundleDecay,
  type HolderTrace,
  type DevHistory,
  type FundingChain,
  type RiskLive,
  type SameDevResult,
  type TradeTapeEntry,
  type WhaleAlert,
} from "../bundle";
import { fetchXIntel, type XIntel as RawXIntel } from "../xintel";

// ── Pure scanner forensics / scoring ─────────────────────────────────────────
// All functions here are pure (no fetch, no React) so they are unit-testable
// in src/crypto/scanner-forensics.test.ts. Unknown is always "unknown" — a
// missing signal scores 0 points for its category and is flagged, never
// invented.

export type VerdictState = "pass" | "warn" | "fail" | "unknown";

export function authorityVerdict(renounced: boolean | null | undefined): {
  state: VerdictState;
  label: string;
} {
  if (renounced === true) return { state: "pass", label: "Revoked" };
  if (renounced === false) return { state: "fail", label: "Live" };
  return { state: "unknown", label: "Unknown" };
}

/** Top-10 holder concentration → band. Pools are already excluded upstream
 *  (forensics strips liquidity-pool vaults before computing top10Pct). */
export function concentrationBand(top10Pct: number | null | undefined): {
  band: string;
  state: VerdictState;
  label: string;
} {
  if (top10Pct == null || !Number.isFinite(top10Pct)) {
    return { band: "Unknown", state: "unknown", label: "Unknown" };
  }
  if (top10Pct <= 20) return { band: "Distributed", state: "pass", label: "Distributed" };
  if (top10Pct <= 35) return { band: "Moderate", state: "pass", label: "Moderate" };
  if (top10Pct <= 50) return { band: "Concentrated", state: "warn", label: "Concentrated" };
  return { band: "Highly concentrated", state: "fail", label: "Highly concentrated" };
}

/** LP lock % (Rugcheck via forensics safety) → lock state. */
export function lpLockState(lpLockedPct: number | null | undefined): {
  state: VerdictState;
  label: string;
} {
  if (lpLockedPct == null || !Number.isFinite(lpLockedPct)) {
    return { state: "unknown", label: "Unknown" };
  }
  if (lpLockedPct >= 90) return { state: "pass", label: `Locked (${Math.round(lpLockedPct)}%)` };
  if (lpLockedPct >= 50) return { state: "warn", label: `Partially locked (${Math.round(lpLockedPct)}%)` };
  if (lpLockedPct > 0) return { state: "warn", label: `Low lock (${Math.round(lpLockedPct)}%)` };
  return { state: "fail", label: "Unlocked (0%)" };
}

/** Honeypot-style checks from the Jupiter round-trip safety probe. */
export function honeypotChecks(safety: SafetyPayload | null | undefined): Array<{
  id: string;
  state: VerdictState;
  label: string;
  detail: string;
}> {
  if (!safety) {
    return [{ id: "tradeability", state: "unknown", label: "Tradeability unknown", detail: "Safety probe returned nothing." }];
  }
  const out: Array<{ id: string; state: VerdictState; label: string; detail: string }> = [];
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

/** Clone verdict from the research endpoint's same-symbol/name list. A clone
 *  with a bigger market cap than the scanned token is the dangerous case
 *  (the scanned one is likely the copy). */
export function cloneVerdict(
  clones: ResearchPayload["clones"] | null,
  ownMcap: number | null | undefined,
): { state: VerdictState; label: string; count: number; biggerClone: boolean } {
  if (!clones) return { state: "unknown", label: "Unknown — clone check unavailable", count: 0, biggerClone: false };
  const count = clones.length;
  if (count === 0) return { state: "pass", label: "No same-name clones found", count: 0, biggerClone: false };
  const biggerClone =
    ownMcap != null && clones.some((c) => c.mcap != null && c.mcap > ownMcap);
  if (biggerClone) {
    return { state: "fail", label: `${count} same-name token(s) — a bigger one exists`, count, biggerClone: true };
  }
  return { state: "warn", label: `${count} same-name token(s) found`, count, biggerClone: false };
}

/** Human age label from pair creation data. */
export function ageLabel(ageDays: number | null | undefined, createdAt: string | null | undefined): string {
  if (ageDays != null && Number.isFinite(ageDays)) {
    if (ageDays < 1) return "Less than a day old";
    if (ageDays === 1) return "1 day old";
    if (ageDays < 30) return `${ageDays} days old`;
    if (ageDays < 365) return `${Math.round(ageDays / 30)} months old`;
    return `${(ageDays / 365).toFixed(1)} years old`;
  }
  if (createdAt) {
    const ms = Date.parse(createdAt);
    if (Number.isFinite(ms)) {
      const d = Math.floor((Date.now() - ms) / 86_400_000);
      return d <= 0 ? "Less than a day old" : `${d} days old`;
    }
  }
  return "Unknown";
}

export type OgScoreInput = {
  mintRenounced?: boolean | null;
  freezeRenounced?: boolean | null;
  lpLockedPct?: number | null;
  rugged?: boolean | null;
  liquidityUsd?: number | null;
  marketCapUsd?: number | null;
  volume24h?: number | null;
  top10Pct?: number | null;
  totalHolders?: number | null;
  whaleCount?: number | null;
  canBuy?: boolean | null;
  canSell?: boolean | null;
  roundTripLossPct?: number | null;
  devSold?: boolean | null;
  devSerial?: boolean | null;
  creatorTokensCount?: number | null;
  ageDays?: number | null;
  cloneCount?: number | null;
  biggerClone?: boolean | null;
  /** W1 bundle analysis (see BundleAnalysis). Null/absent = unavailable. */
  bundle?: BundleAnalysis | null;
  /** W2 X intel (see XIntel). Null/absent = unavailable. */
  x?: XIntel | null;
  /** Source-wallet funding trace (see SourceWalletTrace). Null/absent = unavailable. */
  sourceTrace?: SourceWalletTrace | null;
};

// ── W1 contract: bundle analysis ─────────────────────────────────────────────
// W1 delivers `analyzeBundles(mint)` returning this shape. It is NOT in the
// tree yet (checked 2026-11-08) — this is the documented interface W3 codes
// against; the coordinator reconciles field names when W1 lands. Percentages
// are 0–100 (share of supply), matching RugScore's existing bundlePct
// convention. `available: false` means the scan did not run / returned
// nothing — the score treats that as "no information", never as "clean".
export type BundleRiskLevel = "low" | "moderate" | "high";

export type BundleAnalysis = {
  available: boolean;
  /** Share of supply held by detected bundled clusters, 0–100. */
  bundledSupplyPct: number | null;
  /** Number of holder clusters funded from a common source. */
  clusterCount: number | null;
  /** Largest single cluster's share of supply, 0–100. */
  largestClusterPct: number | null;
  bundleRisk: BundleRiskLevel | null;
  note?: string | null;
};

/** Bundle risk → human verdict. Unavailable is always "unknown". */
export function bundleRiskVerdict(bundle: BundleAnalysis | null | undefined): {
  state: VerdictState;
  label: string;
  detail: string;
} {
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
 */
export function bundleScoreAdjustment(bundle: BundleAnalysis | null | undefined): number {
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

// ── W2 contract: X intel ─────────────────────────────────────────────────────
// W2 delivers `fetchXIntel(mint)` returning this shape. It is NOT in the
// tree yet (checked 2026-11-08) — this is the documented interface W3 codes
// against; the coordinator reconciles field names when W2 lands. Every field
// is nullable: real X data only, never a fabricated count. `availability`
// carries the honest state — "unavailable" means the X lookup failed or the
// token has no discoverable X presence, and it must NEVER lower the score.
export type XAvailability = "available" | "partial" | "unavailable";

export type XIntel = {
  availability: XAvailability;
  /** Linked X handle without the @, null when no account is linked/found. */
  handle: string | null;
  followers: number | null;
  /** Real mentions of the token in the last 24h, null when unmeasured. */
  mentions24h: number | null;
  /** Distinct KOL accounts mentioning the token, null when unmeasured. */
  kolMentions: number | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  accountAgeDays: number | null;
  note?: string | null;
};

/**
 * X score adjustment (applied AFTER the category sum, BEFORE the hard caps,
 * clamped to 0–100). Weights — deliberately small, X is a weak signal:
 * available + positive sentiment +2, available + negative sentiment −2,
 * everything else 0. Unavailable/partial-without-sentiment NEVER moves the
 * score in either direction.
 */
export function xScoreAdjustment(x: XIntel | null | undefined): number {
  if (!x || x.availability !== "available") return 0;
  if (x.sentiment === "positive") return 2;
  if (x.sentiment === "negative") return -2;
  return 0;
}

// ── Source-wallet trace (user spec 2026-11-08, Solscan-style) ───────────────
// Every fresh wallet was funded from a source wallet (DEX / pump.fun /
// on-ramp), so a dev launching from a "new" wallet is still on-chain
// connected to their source. The backend walk (Helius/RPC funding graph) is
// W1-owned — no new web/api file may be added under the 12-function cap, so
// this is the documented interface W3 codes against and the coordinator
// reconciles it with W1's route. Unavailable = no penalty, same rule as X.
export type SourceWalletTrace = {
  available: boolean;
  /** The dev/creator wallet being traced. */
  devWallet: string | null;
  /** Wallet that directly funded the dev wallet, null when untraced. */
  fundedBy: string | null;
  /** Hops walked from the dev wallet to the root source wallet. */
  fundingHops: number | null;
  /** Root funding wallet (funding source behind the dev wallet). */
  sourceWallet: string | null;
  /** Tokens launched from wallets funded by this same source. */
  sourceTokensCreated: number | null;
  /** Other mints launched from the same source wallet. */
  sourceOtherLaunches: string[] | null;
  note?: string | null;
};

/**
 * Source-trace score adjustment. Weights: source behind ≥5 launches −3,
 * 2–4 launches −1, 0–1 launches 0, unavailable 0. A fresh wallet funded by
 * a serial launcher's source is the same risk as the serial launcher.
 */
export function sourceTraceAdjustment(trace: SourceWalletTrace | null | undefined): number {
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

// ── Coordinator adapters: W1/W2 raw shapes → scoring inputs ─────────────────
// W1's bundle.ts BundleAnalysis (state/clusters/risk) and W2's xintel.ts
// XIntel (per-signal XSignal objects) are the live shapes; the scoring
// inputs above are the narrow shapes the adjustments consume. Adapters are
// pure and unit-tested — an unavailable scan maps to "no information", never
// to a clean bill of health.

/** W1 bundle scan → scoring input. Unknown/partial maps to available:false when the scan never completed; partial keeps its numbers with a note. */
export function adaptBundleAnalysis(raw: RawBundleAnalysis | null | undefined): BundleAnalysis | null {
  if (!raw) return null;
  if (raw.state === "unknown") {
    return { available: false, bundledSupplyPct: null, clusterCount: null, largestClusterPct: null, bundleRisk: null, note: raw.reason ?? "Bundle scan unavailable." };
  }
  const largest = raw.clusters.reduce((m, c) => Math.max(m, Number.isFinite(c.supplyPct) ? c.supplyPct : 0), 0);
  const risk: BundleRiskLevel | null =
    raw.risk === "high" ? "high" : raw.risk === "medium" ? "moderate" : raw.risk === "low" || raw.risk === "none" ? "low" : null;
  return {
    available: true,
    bundledSupplyPct: raw.bundledSupplyPct,
    clusterCount: raw.clusterCount,
    largestClusterPct: raw.clusters.length > 0 ? largest : null,
    bundleRisk: risk,
    note: raw.state === "partial" ? `Partial scan — ${raw.holdersTraced} of ${raw.holdersAnalyzed} holders traced.${raw.reason ? ` ${raw.reason}` : ""}` : null,
  };
}

/** W2 X intel → scoring input. Mentions/KOL/sentiment have no real source in this stack, so they are always null here — never estimated. Sentiment is null, so the X adjustment is 0 unless a future source provides real text. */
export function adaptXIntel(raw: RawXIntel | null | undefined): XIntel | null {
  if (!raw) return null;
  const linked = raw.linkedAccount.status === "available" ? raw.linkedAccount.value ?? null : null;
  const profile = raw.profile.status === "available" ? raw.profile.value ?? null : null;
  return {
    availability: linked ? "available" : "unavailable",
    handle: linked?.handle ?? null,
    followers: profile?.followers ?? null,
    mentions24h: null,
    kolMentions: null,
    sentiment: null,
    accountAgeDays: profile?.accountAgeDays ?? null,
    note: linked
      ? `Linked X account @${linked.handle} confirmed by ${linked.sources.join(" + ")}.${profile ? "" : " Profile enrichment unavailable (no X Bearer token configured)."}`
      : raw.linkedAccount.detail ?? "No linked X account found.",
  };
}

/** Dev-source trace derived from W1's bundle scan: a dev-linked cluster's funding source is the source behind the dev wallet. No dev-linked cluster → unavailable, never invented. */
export function adaptSourceTrace(raw: RawBundleAnalysis | null | undefined): SourceWalletTrace | null {
  if (!raw || raw.state === "unknown") return null;
  const devCluster = raw.clusters.find((c) => c.devLinked);
  const devWallet = raw.creator ?? null;
  if (!devWallet && !devCluster) return null;
  const fundedBy = devCluster?.fundingSource ?? null;
  const otherLaunches = devCluster?.sourceOtherLaunches ?? null;
  return {
    available: true,
    devWallet,
    fundedBy,
    fundingHops: fundedBy ? 1 : null,
    sourceWallet: fundedBy,
    sourceTokensCreated: otherLaunches,
    sourceOtherLaunches: null,
    note: devCluster
      ? `Dev-linked cluster funded by ${fundedBy ? fundedBy.slice(0, 8) : "an untraced source"}${otherLaunches != null ? ` — that source is behind ${otherLaunches} other launch${otherLaunches === 1 ? "" : "es"}` : ""}.`
      : "No dev-linked funding cluster detected.",
  };
}

// ── Dev-wallet tracking (forensics + live wallet route) ──────────────────────
// Forensics already attributes the creator wallet, its current holding,
// rank, sold flag and serial flag (see web/api/ogdex/_routes/_forensics.js).
// What was missing: the wallet's LIVE position — SOL balance, total USD,
// token count, recent trade count — which useTokenIntel now fetches
// best-effort from the existing /api/ogdex/wallet route (see client.ts).
export type { DevWalletIntel } from "../api/client";

/** Dev wallet → human verdict from forensics + live wallet intel. */
export function devWalletVerdict(
  dev: ForensicsPayload["dev"],
  walletIntel: DevWalletIntel | null | undefined,
): { state: VerdictState; label: string; detail: string } {
  if (!dev?.wallet) {
    return { state: "unknown", label: "Unknown", detail: "No deployer wallet attributed to this token." };
  }
  if (dev.sold === true) {
    return { state: "fail", label: "Dev exited", detail: "The deployer wallet no longer holds a meaningful position — it sold out." };
  }
  if (dev.serial === true) {
    return { state: "warn", label: "Serial deployer", detail: `This wallet has launched ${dev.tokensCreated ?? "multiple"} tokens — repeat launches, repeat risk.` };
  }
  if (dev.sold === false && walletIntel?.available === true) {
    return { state: "pass", label: "Dev still holding", detail: `Deployer holds ${walletIntel.holdingPctOfToken != null ? `${walletIntel.holdingPctOfToken.toFixed(2)}%` : "a position"} of supply and has not exited.` };
  }
  if (dev.sold === false) {
    return { state: "pass", label: "Dev still holding", detail: "Deployer wallet still holds a position." };
  }
  return { state: "unknown", label: "Unknown", detail: "Deployer wallet is known but its current position could not be confirmed." };
}

export type OgScoreCategory = {
  id: string;
  label: string;
  points: number;
  max: number;
  note: string;
};

export type OgScoreAdjustment = {
  id: "bundle" | "x" | "source-trace";
  label: string;
  /** Signed points, e.g. −5. Zero adjustments are omitted. */
  points: number;
};

export type OgScore = {
  /** 0–100, higher = safer. Null when there is no evidence at all. */
  score: number | null;
  band: string;
  label: string;
  categories: OgScoreCategory[];
  caps: string[];
  unknowns: string[];
  /** Post-category adjustments (bundle / X / source-trace). Empty when none apply. */
  adjustments: OgScoreAdjustment[];
};

export function ogScoreBand(score: number | null): { band: string; label: string } {
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
 */
export function computeOgScore(input: OgScoreInput): OgScore {
  const cats: OgScoreCategory[] = [];
  const caps: string[] = [];
  const unknowns: string[] = [];
  let evidence = 0;

  // Contract — 25
  let pts = 0;
  if (input.mintRenounced === true) { pts += 13; evidence++; }
  else if (input.mintRenounced === false) { evidence++; }
  else unknowns.push("Mint authority");
  if (input.freezeRenounced === true) { pts += 12; evidence++; }
  else if (input.freezeRenounced === false) { evidence++; }
  else unknowns.push("Freeze authority");
  unknowns.push("Mutable metadata", "Token program"); // no source reports these
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
  const adjustments: OgScoreAdjustment[] = [];
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

// ── Team A (scanner v2): funding chain / dev history / same-dev / tape ─────
// New intel fields (see TokenIntelState). Every field is nullable: null means
// "not loaded yet OR could not be observed" — the server payload's `state` +
// `reason` say which. Nothing here is ever invented; a missing signal simply
// does not move the live risk score (see buildRiskLive).

export type { DevHistory, FundingChain, RiskLive, SameDevResult, TradeTapeEntry, WhaleAlert };

/**
 * Live risk score, recomputed from the intel available RIGHT NOW. Callers
 * (the hook's useMemo below) re-run this every time a new intel field lands
 * — bundle, dev history, same-dev, tape — so the score moves as evidence
 * arrives instead of freezing at first paint. Returns null when there is no
 * evidence at all (all inputs unknown/unloaded): an unscored token is
 * "unknown", never a made-up 100 or 0.
 *
 * Scoring (see computeLiveRisk in shared/bundle-analysis.js): base 100,
 * higher = safer. Deductions: bundled supply ≥30% −25 / ≥15% −15 / ≥5% −5;
 * dev-linked ≥20% −15 / ≥10% −8; same-dev flagged −20; each prior rugged
 * token from the same source −10 (cap −20); whale sells outweighing buys
 * −5/−10. A same-dev result in state "unknown" counts as no evidence — an
 * unchecked history is never treated as a clean one.
 */
export function buildRiskLive(input: {
  bundle: RawBundleAnalysis | null | undefined;
  devHistory: DevHistory | null | undefined;
  sameDev: SameDevResult | null | undefined;
  tradeTape: TradeTapeEntry[] | null | undefined;
  whaleAlerts: WhaleAlert[] | null | undefined;
}): RiskLive | null {
  const bundle = input.bundle ?? null;
  const sameDev = input.sameDev ?? null;
  const sameDevChecked = sameDev != null && sameDev.state !== "unknown";
  // Distinct rugged priors across the same-dev result AND the dev wallet's
  // own history (the same-dev walk caps sources at 5, so the hook's direct
  // dev-history lookup can surface a rugged prior the walk missed).
  const ruggedMints = new Set<string>();
  if (sameDevChecked) {
    for (const t of sameDev.priorTokens ?? []) {
      if (t.outcome === "rugged") ruggedMints.add(t.mint);
    }
  }
  for (const t of input.devHistory?.tokens ?? []) {
    if (t.outcome === "rugged") ruggedMints.add(t.mint);
  }
  const whales = input.whaleAlerts ?? null;
  const { score, factors } = computeLiveRisk({
    bundledSupplyPct: bundle?.state === "unknown" ? null : bundle?.bundledSupplyPct ?? null,
    devLinkedPct: bundle?.state === "unknown" ? null : bundle?.devLinkedPct ?? null,
    sameDevFlagged: sameDevChecked ? sameDev.flagged : undefined,
    ruggedPriorCount: ruggedMints.size,
    whaleSellUsd: whales?.length
      ? whales.filter((w) => w.side === "sell").reduce((s, w) => s + (w.amountUsd || 0), 0)
      : null,
    whaleBuyUsd: whales?.length
      ? whales.filter((w) => w.side === "buy").reduce((s, w) => s + (w.amountUsd || 0), 0)
      : null,
  });
  if (score == null) return null;
  return { score, updatedAt: new Date().toISOString(), factors };
}

// ── Team A wave 3 (B2–B6): pure intel builders ───────────────────────────────
// Every builder below is pure (inputs in, value out) and unit-tested in
// scanner-forensics.test.ts. Unknown is always null / "unknown" — a missing
// signal is never rendered as a clean bill of health.

export type SniperRadarEntry = {
  wallet: string;
  /** Block of the first buy — no block source exists in this stack. */
  firstBuyBlock: number | null;
  firstBuyAt: number | null;
  /** SOL spent on the first buy — unobservable from holder traces. */
  amountSol: number | null;
  supplyPctNow: number | null;
  /** Whether the sniper has since dumped — unobservable per holder. */
  dumped: boolean | null;
  soldPct: number | null;
};

/** Snipers = top holders whose first observed buy landed within 60s of pair
 *  creation. Needs pairCreatedAt; without it the radar is empty (no anchor,
 *  not "no snipers"). */
export function buildSniperRadar(
  traces: HolderTrace[] | null | undefined,
  pairCreatedAt: number | null | undefined,
): SniperRadarEntry[] {
  if (!traces?.length || pairCreatedAt == null) return [];
  return traces
    .filter(
      (t) =>
        t.firstBuyAtMs != null &&
        t.firstBuyAtMs >= pairCreatedAt &&
        t.firstBuyAtMs - pairCreatedAt <= 60_000,
    )
    .sort((a, b) => (a.firstBuyAtMs ?? 0) - (b.firstBuyAtMs ?? 0))
    .map((t) => ({
      wallet: t.address,
      firstBuyBlock: null,
      firstBuyAt: t.firstBuyAtMs,
      amountSol: null,
      supplyPctNow: t.supplyPct ?? null,
      dumped: null,
      soldPct: null,
    }));
}

export type LiquidityHealth = {
  lpDepthUsd: number | null;
  /** Share of LP burned — no burn registry is read in this stack. */
  burnedPct: number | null;
  lockedPct: number | null;
  /** Lock expiry — no locker schedule is read in this stack. */
  lockExpiry: string | null;
  canDevPull: "yes" | "no" | "unknown";
  canDevPullReason: string;
};

/** LP health from observed depth + lock %. Burned share and lock expiry
 *  are unobserved (null), never assumed 0 / never. */
export function buildLiquidityHealth(
  liquidityUsd: number | null | undefined,
  lpLockedPct: number | null | undefined,
): LiquidityHealth {
  const locked = typeof lpLockedPct === "number" && Number.isFinite(lpLockedPct) ? lpLockedPct : null;
  let canDevPull: LiquidityHealth["canDevPull"] = "unknown";
  let canDevPullReason = "LP lock status unknown — pullability cannot be determined.";
  if (locked != null) {
    if (locked >= 90) {
      canDevPull = "no";
      canDevPullReason = `LP ${Math.round(locked)}% locked — the dev cannot pull the locked share.`;
    } else if (locked <= 0) {
      canDevPull = "yes";
      canDevPullReason = "LP unlocked (0%) — the dev can remove liquidity at any time.";
    } else {
      canDevPull = "unknown";
      canDevPullReason = `LP only ${Math.round(locked)}% locked — pullability depends on the locker terms, which are not read here.`;
    }
  }
  return {
    lpDepthUsd: typeof liquidityUsd === "number" && Number.isFinite(liquidityUsd) ? liquidityUsd : null,
    burnedPct: null,
    lockedPct: locked,
    lockExpiry: null,
    canDevPull,
    canDevPullReason,
  };
}

export type DevFingerprintEntry = {
  pattern: string;
  evidence: string;
  confidence: "low" | "medium" | "high";
  linkedWallets: string[];
};

/**
 * Dev fingerprint: one entry per observed behavioural pattern. Confidence
 * is "high" ONLY when the pattern is corroborated by >= 2 independent
 * signals (e.g. serial launches AND a dev-linked bundle); a lone signal
 * caps at "medium" no matter how strong it looks.
 */
export function buildDevFingerprint(input: {
  dev: ForensicsPayload["dev"];
  bundle: RawBundleAnalysis | null | undefined;
  sameDev: SameDevResult | null | undefined;
}): DevFingerprintEntry[] {
  const { dev, bundle, sameDev } = input;
  const entries: DevFingerprintEntry[] = [];
  const devWallet = dev?.wallet ?? bundle?.creator ?? null;
  if (dev?.serial === true) {
    entries.push({
      pattern: "serial-deployer",
      evidence: `Deployer wallet has launched ${dev.tokensCreated ?? "multiple"} tokens.`,
      confidence: "medium",
      linkedWallets: devWallet ? [devWallet] : [],
    });
  }
  if (dev?.sold === true) {
    entries.push({
      pattern: "dev-exited",
      evidence: "Deployer wallet no longer holds a meaningful position — it sold out.",
      confidence: "medium",
      linkedWallets: devWallet ? [devWallet] : [],
    });
  }
  const devLinkedPct = bundle?.devLinkedPct;
  if (typeof devLinkedPct === "number" && devLinkedPct > 0) {
    entries.push({
      pattern: "dev-linked-bundle",
      evidence: `${devLinkedPct}% of supply sits in wallets linked to the deployer (creator or funded by the creator).`,
      confidence: "medium",
      linkedWallets: (bundle?.devLinkedWallets ?? []).map((w) => w.address),
    });
  }
  if (sameDev?.flagged === true) {
    entries.push({
      pattern: "same-source-rug",
      evidence: `Dev traces via its funding chain to ${sameDev.sourceWallet ? `${sameDev.sourceWallet.slice(0, 8)}…` : "a source wallet"} behind ${sameDev.priorTokens.length} prior rugged token${sameDev.priorTokens.length === 1 ? "" : "s"}.`,
      confidence: "medium",
      linkedWallets: [
        ...(sameDev.sourceWallet ? [sameDev.sourceWallet] : []),
        ...sameDev.priorTokens.map((t) => t.viaWallet),
      ].filter((w, i, a) => a.indexOf(w) === i),
    });
  }
  const clusterSource = (bundle?.clusters ?? []).find(
    (c) => (c.sourceOtherLaunches ?? 0) >= 2,
  );
  if (clusterSource) {
    entries.push({
      pattern: "source-behind-launches",
      evidence: `A bundle funding source is behind ${clusterSource.sourceOtherLaunches} other launches.`,
      confidence: "medium",
      linkedWallets: clusterSource.fundingSource ? [clusterSource.fundingSource] : [],
    });
  }
  // Corroboration rule: >= 2 independent patterns → each pattern's
  // confidence promotes to high (they corroborate each other).
  if (entries.length >= 2) {
    for (const e of entries) e.confidence = "high";
  }
  return entries;
}

export type RugTimelineEntry = {
  /** Block time of the flag, ms epoch. Null = dateless — rendered as
   *  "time unknown" and sorted last. */
  at: number | null;
  flag: string;
  severity: "info" | "warn" | "critical";
  source: string;
};

/** Rug timeline from observed flags. No flag in this stack carries a
 *  timestamp, so every entry is dateless ("time unknown") and sorted by
 *  severity, critical first. */
export function buildRugTimeline(input: {
  forensics: ForensicsPayload | null | undefined;
  safety: SafetyPayload | null | undefined;
  bundle: RawBundleAnalysis | null | undefined;
  sameDev: SameDevResult | null | undefined;
}): RugTimelineEntry[] {
  const { forensics, safety, bundle, sameDev } = input;
  const out: RugTimelineEntry[] = [];
  const flags = forensics?.safetyFlags;
  if (flags?.rugged === true) {
    out.push({ at: null, flag: "Flagged rugged — LP removed or rug reported", severity: "critical", source: "forensics" });
  }
  if (flags?.mintRenounced === false) {
    out.push({ at: null, flag: "Mint authority live — supply can be increased", severity: "warn", source: "forensics" });
  }
  if (flags?.freezeRenounced === false) {
    out.push({ at: null, flag: "Freeze authority live — wallets can be frozen", severity: "warn", source: "forensics" });
  }
  if (forensics?.dev?.sold === true) {
    out.push({ at: null, flag: "Deployer exited their position", severity: "warn", source: "forensics" });
  }
  if (forensics?.dev?.serial === true) {
    out.push({ at: null, flag: "Serial deployer — repeat launches from this wallet", severity: "info", source: "forensics" });
  }
  if (safety?.canSell === false) {
    out.push({ at: null, flag: "No sell route — honeypot-style, buys route but sells do not", severity: "critical", source: "safety" });
  }
  const bundled = bundle?.bundledSupplyPct;
  if (typeof bundled === "number" && bundled >= 30) {
    out.push({ at: null, flag: `High bundle risk — ${bundled}% of supply in coordinated clusters`, severity: "critical", source: "bundle" });
  } else if (typeof bundled === "number" && bundled >= 15) {
    out.push({ at: null, flag: `Moderate bundle risk — ${bundled}% of supply clustered`, severity: "warn", source: "bundle" });
  }
  if (sameDev?.flagged === true) {
    out.push({ at: null, flag: "Dev traces to a source behind a prior rugged token", severity: "critical", source: "same-dev" });
  }
  const rank = { critical: 0, warn: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// ── B3 ───────────────────────────────────────────────────────────────────────

export type TokenDna = {
  templateMatches: Array<{ template: string; matchPct: number; evidence: string[] }>;
  /** Best-matching template, or "insufficient data" when nothing was
   *  observed well enough to score a template. */
  verdict: string;
};

/** Token DNA: match the token against known launch templates. Each
 *  template scores only on its observed signals (mean of 0–100 signal
 *  scores); a template with no observed signal is omitted, never scored 0. */
export function buildTokenDna(input: {
  forensics: ForensicsPayload | null | undefined;
  bundle: RawBundleAnalysis | null | undefined;
  sameDev: SameDevResult | null | undefined;
  safety: SafetyPayload | null | undefined;
}): TokenDna {
  const { forensics, bundle, sameDev, safety } = input;
  const matches: TokenDna["templateMatches"] = [];
  const avg = (xs: number[]): number | null =>
    xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null;

  const pumpSignals: number[] = [];
  const pumpEvidence: string[] = [];
  if (forensics?.isPumpFun === true) {
    pumpSignals.push(100);
    pumpEvidence.push("Launched on pump.fun");
  } else if (forensics?.isPumpFun === false) {
    pumpSignals.push(0);
    pumpEvidence.push("Not a pump.fun launch");
  }
  if (forensics?.bondingComplete === true) {
    pumpSignals.push(100);
    pumpEvidence.push("Bonding curve complete (graduated)");
  } else if (forensics?.bondingComplete === false) {
    pumpSignals.push(50);
    pumpEvidence.push("Still on the bonding curve");
  }
  const pumpPct = avg(pumpSignals);
  if (pumpPct != null) matches.push({ template: "pump.fun standard launch", matchPct: pumpPct, evidence: pumpEvidence });

  const serialSignals: number[] = [];
  const serialEvidence: string[] = [];
  if (forensics?.dev?.serial === true) {
    serialSignals.push(100);
    serialEvidence.push(`Deployer launched ${forensics.dev.tokensCreated ?? "multiple"} tokens`);
  } else if (forensics?.dev?.serial === false) {
    serialSignals.push(0);
    serialEvidence.push("Deployer has no prior launches on record");
  }
  if (sameDev?.flagged === true) {
    serialSignals.push(100);
    serialEvidence.push("Dev traces to a source behind a prior rugged token");
  } else if (sameDev && sameDev.state !== "unknown") {
    serialSignals.push(0);
    serialEvidence.push("No rugged prior linked to the dev's funding source");
  }
  const serialPct = avg(serialSignals);
  if (serialPct != null) matches.push({ template: "serial-launcher replay", matchPct: serialPct, evidence: serialEvidence });

  const bundled = bundle?.bundledSupplyPct;
  if (typeof bundled === "number") {
    const pct = bundled >= 30 ? 100 : bundled >= 15 ? 70 : bundled >= 5 ? 40 : bundled > 0 ? 15 : 0;
    matches.push({ template: "bundle-heavy launch", matchPct: pct, evidence: [`${bundled}% of supply in coordinated clusters`] });
  }
  const top10 = forensics?.concentration?.top10Pct;
  if (typeof top10 === "number") {
    const pct = top10 <= 20 ? 100 : top10 <= 35 ? 70 : top10 <= 50 ? 40 : 10;
    matches.push({ template: "wide distribution", matchPct: pct, evidence: [`Top 10 hold ${top10.toFixed(1)}% of supply`] });
  }
  if (safety?.canSell === false) {
    matches.push({ template: "honeypot-style", matchPct: 100, evidence: ["Buy route exists but no sell route could be found"] });
  } else if (safety?.canSell === true) {
    matches.push({ template: "honeypot-style", matchPct: 0, evidence: ["Sell route open — round-trip quote succeeded"] });
  }

  matches.sort((a, b) => b.matchPct - a.matchPct);
  const best = matches[0];
  return {
    templateMatches: matches,
    verdict: best && best.matchPct >= 50 ? best.template : "insufficient data",
  };
}

export type Graduation = {
  /** % of the ~$69k pump.fun graduation market-cap threshold reached. */
  progressPct: number;
  marketCapUsd: number | null;
  /** Migration timestamp — no source reports it, always null. */
  migrationAt: number | null;
  migrated: boolean | null;
  source: "pumpfun";
} | null;

/**
 * Pump.fun graduation. Non-pump.fun tokens return null ("not_pumpfun").
 * Progress = market cap / $69,000 (the approximate bonding-curve
 * graduation threshold), capped at 100.
 */
export function buildGraduation(input: {
  dexPairs: DexPair[] | null | undefined;
  research: ResearchPayload | null | undefined;
  token: TokenPayload | null | undefined;
  isPumpFun: boolean | null | undefined;
}): Graduation {
  const { dexPairs, research, token, isPumpFun } = input;
  const isPump =
    isPumpFun === true ||
    (dexPairs ?? []).some((p) => p.dexId === "pumpfun" || p.dexId === "pumpswap") ||
    (research?.launch?.platform ?? "").toLowerCase().includes("pump");
  if (!isPump) return null;
  const mcapRaw = Number(token?.marketCap ?? token?.mcap ?? NaN);
  const pairMcap = (dexPairs ?? []).map((p) => p.marketCap ?? NaN).find((v) => Number.isFinite(v));
  const mcap = Number.isFinite(mcapRaw) ? mcapRaw : Number.isFinite(pairMcap) ? (pairMcap as number) : null;
  const progressPct = mcap == null ? 0 : Math.min(100, Math.round((mcap / 69_000) * 1000) / 10);
  return {
    progressPct,
    marketCapUsd: mcap,
    migrationAt: null,
    migrated: research?.launch?.graduated ?? null,
    source: "pumpfun",
  };
}

export type ContractDiff = {
  /** True when the token matches the standard pump.fun template (pump.fun
   *  origin + both authorities revoked). Null when origin is unknown. */
  isStandardPumpfun: boolean | null;
  diffs: Array<{ area: string; detail: string }>;
  source: string;
};

/** Contract diff vs the standard pump.fun template, from forensics flags. */
export function buildContractDiff(forensics: ForensicsPayload | null | undefined): ContractDiff {
  const diffs: ContractDiff["diffs"] = [];
  const flags = forensics?.safetyFlags;
  if (flags?.mintRenounced === false) {
    diffs.push({ area: "mint-authority", detail: "Mint authority live — supply can be increased after launch." });
  }
  if (flags?.freezeRenounced === false) {
    diffs.push({ area: "freeze-authority", detail: "Freeze authority live — wallets can be frozen." });
  }
  if (flags?.lpLockedPct != null && flags.lpLockedPct <= 0) {
    diffs.push({ area: "lp-lock", detail: "Liquidity pool unlocked (0% locked)." });
  }
  if (flags?.rugged === true) {
    diffs.push({ area: "rugged-flag", detail: "Token is flagged rugged." });
  }
  let isStandardPumpfun: boolean | null = null;
  if (forensics?.isPumpFun === true) {
    isStandardPumpfun =
      flags?.mintRenounced === true && flags?.freezeRenounced === true
        ? true
        : flags?.mintRenounced === false || flags?.freezeRenounced === false
          ? false
          : null;
  }
  return { isStandardPumpfun, diffs, source: "forensics" };
}

export type Copycat = {
  mint: string;
  chain: "solana";
  name: string | null;
  symbol: string | null;
  marketCapUsd: number | null;
};

/** Copycats = same-name/symbol clones from the research endpoint, which
 *  searches by name — the "name searched sources" are DexScreener
 *  same-name search results. */
export function buildCopycats(research: ResearchPayload | null | undefined): Copycat[] {
  return (research?.clones ?? []).map((c) => ({
    mint: c.mint ?? "",
    chain: "solana" as const,
    name: c.name ?? null,
    symbol: c.symbol ?? null,
    marketCapUsd: c.mcap ?? null,
  })).filter((c) => c.mint);
}

export type HolderConviction = {
  /** Mean hold time (days) across holders with a known first buy. */
  avgHoldDays: number | null;
  holders: Array<{ wallet: string; firstBuyAt: number | null; holdDays: number | null; label: "diamond" | "paper" | "unknown" }>;
};

/**
 * Holder conviction from first-buy times. Thresholds (documented):
 * diamond = first buy >= 30 days ago; paper = first buy < 30 days ago;
 * unknown = first-buy time unobserved.
 */
export function buildHolderConviction(
  traces: HolderTrace[] | null | undefined,
  nowMs: number = Date.now(),
): HolderConviction {
  const holders = (traces ?? []).map((t) => {
    const holdDays =
      t.firstBuyAtMs != null ? Math.max(0, Math.floor((nowMs - t.firstBuyAtMs) / 86_400_000)) : null;
    return { wallet: t.address, firstBuyAt: t.firstBuyAtMs ?? null, holdDays, label: convictionLabel(holdDays) };
  });
  const known = holders.map((h) => h.holdDays).filter((d): d is number => d != null);
  return {
    avgHoldDays: known.length ? Math.round((known.reduce((s, d) => s + d, 0) / known.length) * 10) / 10 : null,
    holders,
  };
}

export type WhaleLabel = { wallet: string; labels: string[] };

/**
 * Whale labels — evidence only. A label is attached only when its evidence
 * was observed: "whale" (top-holder share >= 1% or a >= $5k tape trade),
 * "bundle-member" (in a detected cluster), "dev-linked" (creator / funded
 * by creator), "sniper" (first buy within 60s of pair creation).
 */
export function buildWhaleLabels(input: {
  bundle: RawBundleAnalysis | null | undefined;
  tape: TradeTapeEntry[] | null | undefined;
  pairCreatedAt: number | null | undefined;
}): WhaleLabel[] {
  const { bundle, tape, pairCreatedAt } = input;
  const labels = new Map<string, Set<string>>();
  const add = (wallet: string, label: string) => {
    if (!labels.has(wallet)) labels.set(wallet, new Set());
    labels.get(wallet)!.add(label);
  };
  for (const t of bundle?.traces ?? []) {
    if ((t.supplyPct ?? 0) >= 1) add(t.address, "whale");
    if (t.devLinked) add(t.address, "dev-linked");
    if (
      pairCreatedAt != null &&
      t.firstBuyAtMs != null &&
      t.firstBuyAtMs >= pairCreatedAt &&
      t.firstBuyAtMs - pairCreatedAt <= 60_000
    ) {
      add(t.address, "sniper");
    }
  }
  for (const c of bundle?.clusters ?? []) {
    for (const m of c.members) add(m.address, "bundle-member");
  }
  for (const t of tape ?? []) {
    if (t.sizeUsd >= 5000) add(t.wallet, "whale");
  }
  return [...labels.entries()]
    .map(([wallet, set]) => ({ wallet, labels: [...set].sort() }))
    .filter((e) => e.labels.length > 0);
}

export type RugLeaderboard = {
  entries: Array<{
    mint: string;
    name: string | null;
    symbol: string | null;
    dangerScore: number;
    topFlags: string[];
    launchedAt: number | null;
  }>;
  /** Prior tokens that could not be scored (outcome unknown) — counted,
   *  not ranked. */
  unscorableCount: number;
};

/**
 * Rug leaderboard: the dev's prior tokens (dev history + same-dev priors),
 * ranked by danger score (rugged 100 / dead 60 / alive 20). The scanned
 * mint itself is excluded. Unknown-outcome priors are excluded from the
 * board and counted in unscorableCount.
 */
export function buildRugLeaderboard(input: {
  devHistory: DevHistory | null | undefined;
  sameDev: SameDevResult | null | undefined;
  mint: string | null | undefined;
}): RugLeaderboard {
  const { devHistory, sameDev, mint } = input;
  const byMint = new Map<string, { mint: string; name: string | null; launchedAt: number | null; outcome: string }>();
  for (const t of devHistory?.tokens ?? []) {
    if (t.mint === mint) continue;
    byMint.set(t.mint, { mint: t.mint, name: t.name ?? null, launchedAt: t.launchedAt ?? null, outcome: t.outcome });
  }
  for (const t of sameDev?.priorTokens ?? []) {
    if (t.mint === mint) continue;
    if (!byMint.has(t.mint)) {
      byMint.set(t.mint, { mint: t.mint, name: t.name ?? null, launchedAt: t.launchedAt ?? null, outcome: t.outcome });
    }
  }
  const entries: RugLeaderboard["entries"] = [];
  let unscorableCount = 0;
  for (const t of byMint.values()) {
    const score = dangerScoreForOutcome(t.outcome as "alive" | "dead" | "rugged" | "unknown");
    if (score == null) {
      unscorableCount += 1;
      continue;
    }
    entries.push({
      mint: t.mint,
      name: t.name,
      symbol: null,
      dangerScore: score,
      topFlags:
        t.outcome === "rugged"
          ? ["LP removed — rugged"]
          : t.outcome === "dead"
            ? ["No 24h activity — dead"]
            : [],
      launchedAt: t.launchedAt,
    });
  }
  entries.sort((a, b) => b.dangerScore - a.dangerScore || (b.launchedAt ?? 0) - (a.launchedAt ?? 0));
  return { entries, unscorableCount };
}

// ── B4 ───────────────────────────────────────────────────────────────────────

export type FreshWalletRadarEntry = {
  wallet: string;
  firstSeenAt: number | null;
  boughtAt: number | null;
  /** SOL spent — unobservable from holder traces. */
  amountSol: number | null;
  /** True when dev-linked, false when traced and not dev-linked, null
   *  when the wallet was never traced. */
  fundedByDevSource: boolean | null;
  fundingChain: string[];
};

/**
 * Fresh-wallet radar: top holders whose first buy landed within 10 minutes
 * of pair creation. firstSeenAt is the first *token* buy — a lower bound
 * on wallet age, not the wallet's first transaction (see walletAges).
 */
export function buildFreshWalletRadar(
  traces: HolderTrace[] | null | undefined,
  pairCreatedAt: number | null | undefined,
): FreshWalletRadarEntry[] {
  if (!traces?.length || pairCreatedAt == null) return [];
  return traces
    .filter(
      (t) =>
        t.firstBuyAtMs != null &&
        t.firstBuyAtMs >= pairCreatedAt &&
        t.firstBuyAtMs - pairCreatedAt <= 600_000,
    )
    .sort((a, b) => (a.firstBuyAtMs ?? 0) - (b.firstBuyAtMs ?? 0))
    .map((t) => ({
      wallet: t.address,
      firstSeenAt: t.firstBuyAtMs,
      boughtAt: t.firstBuyAtMs,
      amountSol: null,
      fundedByDevSource: t.devLinked ? true : t.traced ? false : null,
      fundingChain: t.fundingChain ?? [t.address],
    }));
}

export type LpMigration = {
  movements: Array<{ at: number | null; fromPool: string; toPool: string; amountUsd: number | null }>;
  lastCheckedAt: string;
};

/** LP migration: consecutive DexScreener pairs on different DEXes, ordered
 *  by creation — e.g. pumpfun → raydium is the graduation migration. One
 *  pair (or pairs on one DEX) means no observed migration. */
export function buildLpMigration(
  dexPairs: DexPair[] | null | undefined,
  nowIso: string = new Date().toISOString(),
): LpMigration {
  const pairs = (dexPairs ?? [])
    .filter((p) => p.dexId && p.pairCreatedAt != null)
    .sort((a, b) => (a.pairCreatedAt ?? 0) - (b.pairCreatedAt ?? 0));
  const movements: LpMigration["movements"] = [];
  for (let i = 1; i < pairs.length; i += 1) {
    const prev = pairs[i - 1];
    const cur = pairs[i];
    if (prev.dexId !== cur.dexId) {
      movements.push({
        at: cur.pairCreatedAt ?? null,
        fromPool: prev.dexId as string,
        toPool: cur.dexId as string,
        amountUsd: cur.liquidityUsd ?? null,
      });
    }
  }
  return { movements, lastCheckedAt: nowIso };
}

export type MetadataAudit = {
  /** Metadata mutability — no metadata account is read in this stack. */
  mutable: boolean | null;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  /** Set only from a real fetch of imageUrl (hook effect); null = unchecked. */
  imageOk: boolean | null;
  issues: string[];
};

/** Metadata audit. imageOk comes from the hook's real image fetch — this
 *  builder only assembles the static fields + issue list. */
export function buildMetadataAudit(
  token: TokenPayload | null | undefined,
  imageOk: boolean | null,
): MetadataAudit {
  const issues: string[] = [];
  if (token?.image) {
    if (imageOk === false) issues.push("Image URL does not load — logo may be dead or blocked.");
    if (imageOk === null) issues.push("Image URL not yet checked.");
  } else {
    issues.push("No image URL in token metadata.");
  }
  issues.push("Metadata mutability unverified — no Metaplex metadata account is read in this stack.");
  if (!token?.name) issues.push("Token name missing.");
  if (!token?.symbol) issues.push("Token symbol missing.");
  return {
    mutable: null,
    name: token?.name ?? null,
    symbol: token?.symbol ?? null,
    imageUrl: token?.image ?? null,
    imageOk,
    issues,
  };
}

export type EntryExitPlanner = {
  maxBuyUsdFor1Pct: number | null;
  maxSellUsdFor1Pct: number | null;
  depthUsd: number | null;
  model: string;
};

/** Entry/exit planner — wraps the shared CPAMM 1% model. */
export function buildEntryExitPlanner(liquidityUsd: number | null | undefined): EntryExitPlanner {
  return entryExitFor1Pct(liquidityUsd ?? null);
}

export type RugAutopsy = {
  mint: string;
  name: string | null;
  verdict: "rugged";
  timeline: RugTimelineEntry[];
  rootCause: string;
  lessons: string[];
  sources: string[];
} | null;

/** Rug autopsy — only when forensics flags the token rugged; otherwise
 *  null ("not_rugged"). The root cause is the first critical timeline flag. */
export function buildRugAutopsy(input: {
  mint: string | null | undefined;
  token: TokenPayload | null | undefined;
  forensics: ForensicsPayload | null | undefined;
  timeline: RugTimelineEntry[];
}): RugAutopsy {
  const { mint, token, forensics, timeline } = input;
  if (forensics?.safetyFlags?.rugged !== true || !mint) return null;
  const critical = timeline.find((t) => t.severity === "critical");
  return {
    mint,
    name: token?.name ?? null,
    verdict: "rugged",
    timeline,
    rootCause: critical?.flag ?? "Flagged rugged by forensics.",
    lessons: [
      "Check LP lock % before buying — unlocked LP can be removed at any time.",
      "Check whether the deployer still holds; an exited dev is a warning sign.",
      "Check bundled supply — coordinated clusters can dump together.",
    ],
    sources: ["forensics"],
  };
}

// ── B5 ───────────────────────────────────────────────────────────────────────

export type DevWalletWatchEntry = {
  wallet: string;
  /** Last-tx time — the wallet route reports no last-tx timestamp. */
  lastTxAt: number | null;
  lastAction: "buy" | "sell" | "transfer" | "none" | "unknown";
  lastAmountUsd: number | null;
  /** True when the dev is known to have moved since the scan (sold out). */
  movedSinceScan: boolean | null;
};

/** Dev-wallet watch: one entry per known dev wallet. lastTxAt /
 *  lastAmountUsd are unobserved (null); lastAction is "sell" only when
 *  forensics confirms the dev sold, else "unknown". */
export function buildDevWalletWatch(
  devWallet: DevWalletIntel | null | undefined,
  forensics: ForensicsPayload | null | undefined,
): DevWalletWatchEntry[] {
  const wallet = forensics?.dev?.wallet ?? devWallet?.wallet ?? null;
  if (!wallet) return [];
  const sold = forensics?.dev?.sold;
  return [
    {
      wallet,
      lastTxAt: null,
      lastAction: sold === true ? "sell" : "unknown",
      lastAmountUsd: null,
      movedSinceScan: sold === true ? true : sold === false ? false : null,
    },
  ];
}

export type InsiderEntry = {
  wallet: string;
  boughtAt: number | null;
  boughtBefore: number | null;
  evidence: string;
};

/** Reason code when insiders cannot be anchored (the common case). */
export const INSIDERS_UNANCHORED_REASON = "no_announcement_time";

/**
 * Insiders = wallets that bought before a public announcement. Returns
 * null when there is no announcement timestamp to anchor on — which is
 * the case for every token in this stack (no announcement feed exists),
 * so the field is honestly null + "no_announcement_time" rather than a
 * guessed list.
 */
export function buildInsiders(input: {
  announcementAt: number | null | undefined;
  tape: TradeTapeEntry[] | null | undefined;
}): InsiderEntry[] | null {
  if (input.announcementAt == null) return null;
  return (input.tape ?? [])
    .filter((t) => t.side === "buy" && t.time != null && t.time < (input.announcementAt as number))
    .map((t) => ({
      wallet: t.wallet,
      boughtAt: t.time,
      boughtBefore: input.announcementAt as number,
      evidence: "Bought before the announcement time.",
    }));
}

export type UnlockSchedule = {
  allocations: Array<{
    holder: string;
    label: string;
    amountPct: number | null;
    unlockAt: number | null;
    cliffAt: number | null;
    vestedPct: number | null;
  }>;
  source: string;
} | null;

/** Reason code: no vesting/unlock data source exists for permissionless
 *  SPL mints in this stack. */
export const UNLOCK_SCHEDULE_UNAVAILABLE_REASON = "no_unlock_schedule_source";

/** Unlock schedule — always null: pump.fun / permissionless SPL tokens
 *  have no on-chain vesting schedule to read. */
export function buildUnlockSchedule(): UnlockSchedule {
  return null;
}

export type WashTrading = {
  score: number;
  pairs: Array<{ a: string; b: string; roundTrips: number; volumeUsd: number }>;
  verdict: string;
};

/** Wash trading — wraps the shared tape round-trip detector. */
export function buildWashTrading(tape: TradeTapeEntry[] | null | undefined): WashTrading {
  return detectWashTrading(tape ?? []);
}

export type SlippageEstimator = {
  /** Trade size the estimate is for (USD). */
  sizeUsd: number;
  estBuySlippagePct: number | null;
  estSellSlippagePct: number | null;
  model: string;
};

/** Slippage estimator for a $1,000 trade (documented default size) against
 *  deepest-pool liquidity, CPAMM model. Nulls when depth is unknown. */
export function buildSlippageEstimator(
  liquidityUsd: number | null | undefined,
  sizeUsd: number = 1000,
): SlippageEstimator {
  const { buyPct, sellPct } = slippageForSize(sizeUsd, liquidityUsd ?? null);
  return {
    sizeUsd,
    estBuySlippagePct: buyPct,
    estSellSlippagePct: sellPct,
    model: "constant-product: impact = size / (liquidity + size)",
  };
}

// ── B6 (client-side) ─────────────────────────────────────────────────────────

export type HoneypotFlip = {
  currentlyHoneypot: boolean | null;
  /** Prior honeypot flips — none observed (no prior observation exists). */
  flips: Array<{ at: number; from: boolean; to: boolean }>;
  lastCheckedAt: string;
};

/** Honeypot flip tracker. flips is empty on the first observation (there
 *  is no prior state to compare against); currentlyHoneypot comes from
 *  the live safety probe. */
export function buildHoneypotFlip(
  safety: SafetyPayload | null | undefined,
  nowIso: string = new Date().toISOString(),
): HoneypotFlip {
  const currentlyHoneypot =
    safety?.canBuy === true && safety?.canSell === false
      ? true
      : safety?.canSell === true
        ? false
        : null;
  return { currentlyHoneypot, flips: [], lastCheckedAt: nowIso };
}

export type AuthorityChange = {
  /** Mint authority renounced? (true = revoked). */
  mintAuthority: boolean | null;
  /** Freeze authority renounced? (true = revoked). */
  freezeAuthority: boolean | null;
  /** Authority changes — no history feed exists, so always empty. */
  changes: Array<{ at: number; field: string; from: string | null; to: string | null }>;
  lastCheckedAt: string;
};

/** Authority change tracker: current authorities from forensics; changes
 *  is empty because no authority-history feed exists in this stack. */
export function buildAuthorityChange(
  forensics: ForensicsPayload | null | undefined,
  nowIso: string = new Date().toISOString(),
): AuthorityChange {
  return {
    mintAuthority: forensics?.safetyFlags?.mintRenounced ?? null,
    freezeAuthority: forensics?.safetyFlags?.freezeRenounced ?? null,
    changes: [],
    lastCheckedAt: nowIso,
  };
}

export type CostBasisEntry = {
  wallet: string;
  /** Average entry price — unobservable (no per-holder buy history with
   *  prices), always null. */
  avgEntryPriceUsd: number | null;
  currentPriceUsd: number | null;
  unrealizedPnlPct: number | null;
  unrealizedPnlUsd: number | null;
  supplyPct: number | null;
};

/** Cost basis for top holders. Entry prices are unobservable, so PnL is
 *  null too — the field reports current price + supply share honestly
 *  instead of inventing an entry. */
export function buildCostBasis(
  traces: HolderTrace[] | null | undefined,
  priceUsd: number | null | undefined,
): CostBasisEntry[] {
  return (traces ?? []).map((t) => ({
    wallet: t.address,
    avgEntryPriceUsd: null,
    currentPriceUsd: typeof priceUsd === "number" && Number.isFinite(priceUsd) ? priceUsd : null,
    unrealizedPnlPct: null,
    unrealizedPnlUsd: null,
    supplyPct: t.supplyPct ?? null,
  }));
}

export type CexDeposits = {
  events: Array<{ at: number | null; fromWallet: string; toExchange: string; amountUsd: number | null }>;
  knownHotWallets: string[];
};

/**
 * CEX deposits: sends to known Binance / Coinbase / OKX / Bybit hot
 * wallets, matched against the embedded list. The list is EMPTY (no
 * verified public addresses exist — see KNOWN_CEX_HOT_WALLETS), so no
 * event can be flagged yet; events stay [] rather than guessing.
 */
export function buildCexDeposits(): CexDeposits {
  return { events: [], knownHotWallets: [...KNOWN_CEX_HOT_WALLETS] };
}

/** Dev-sell simulator — wraps the shared CPAMM model. Null when depth or
 *  dev holdings are unknown. */
export function buildDevSellSimulator(input: {
  devHoldingPct: number | null | undefined;
  marketCapUsd: number | null | undefined;
  liquidityUsd: number | null | undefined;
}): { devHoldingPct: number | null; devHoldingUsd: number | null; estPriceImpactPct: number | null; model: string } | null {
  return simulateDevSell({
    devHoldingPct: input.devHoldingPct ?? null,
    marketCapUsd: input.marketCapUsd ?? null,
    liquidityUsd: input.liquidityUsd ?? null,
  });
}

export type TokenIntelState = {
  loading: boolean;
  error: string | null;
  mint: string | null;
  safety: SafetyPayload | null;
  forensics: ForensicsPayload | null;
  token: TokenPayload | null;
  risk: ComposedRisk | null;
  /** DexScreener pairs (direct public API) — full volume/txn windows. Null
   *  until loaded; empty array means DexScreener returned no Solana pairs. */
  dexPairs: DexPair[] | null;
  /** Clone + links + launch info from /api/ogdex/research. Null until loaded. */
  research: ResearchPayload | null;
  /** OG score, derived from the same evidence as `risk`. Null until data lands. */
  ogScore: OgScore | null;
  /** Bundle analysis (W1 raw shape). Null until the scan returns. */
  bundle: RawBundleAnalysis | null;
  /** True while the bundle scan is in flight. */
  bundleLoading: boolean;
  /** X intel (W2 raw per-signal shape). Null until the lookup returns. */
  x: RawXIntel | null;
  /** True while the X lookup is in flight. */
  xLoading: boolean;
  /** Dev wallet live position (existing wallet route). Null until loaded. */
  devWallet: DevWalletIntel | null;
  /**
   * Funding chain for the dev wallet (server walk, max 3 hops). Null until
   * loaded; `state: "unknown"` + `reason` when the walk could not observe a
   * hop. `chain` is [devWallet, funder, funder's funder, ...]; each hop in
   * `hops` carries its tx signature, SOL amount and time.
   */
  fundingChain: FundingChain | null;
  /** True while the funding-chain walk is in flight. */
  fundingChainLoading: boolean;
  /**
   * Tokens the dev wallet launched, with an outcome each
   * ("alive" | "dead" | "rugged" | "unknown"). "rugged" only on observed LP
   * removal. Null until loaded.
   */
  devHistory: DevHistory | null;
  /** True while the dev-history lookup is in flight. */
  devHistoryLoading: boolean;
  /**
   * Same-dev detector: does the dev trace (via its funding chain) to a
   * source wallet behind a prior rugged token? Null until loaded;
   * `flagged: false` with `state: "unknown"` means unchecked, not clean.
   */
  sameDev: SameDevResult | null;
  /** True while the same-dev check is in flight. */
  sameDevLoading: boolean;
  /**
   * Live trade tape: recent swaps on the deepest-liquidity pair, observed
   * from the pair's signature history. Null until loaded or when no pair /
   * price / parseable swap exists (then the tape is unknown, not empty).
   */
  tradeTape: TradeTapeEntry[] | null;
  /** Whale alerts: tape trades at/above $5,000. Null until the tape loads. */
  whaleAlerts: WhaleAlert[] | null;
  /** True while the trade tape is in flight. */
  tapeLoading: boolean;
  /**
   * Live risk score (0–100, higher = safer), recomputed every time any
   * intel field above lands. Null when there is no evidence at all.
   */
  riskLive: RiskLive | null;
  /** B2: top holders whose first buy landed within 60s of pair creation. */
  sniperRadar: SniperRadarEntry[];
  /** B2: LP depth + lock state; burned share / lock expiry unobserved. */
  liquidityHealth: LiquidityHealth;
  /** B2: behavioural patterns on the dev wallet (high confidence only
   *  when >= 2 independent signals corroborate). */
  devFingerprint: DevFingerprintEntry[];
  /** B2: observed risk flags, dateless entries last ("time unknown"). */
  rugTimeline: RugTimelineEntry[];
  /** B3: launch-template matches; "insufficient data" when unobserved. */
  tokenDna: TokenDna;
  /** B3: pump.fun graduation, or null when not a pump.fun token. */
  graduation: Graduation;
  /** B3: wallet ages from oldest sampled signatures (server). */
  walletAges: WalletAge[] | null;
  walletAgesLoading: boolean;
  /** B3: contract vs the standard pump.fun template. */
  contractDiff: ContractDiff;
  /** B3: same-name/symbol clones from the research endpoint. */
  copycats: Copycat[];
  /** B3: hold durations; diamond >= 30d, paper < 30d. */
  holderConviction: HolderConviction;
  /** B3: evidence-only whale labels (sniper / bundle-member / dev-linked / whale). */
  whaleLabels: WhaleLabel[];
  /** B3: dev's prior tokens ranked by danger; unscorable counted, not ranked. */
  rugLeaderboard: RugLeaderboard;
  /** B4: what happens to price if the dev dumps everything (CPAMM model);
   *  null when depth or holdings are unknown. */
  devSellSimulator: ReturnType<typeof buildDevSellSimulator>;
  /** B4: bundled-% snapshots over repeat scans; trend unknown with < 2. */
  bundleDecay: BundleDecay | null;
  bundleDecayLoading: boolean;
  /** B4: top holders who bought within 10 min of pair creation. */
  freshWalletRadar: FreshWalletRadarEntry[];
  /** B4: liquidity moves between DEXes (e.g. pumpfun → raydium). */
  lpMigration: LpMigration;
  /** B4: metadata audit; imageOk only from a real image fetch. */
  metadataAudit: MetadataAudit;
  /** B4: other SPL holdings of the top holders (null = unreadable). */
  holderOverlap: HolderOverlapEntry[] | null;
  holderOverlapLoading: boolean;
  /** B4: largest USD buy/sell that moves price ~1% (CPAMM model). */
  entryExitPlanner: EntryExitPlanner;
  /** B4: post-mortem, only when the token is flagged rugged. */
  rugAutopsy: RugAutopsy;
  /** B5: dev wallet activity watch. */
  devWalletWatch: DevWalletWatchEntry[];
  /** B5: wallets that bought before a public announcement — null +
   *  insidersReason "no_announcement_time" (no announcement feed exists). */
  insiders: InsiderEntry[] | null;
  insidersReason: string | null;
  /** B5: vesting/unlock schedule — null (no unlock source for SPL mints). */
  unlockSchedule: UnlockSchedule;
  unlockScheduleReason: string | null;
  /** B5: wash-trading detector over the tape. */
  washTrading: WashTrading;
  /** B5: chart patterns from real GeckoTerminal daily candles. */
  chartPatterns: DeepIntel["chartPatterns"];
  /** B5: slippage estimate for a $1,000 trade (CPAMM model). */
  slippageEstimator: SlippageEstimator;
  /** B6: exit liquidity — real Jupiter lite sell quotes + depth thresholds. */
  exitLiquidity: DeepIntel["exitLiquidity"];
  /** B6: LP depth now; 1h/24h-ago depth unobservable (no history source). */
  lpDrain: DeepIntel["lpDrain"];
  /** B6: honeypot state now; flips empty (no prior observation). */
  honeypotFlip: HoneypotFlip;
  /** B6: current authorities; changes empty (no history feed). */
  authorityChange: AuthorityChange;
  /** B6: Token-2022 program + extensions from the mint account. */
  token2022Extensions: DeepIntel["token2022Extensions"];
  /** B6: cost basis — entry prices unobservable, so PnL is null. */
  costBasis: CostBasisEntry[];
  /** B6: RugCheck report (keyless, live) or null + reason. */
  rugCheck: DeepIntel["rugCheck"];
  /** B6: sends to known CEX hot wallets (embedded list is empty — no
   *  verified addresses exist yet — so no event can be flagged). */
  cexDeposits: CexDeposits;
  /** B6: range-based volatility from real GeckoTerminal candles. */
  volatility: DeepIntel["volatility"];
  /** True while the deep-intel (B6 server) fetch is in flight. */
  deepIntelLoading: boolean;
  refresh: () => void;
};

function buildRisk(
  safety: SafetyPayload | null,
  forensics: ForensicsPayload | null,
  token: TokenPayload | null,
): ComposedRisk {
  const holders = token?.holders || [];
  const balances = holders.map((h) => Number(h.uiAmount ?? h.pct ?? 0)).filter((n) => n > 0);
  const entropy = balances.length >= 2 ? holderEntropyScore(balances) : null;
  const liq = Number(token?.liquidityUsd ?? token?.liquidity ?? NaN);

  return composeRisk({
    canBuy: safety?.canBuy ?? null,
    canSell: safety?.canSell ?? null,
    roundTripLossPct: safety?.roundTripLossPct ?? null,
    mintRenounced: forensics?.safetyFlags?.mintRenounced ?? null,
    freezeRenounced: forensics?.safetyFlags?.freezeRenounced ?? null,
    lpLockedPct: forensics?.safetyFlags?.lpLockedPct ?? null,
    rugged: forensics?.safetyFlags?.rugged ?? null,
    top10Pct: forensics?.concentration?.top10Pct ?? null,
    whaleCount: forensics?.concentration?.whales ?? null,
    totalHolders: forensics?.concentration?.totalHolders ?? null,
    liquidityUsd: Number.isFinite(liq) ? liq : null,
    devSold: forensics?.dev?.sold ?? null,
    devSerial: forensics?.dev?.serial ?? null,
    creatorTokensCount: forensics?.dev?.tokensCreated ?? null,
    holderEntropy: entropy,
    externalRiskScore: forensics?.safetyFlags?.riskScore ?? null,
  });
}

/** Merge a fresh forensics payload over a previous one without clobbering
 *  enrichment-only fields (firstBuyer / dexPaid) that the new payload may
 *  not carry. */
function mergeForensics(prev: ForensicsPayload | null, next: ForensicsPayload | null): ForensicsPayload | null {
  if (!next) return prev;
  if (!prev) return next;
  return {
    ...next,
    firstBuyer: next.firstBuyer ?? prev.firstBuyer ?? null,
    dexPaid: next.dexPaid ?? prev.dexPaid ?? null,
  };
}

export function useTokenIntel(mint: string | null | undefined): TokenIntelState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safety, setSafety] = useState<SafetyPayload | null>(null);
  const [forensics, setForensics] = useState<ForensicsPayload | null>(null);
  const [token, setToken] = useState<TokenPayload | null>(null);
  const [risk, setRisk] = useState<ComposedRisk | null>(null);
  const [dexPairs, setDexPairs] = useState<DexPair[] | null>(null);
  const [research, setResearch] = useState<ResearchPayload | null>(null);
  const [bundle, setBundle] = useState<RawBundleAnalysis | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [x, setX] = useState<RawXIntel | null>(null);
  const [xLoading, setXLoading] = useState(false);
  const [devWallet, setDevWallet] = useState<DevWalletIntel | null>(null);
  const [fundingChain, setFundingChain] = useState<FundingChain | null>(null);
  const [fundingChainLoading, setFundingChainLoading] = useState(false);
  const [devHistory, setDevHistory] = useState<DevHistory | null>(null);
  const [devHistoryLoading, setDevHistoryLoading] = useState(false);
  const [sameDev, setSameDev] = useState<SameDevResult | null>(null);
  const [sameDevLoading, setSameDevLoading] = useState(false);
  const [tradeTape, setTradeTape] = useState<TradeTapeEntry[] | null>(null);
  const [whaleAlerts, setWhaleAlerts] = useState<WhaleAlert[] | null>(null);
  const [tapeLoading, setTapeLoading] = useState(false);
  const [tick, setTick] = useState(0);
  // Wave 3 (B6 server intel + holder intel)
  const [deepIntel, setDeepIntel] = useState<DeepIntel | null>(null);
  const [deepIntelLoading, setDeepIntelLoading] = useState(false);
  const [walletAges, setWalletAges] = useState<WalletAge[] | null>(null);
  const [walletAgesLoading, setWalletAgesLoading] = useState(false);
  const [holderOverlap, setHolderOverlap] = useState<HolderOverlapEntry[] | null>(null);
  const [holderOverlapLoading, setHolderOverlapLoading] = useState(false);
  const [bundleDecay, setBundleDecay] = useState<BundleDecay | null>(null);
  const [bundleDecayLoading, setBundleDecayLoading] = useState(false);
  /** Token image check: null = unchecked, true/false = real fetch result. */
  const [imageOk, setImageOk] = useState<boolean | null>(null);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!mint || !isValidMint(mint)) {
      setSafety(null);
      setForensics(null);
      setToken(null);
      setRisk(null);
      setDexPairs(null);
      setResearch(null);
      setBundle(null);
      setX(null);
      setDevWallet(null);
      setFundingChain(null);
      setDevHistory(null);
      setSameDev(null);
      setTradeTape(null);
      setWhaleAlerts(null);
      setDeepIntel(null);
      setWalletAges(null);
      setHolderOverlap(null);
      setBundleDecay(null);
      setImageOk(null);
      setError(mint ? "Invalid mint address" : null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDexPairs(null);
    setResearch(null);
    setBundle(null);
    setX(null);
    setDevWallet(null);
    setFundingChain(null);
    setDevHistory(null);
    setSameDev(null);
    setTradeTape(null);
    setWhaleAlerts(null);
    setDeepIntel(null);
    setWalletAges(null);
    setHolderOverlap(null);
    setBundleDecay(null);
    setImageOk(null);

    (async () => {
      try {
        const data = await scanTokenFull(mint);
        if (cancelled) return;
        const s = (data.safety as SafetyPayload) || null;
        const f = (data.forensics as ForensicsPayload) || null;
        const t = (data.token as TokenPayload) || null;
        setSafety(s);
        setForensics((prev) => mergeForensics(prev, f));
        setToken(t);
        setRisk(buildRisk(s, f, t));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Best-effort enrichments — never block the main scan, never set error.
    // (1) DexScreener pairs direct: full 5m/1h/6h/24h volume + txn windows.
    fetchDexPairs(mint)
      .then((pairs) => {
        if (!cancelled) setDexPairs(pairs);
      })
      .catch(() => {
        if (!cancelled) setDexPairs([]);
      });
    // (2) Research: same-name clones, social links, launch info.
    fetchResearchTyped(mint)
      .then((r) => {
        if (!cancelled) setResearch(r);
      })
      .catch(() => {
        if (!cancelled) setResearch({ ok: false, clones: [] });
      });
    // (3) First-buyer trace (OG proof) + DexScreener paid listing — the
    // aggregator calls forensics with first=0, so this fills the gap.
    fetchForensics(mint, true)
      .then((f) => {
        if (cancelled || !f || (f as ForensicsPayload).ok === false) return;
        setForensics((prev) => mergeForensics(prev, f as ForensicsPayload));
      })
      .catch(() => {});
    // (4) Bundle detection — server-side RPC clustering via /api/ogdex/bundle.
    // Never blocks, never sets error: an unknown scan renders as unknown.
    setBundleLoading(true);
    fetchBundleAnalysis(mint)
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBundleLoading(false);
      });
    // (5) X intel — linked handle via DexScreener + GeckoTerminal; profile
    // enrichment via the xsocial proxy when a Bearer token is configured.
    setXLoading(true);
    fetchXIntel(mint)
      .then((xIntel) => {
        if (!cancelled) setX(xIntel);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setXLoading(false);
      });
    // (6) Same-dev check — does the dev trace to a source behind a prior
    // rugged token? Server-side chain walk + dev history; never blocks,
    // never sets error. flagged:false + state:"unknown" = unchecked.
    setSameDevLoading(true);
    fetchSameDev(mint)
      .then((sd) => {
        if (!cancelled) setSameDev(sd);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSameDevLoading(false);
      });
    // (7) Live trade tape + whale alerts — recent swaps on the deepest pair.
    // Null tape = unknown, not "no trading".
    setTapeLoading(true);
    fetchTradeTape(mint)
      .then((t) => {
        if (cancelled) return;
        setTradeTape(t.tape);
        setWhaleAlerts(t.whaleAlerts);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTapeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mint, tick]);

  // (6) Dev wallet live position — needs the forensics-attributed dev wallet.
  const devWalletAddr = forensics?.dev?.wallet ?? null;
  useEffect(() => {
    if (!devWalletAddr || !mint) {
      setDevWallet(null);
      setFundingChain(null);
      setDevHistory(null);
      return;
    }
    let cancelled = false;
    fetchWalletIntel(devWalletAddr, mint)
      .then((w) => {
        if (!cancelled) setDevWallet(w);
      })
      .catch(() => {
        if (!cancelled) setDevWallet(null);
      });
    // Funding chain + dev history for the same dev wallet — server-side,
    // best effort, never sets error. These feed riskLive as they land.
    setFundingChainLoading(true);
    fetchFundingChain(devWalletAddr)
      .then((fc) => {
        if (!cancelled) setFundingChain(fc);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFundingChainLoading(false);
      });
    setDevHistoryLoading(true);
    fetchDevHistory(devWalletAddr)
      .then((dh) => {
        if (!cancelled) setDevHistory(dh);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDevHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [devWalletAddr, mint]);

  // (7) Wave 3 — B6 deep intel + bundle decay: one server call per mint,
  // best effort, never sets error. Each sub-field degrades to null + reason
  // on the server; a failed call just leaves the fields null.
  useEffect(() => {
    if (!mint || !isValidMint(mint)) return;
    let cancelled = false;
    setDeepIntelLoading(true);
    fetchDeepIntel(mint)
      .then((d) => {
        if (!cancelled) setDeepIntel(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDeepIntelLoading(false);
      });
    setBundleDecayLoading(true);
    fetchBundleDecay(mint)
      .then((d) => {
        if (!cancelled) setBundleDecay(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBundleDecayLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mint, tick]);

  // (8) Wave 3 — wallet ages + holder overlap for the bundle scan's top
  // holders. Runs when the bundle scan lands; nulls when it never does.
  const topHolderWallets = useMemo(
    () => (bundle?.traces ?? []).map((t) => t.address).filter(Boolean),
    [bundle],
  );
  useEffect(() => {
    if (!topHolderWallets.length || !mint) {
      setWalletAges(null);
      setHolderOverlap(null);
      return;
    }
    let cancelled = false;
    setWalletAgesLoading(true);
    fetchWalletAges(topHolderWallets.slice(0, 10))
      .then((ages) => {
        if (!cancelled) setWalletAges(ages);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setWalletAgesLoading(false);
      });
    setHolderOverlapLoading(true);
    fetchHolderOverlap(mint, topHolderWallets.slice(0, 5))
      .then((overlap) => {
        if (!cancelled) setHolderOverlap(overlap);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHolderOverlapLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [topHolderWallets, mint]);

  // (9) Wave 3 — metadata image check: a REAL load of the token image.
  // imageOk stays null when there is no image or the check times out
  // (inconclusive, not "broken"); false only on a real load error.
  const imageUrl = token?.image ?? null;
  useEffect(() => {
    if (!imageUrl) {
      setImageOk(null);
      return;
    }
    let done = false;
    setImageOk(null);
    const img = new Image();
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        img.src = "";
      }
    }, 5000);
    img.onload = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        setImageOk(true);
      }
    };
    img.onerror = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        setImageOk(false);
      }
    };
    img.src = imageUrl;
    return () => {
      done = true;
      clearTimeout(timer);
      img.src = "";
    };
  }, [imageUrl]);

  // Live risk score — recomputed every time any intel input changes, so the
  // score moves as bundle / dev-history / same-dev / tape evidence arrives.
  const riskLive = useMemo(
    () => buildRiskLive({ bundle, devHistory, sameDev, tradeTape, whaleAlerts }),
    [bundle, devHistory, sameDev, tradeTape, whaleAlerts],
  );

  // ── Wave 3 derived intel (pure builders over the state above) ─────────────
  const pairCreatedAt = dexPairs?.[0]?.pairCreatedAt ?? null;
  const priceUsd = token?.priceUsd ?? dexPairs?.[0]?.priceUsd ?? null;
  const liquidityUsd = token?.liquidityUsd ?? dexPairs?.[0]?.liquidityUsd ?? null;
  const mcapUsd = token?.marketCap ?? token?.mcap ?? dexPairs?.[0]?.marketCap ?? null;
  const sniperRadar = useMemo(
    () => buildSniperRadar(bundle?.traces, pairCreatedAt),
    [bundle, pairCreatedAt],
  );
  const liquidityHealth = useMemo(
    () => buildLiquidityHealth(liquidityUsd, forensics?.safetyFlags?.lpLockedPct ?? null),
    [liquidityUsd, forensics],
  );
  const devFingerprint = useMemo(
    () => buildDevFingerprint({ dev: forensics?.dev ?? null, bundle, sameDev }),
    [forensics, bundle, sameDev],
  );
  const rugTimeline = useMemo(
    () => buildRugTimeline({ forensics, safety, bundle, sameDev }),
    [forensics, safety, bundle, sameDev],
  );
  const tokenDna = useMemo(
    () => buildTokenDna({ forensics, bundle, sameDev, safety }),
    [forensics, bundle, sameDev, safety],
  );
  const graduation = useMemo(
    () => buildGraduation({ dexPairs, research, token, isPumpFun: forensics?.isPumpFun ?? null }),
    [dexPairs, research, token, forensics],
  );
  const contractDiff = useMemo(() => buildContractDiff(forensics), [forensics]);
  const copycats = useMemo(() => buildCopycats(research), [research]);
  const holderConviction = useMemo(() => buildHolderConviction(bundle?.traces), [bundle]);
  const whaleLabels = useMemo(
    () => buildWhaleLabels({ bundle, tape: tradeTape, pairCreatedAt }),
    [bundle, tradeTape, pairCreatedAt],
  );
  const rugLeaderboard = useMemo(
    () => buildRugLeaderboard({ devHistory, sameDev, mint: mint ?? null }),
    [devHistory, sameDev, mint],
  );
  const devSellSimulator = useMemo(
    () =>
      buildDevSellSimulator({
        devHoldingPct: forensics?.dev?.holding?.pct ?? null,
        marketCapUsd: mcapUsd,
        liquidityUsd,
      }),
    [forensics, mcapUsd, liquidityUsd],
  );
  const freshWalletRadar = useMemo(
    () => buildFreshWalletRadar(bundle?.traces, pairCreatedAt),
    [bundle, pairCreatedAt],
  );
  const lpMigration = useMemo(() => buildLpMigration(dexPairs), [dexPairs]);
  const metadataAudit = useMemo(() => buildMetadataAudit(token, imageOk), [token, imageOk]);
  const entryExitPlanner = useMemo(() => buildEntryExitPlanner(liquidityUsd), [liquidityUsd]);
  const rugAutopsy = useMemo(
    () => buildRugAutopsy({ mint: mint ?? null, token, forensics, timeline: rugTimeline }),
    [mint, token, forensics, rugTimeline],
  );
  const devWalletWatch = useMemo(
    () => buildDevWalletWatch(devWallet, forensics),
    [devWallet, forensics],
  );
  const insiders = useMemo(
    () => buildInsiders({ announcementAt: null, tape: tradeTape }),
    [tradeTape],
  );
  const insidersReason = insiders == null ? INSIDERS_UNANCHORED_REASON : null;
  const unlockSchedule = useMemo(() => buildUnlockSchedule(), []);
  const unlockScheduleReason = unlockSchedule == null ? UNLOCK_SCHEDULE_UNAVAILABLE_REASON : null;
  const washTrading = useMemo(() => buildWashTrading(tradeTape), [tradeTape]);
  const slippageEstimator = useMemo(() => buildSlippageEstimator(liquidityUsd), [liquidityUsd]);
  const honeypotFlip = useMemo(() => buildHoneypotFlip(safety), [safety]);
  const authorityChange = useMemo(() => buildAuthorityChange(forensics), [forensics]);
  const costBasis = useMemo(() => buildCostBasis(bundle?.traces, priceUsd), [bundle, priceUsd]);
  const cexDeposits = useMemo(() => buildCexDeposits(), []);

  const ogScore = useMemo(() => {
    if (!safety && !forensics && !token) return null;
    const mcap = Number(token?.marketCap ?? token?.mcap ?? NaN);
    const liq = Number(token?.liquidityUsd ?? token?.liquidity ?? NaN);
    const vol = Number(token?.volume24h ?? NaN);
    const clones = research?.clones ?? null;
    const cv = cloneVerdict(clones, Number.isFinite(mcap) ? mcap : null);
    return computeOgScore({
      mintRenounced: forensics?.safetyFlags?.mintRenounced ?? null,
      freezeRenounced: forensics?.safetyFlags?.freezeRenounced ?? null,
      lpLockedPct: forensics?.safetyFlags?.lpLockedPct ?? null,
      rugged: forensics?.safetyFlags?.rugged ?? null,
      liquidityUsd: Number.isFinite(liq) ? liq : null,
      marketCapUsd: Number.isFinite(mcap) ? mcap : null,
      volume24h: Number.isFinite(vol) ? vol : null,
      top10Pct: forensics?.concentration?.top10Pct ?? null,
      totalHolders: forensics?.concentration?.totalHolders ?? null,
      whaleCount: forensics?.concentration?.whales ?? null,
      canBuy: safety?.canBuy ?? null,
      canSell: safety?.canSell ?? null,
      roundTripLossPct: safety?.roundTripLossPct ?? null,
      devSold: forensics?.dev?.sold ?? null,
      devSerial: forensics?.dev?.serial ?? null,
      creatorTokensCount: forensics?.dev?.tokensCreated ?? null,
      ageDays: token?.ageDays ?? null,
      cloneCount: clones ? clones.length : null,
      biggerClone: clones ? cv.biggerClone : null,
      bundle: adaptBundleAnalysis(bundle),
      x: adaptXIntel(x),
      sourceTrace: adaptSourceTrace(bundle),
    });
  }, [safety, forensics, token, research, bundle, x]);

  return {
    loading,
    error,
    mint: mint && isValidMint(mint) ? mint : null,
    safety,
    forensics,
    token,
    risk,
    dexPairs,
    research,
    ogScore,
    bundle,
    bundleLoading,
    x,
    xLoading,
    devWallet,
    fundingChain,
    fundingChainLoading,
    devHistory,
    devHistoryLoading,
    sameDev,
    sameDevLoading,
    tradeTape,
    whaleAlerts,
    tapeLoading,
    riskLive,
    // Wave 3 (B2–B6)
    sniperRadar,
    liquidityHealth,
    devFingerprint,
    rugTimeline,
    tokenDna,
    graduation,
    walletAges,
    walletAgesLoading,
    contractDiff,
    copycats,
    holderConviction,
    whaleLabels,
    rugLeaderboard,
    devSellSimulator,
    bundleDecay,
    bundleDecayLoading,
    freshWalletRadar,
    lpMigration,
    metadataAudit,
    holderOverlap,
    holderOverlapLoading,
    entryExitPlanner,
    rugAutopsy,
    devWalletWatch,
    insiders,
    insidersReason,
    unlockSchedule,
    unlockScheduleReason,
    washTrading,
    chartPatterns: deepIntel?.chartPatterns ?? [],
    slippageEstimator,
    exitLiquidity: deepIntel?.exitLiquidity ?? null,
    lpDrain: deepIntel?.lpDrain ?? null,
    honeypotFlip,
    authorityChange,
    token2022Extensions: deepIntel?.token2022Extensions ?? null,
    costBasis,
    rugCheck: deepIntel?.rugCheck ?? null,
    cexDeposits,
    volatility: deepIntel?.volatility ?? null,
    deepIntelLoading,
    refresh,
  };
}
