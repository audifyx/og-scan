/**
 * OrbitX Crypto Intelligence — explainable risk composer.
 * Thin adapter over the canonical Token Intelligence engine.
 * `score` remains 0–100 where HIGHER = riskier (legacy intel UI).
 */

import {
  computeOrbitXTokenIntel,
  snapshotFromComposeRiskInput,
} from "../../../shared/orbitx-token-score.js";

export type SafetyRating = "A" | "B" | "C" | "D" | "F";
export type RiskTone = "good" | "warn" | "bad" | "unknown";

export type RiskFactor = {
  id: string;
  label: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  weight: number;
  points: number;
  detail: string;
};

export type ComposeRiskInput = {
  canBuy?: boolean | null;
  canSell?: boolean | null;
  roundTripLossPct?: number | null;
  mintRenounced?: boolean | null;
  freezeRenounced?: boolean | null;
  lpLockedPct?: number | null;
  rugged?: boolean | null;
  top10Pct?: number | null;
  whaleCount?: number | null;
  totalHolders?: number | null;
  liquidityUsd?: number | null;
  marketCapUsd?: number | null;
  devSold?: boolean | null;
  devSerial?: boolean | null;
  creatorTokensCount?: number | null;
  cloneSimilarityMax?: number | null;
  cloneHardMatch?: boolean | null;
  holderEntropy?: number | null;
  externalRiskScore?: number | null;
};

export type ComposedRisk = {
  score: number;
  rating: SafetyRating;
  tone: RiskTone;
  label: string;
  rugProbability: number;
  factors: RiskFactor[];
  summary: string;
  intel?: ReturnType<typeof computeOrbitXTokenIntel>;
};

function clamp(n: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function ratingFromRisk(score: number): SafetyRating {
  if (score <= 20) return "A";
  if (score <= 35) return "B";
  if (score <= 55) return "C";
  if (score <= 75) return "D";
  return "F";
}

function toneFromRisk(score: number, unknown: boolean): RiskTone {
  if (unknown) return "unknown";
  if (score <= 30) return "good";
  if (score <= 55) return "warn";
  return "bad";
}

function labelFromRating(rating: SafetyRating): string {
  switch (rating) {
    case "A":
      return "Low risk";
    case "B":
      return "Moderate risk";
    case "C":
      return "Elevated risk";
    case "D":
      return "High risk";
    default:
      return "Critical / avoid";
  }
}

function factorId(name: string): string {
  if (name === "cannot_sell" || name === "non_transferable") return "honeypot";
  if (name === "serial_deployer") return "serial_dev";
  if (name === "clone_hard") return "clone_hard";
  if (name === "rugged") return "rugged";
  if (name === "mint_active" || name === "mint_malicious") return "mint_auth";
  if (name === "freeze_active" || name === "freeze_used") return "freeze_auth";
  return name;
}

/**
 * Compose a 0–100 risk score (higher = riskier) with explainable factors.
 */
export function composeRisk(input: ComposeRiskInput): ComposedRisk {
  const snap = snapshotFromComposeRiskInput({
    ...input,
    cloneHardMatch: input.cloneHardMatch === true || (input.cloneSimilarityMax ?? 0) >= 0.85,
  });
  if (input.marketCapUsd != null) (snap as { marketCapUsd?: number }).marketCapUsd = input.marketCapUsd;
  if (input.roundTripLossPct != null) (snap as { roundTripLossPct?: number }).roundTripLossPct = input.roundTripLossPct;

  const intel = computeOrbitXTokenIntel(snap);
  const unknown = intel.confidence === "UNKNOWN" && intel.overall_score == null;

  const seen = new Set<string>();
  const factors: RiskFactor[] = [];
  for (const s of intel.signals || []) {
    if (s.status === "unavailable") continue;
    const id = factorId(s.name);
    if (seen.has(id)) continue;
    seen.add(id);
    factors.push({
      id,
      label: s.explanation.slice(0, 80),
      severity: s.severity as RiskFactor["severity"],
      weight: s.status === "critical" ? 1 : s.status === "risk" ? 0.7 : s.status === "positive" ? 0.2 : 0.4,
      points: s.status === "positive" ? 0 : Math.abs(Number(s.points) || 0) * 8,
      detail: s.explanation,
    });
  }

  const riskScore = unknown ? 28 : clamp(100 - (intel.safety_score ?? intel.overall_score ?? 50));
  const rating = unknown ? "C" : ratingFromRisk(riskScore);
  const tone = toneFromRisk(riskScore, unknown);
  const rugProbability = clamp(
    riskScore * (intel.critical_risks.some((s) => s.name === "cannot_sell" || s.name === "rugged") ? 1.05 : 0.85),
  );

  const summary = unknown
    ? "Insufficient signals — treat as unverified."
    : intel.explanation.concerns[0]
      ? `Primary drivers: ${intel.explanation.concerns.slice(0, 2).join("; ")}`
      : intel.explanation.positive[0] || "No material risk factors from available feeds — still DYOR.";

  return {
    score: riskScore,
    rating,
    tone,
    label: unknown ? "Unverified" : labelFromRating(rating),
    rugProbability,
    factors: factors.sort((a, b) => b.points * b.weight - a.points * b.weight),
    summary,
    intel,
  };
}

/** Map rating → CSS tone class suffix used by intel UI. */
export function ratingToneClass(rating: SafetyRating): string {
  switch (rating) {
    case "A":
      return "oxc-tone-good";
    case "B":
      return "oxc-tone-ok";
    case "C":
      return "oxc-tone-warn";
    case "D":
      return "oxc-tone-bad";
    default:
      return "oxc-tone-critical";
  }
}
