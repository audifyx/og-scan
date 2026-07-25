/**
 * OrbitX Crypto Intelligence — explainable risk composer.
 * Pure functions: fuse safety, tradeability, forensics, holders, clones → score + rating.
 */

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
};

function clamp(n: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function ratingFromScore(score: number): SafetyRating {
  if (score <= 20) return "A";
  if (score <= 35) return "B";
  if (score <= 55) return "C";
  if (score <= 75) return "D";
  return "F";
}

function toneFromScore(score: number): RiskTone {
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

/**
 * Compose a 0–100 risk score (higher = riskier) with explainable factors.
 */
export function composeRisk(input: ComposeRiskInput): ComposedRisk {
  const factors: RiskFactor[] = [];

  if (input.rugged === true) {
    factors.push({
      id: "rugged",
      label: "Rug signal",
      severity: "critical",
      weight: 1,
      points: 100,
      detail: "External safety feed flagged this mint as rugged.",
    });
  }

  if (input.canSell === false) {
    factors.push({
      id: "honeypot",
      label: "Honeypot / unsellable",
      severity: "critical",
      weight: 1,
      points: 90,
      detail: "No sell route found — classic honeypot pattern.",
    });
  } else if (input.canBuy === false) {
    factors.push({
      id: "no_route",
      label: "No buy route",
      severity: "high",
      weight: 0.8,
      points: 55,
      detail: "No liquidity route to buy this token.",
    });
  }

  if (input.roundTripLossPct != null) {
    if (input.roundTripLossPct >= 35) {
      factors.push({
        id: "tax_impact",
        label: "Extreme round-trip cost",
        severity: "critical",
        weight: 0.9,
        points: 70,
        detail: `Round trip loses ~${input.roundTripLossPct.toFixed(0)}% (tax / impact).`,
      });
    } else if (input.roundTripLossPct >= 15) {
      factors.push({
        id: "elevated_cost",
        label: "Elevated trade cost",
        severity: "medium",
        weight: 0.5,
        points: 35,
        detail: `Round trip costs ~${input.roundTripLossPct.toFixed(0)}%.`,
      });
    }
  }

  if (input.mintRenounced === false) {
    factors.push({
      id: "mint_auth",
      label: "Mint authority live",
      severity: "high",
      weight: 0.85,
      points: 45,
      detail: "Supply can still be inflated by the mint authority.",
    });
  }
  if (input.freezeRenounced === false) {
    factors.push({
      id: "freeze_auth",
      label: "Freeze authority live",
      severity: "high",
      weight: 0.8,
      points: 40,
      detail: "Accounts can be frozen — trading can be blocked.",
    });
  }

  if (input.lpLockedPct != null) {
    if (input.lpLockedPct < 50) {
      factors.push({
        id: "lp_unlock",
        label: "Low LP lock",
        severity: "high",
        weight: 0.75,
        points: 50,
        detail: `Only ~${input.lpLockedPct.toFixed(0)}% of LP appears locked.`,
      });
    } else if (input.lpLockedPct < 80) {
      factors.push({
        id: "lp_partial",
        label: "Partial LP lock",
        severity: "medium",
        weight: 0.4,
        points: 25,
        detail: `LP lock ~${input.lpLockedPct.toFixed(0)}%.`,
      });
    }
  }

  if (input.liquidityUsd != null && input.liquidityUsd < 5_000) {
    factors.push({
      id: "thin_liq",
      label: "Thin liquidity",
      severity: "high",
      weight: 0.7,
      points: 45,
      detail: `Liquidity ~$${Math.round(input.liquidityUsd).toLocaleString()} — easy to rug or manipulate.`,
    });
  } else if (input.liquidityUsd != null && input.liquidityUsd < 25_000) {
    factors.push({
      id: "modest_liq",
      label: "Modest liquidity",
      severity: "medium",
      weight: 0.35,
      points: 20,
      detail: `Liquidity ~$${Math.round(input.liquidityUsd).toLocaleString()}.`,
    });
  }

  if (input.top10Pct != null && input.top10Pct >= 60) {
    factors.push({
      id: "conc_extreme",
      label: "Extreme holder concentration",
      severity: "critical",
      weight: 0.85,
      points: 65,
      detail: `Top 10 holders control ~${input.top10Pct.toFixed(0)}%.`,
    });
  } else if (input.top10Pct != null && input.top10Pct >= 40) {
    factors.push({
      id: "conc_high",
      label: "High holder concentration",
      severity: "high",
      weight: 0.6,
      points: 40,
      detail: `Top 10 holders control ~${input.top10Pct.toFixed(0)}%.`,
    });
  }

  if (input.holderEntropy != null && input.holderEntropy < 40) {
    factors.push({
      id: "entropy_low",
      label: "Uneven distribution",
      severity: "medium",
      weight: 0.4,
      points: 28,
      detail: `Holder entropy ${input.holderEntropy.toFixed(0)}/100 — distribution skewed.`,
    });
  }

  if (input.devSold === true) {
    factors.push({
      id: "dev_sold",
      label: "Dev appears exited",
      severity: "medium",
      weight: 0.45,
      points: 30,
      detail: "Creator wallet is not among meaningful holders.",
    });
  }

  if (input.devSerial === true || (input.creatorTokensCount ?? 0) >= 5) {
    factors.push({
      id: "serial_dev",
      label: "Serial deployer",
      severity: "high",
      weight: 0.7,
      points: 42,
      detail: `Creator linked to ${input.creatorTokensCount ?? "many"} prior launches.`,
    });
  }

  if (input.cloneHardMatch === true || (input.cloneSimilarityMax ?? 0) >= 0.85) {
    factors.push({
      id: "clone_hard",
      label: "Clone / vamp match",
      severity: "critical",
      weight: 0.9,
      points: 75,
      detail: "Near-exact name/ticker collision with an existing token.",
    });
  } else if ((input.cloneSimilarityMax ?? 0) >= 0.55) {
    factors.push({
      id: "clone_soft",
      label: "Narrative clone risk",
      severity: "medium",
      weight: 0.5,
      points: 32,
      detail: `Similarity ${(input.cloneSimilarityMax! * 100).toFixed(0)}% to known tokens.`,
    });
  }

  if (input.externalRiskScore != null && Number.isFinite(input.externalRiskScore)) {
    const ext = clamp(input.externalRiskScore);
    factors.push({
      id: "external",
      label: "Upstream safety score",
      severity: ext >= 70 ? "high" : ext >= 40 ? "medium" : "low",
      weight: 0.35,
      points: ext,
      detail: `External risk feed scored ${ext.toFixed(0)}/100.`,
    });
  }

  // Weighted blend: critical factors pull hard toward max; empty → unknown mid-low
  const observed =
    input.canBuy != null ||
    input.canSell != null ||
    input.mintRenounced != null ||
    input.freezeRenounced != null ||
    input.lpLockedPct != null ||
    input.liquidityUsd != null ||
    input.top10Pct != null ||
    input.rugged != null ||
    input.cloneHardMatch != null ||
    input.cloneSimilarityMax != null ||
    input.externalRiskScore != null ||
    input.devSold != null ||
    input.devSerial != null ||
    input.creatorTokensCount != null;

  let score: number;
  if (factors.length === 0) {
    score = observed ? 14 : 28;
  } else {
    const weighted = factors.reduce((s, f) => s + f.points * f.weight, 0);
    const wSum = factors.reduce((s, f) => s + f.weight, 0) || 1;
    const blended = weighted / wSum;
    const criticalBoost = factors.some((f) => f.severity === "critical") ? 12 : 0;
    score = clamp(blended + criticalBoost);
  }

  const rating = ratingFromScore(score);
  const tone: RiskTone =
    factors.length === 0
      ? observed
        ? "good"
        : "unknown"
      : toneFromScore(score);
  const rugProbability = clamp(
    score *
      (factors.some((f) => f.id === "honeypot" || f.id === "rugged" || f.id === "lp_unlock")
        ? 1.05
        : 0.85),
  );

  const top = [...factors].sort((a, b) => b.points * b.weight - a.points * a.weight).slice(0, 3);
  const summary =
    factors.length === 0
      ? observed
        ? "No material risk factors from available feeds — still DYOR."
        : "Insufficient signals — treat as unverified."
      : `Primary drivers: ${top.map((f) => f.label.toLowerCase()).join("; ")}.`;

  return {
    score,
    rating,
    tone,
    label: labelFromRating(rating),
    rugProbability,
    factors: factors.sort((a, b) => b.points * b.weight - a.points * a.weight),
    summary,
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
