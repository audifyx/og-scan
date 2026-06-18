// ============================================================
// OG Scan — Explainable 4-Tier Classification Engine
// Spec sections 5[2] (Classification Module) & 6 (Taxonomy).
//
// Replaces binary OG/clone logic with a strict multi-signal
// taxonomy. Every verdict carries a 0-100 confidence and a
// full signal trace, so every classification is explainable.
//
// Pure & dependency-free → unit testable and reusable on the
// server (scan logging) and client (UI breakdown).
// ============================================================

export type OgTier = "OG_TOKEN" | "SAFE_CLONE" | "RISKY_TOKEN" | "DANGEROUS_TOKEN";

export const TIER_LABEL: Record<OgTier, string> = {
  OG_TOKEN: "OG TOKEN",
  SAFE_CLONE: "SAFE CLONE",
  RISKY_TOKEN: "RISKY TOKEN",
  DANGEROUS_TOKEN: "DANGEROUS TOKEN",
};

export type SignalDirection = "positive" | "negative" | "neutral";

export type ClassificationSignal = {
  id: string;
  label: string;
  direction: SignalDirection;
  /** relative weight this signal carried in the decision (0-100) */
  weight: number;
  /** human-readable reasoning trace */
  detail: string;
};

/**
 * Normalised inputs the engine reasons over. Every field is optional —
 * the engine degrades gracefully and lowers confidence when data is missing.
 * Callers map richer sources (forensic report, Jupiter token, Helius holder
 * intel, DexScreener pairs) into this shape.
 */
export type ClassificationInput = {
  // ── originality ──
  isFirstMint?: boolean;          // earliest known instance in the dataset graph
  isPrimaryToken?: boolean;       // dominant token for its narrative cluster
  trueOgProbability?: number;     // 0-100 from forensic engine
  cloneProbability?: number;      // 0-100 from forensic engine
  // ── danger / exploit ──
  lpPulled?: boolean;             // liquidity removed
  honeypot?: boolean;             // cannot sell
  mintAuthorityActive?: boolean;  // dev can mint more supply
  freezeAuthorityActive?: boolean;// dev can freeze transfers
  rugRiskScore?: number;          // 0-100, higher = worse (external rug heuristic)
  // ── distribution / behaviour ──
  topHolderPct?: number;          // % held by largest non-LP holder (0-100)
  bundledSupplyPct?: number;      // % supply bundled at launch (0-100)
  holderCount?: number;
  liquidityUsd?: number;
  volume24hUsd?: number;
  ageHours?: number;
  // ── metadata completeness ──
  hasName?: boolean;
  hasSymbol?: boolean;
  hasSocials?: boolean;
};

export type OgClassification = {
  tier: OgTier;
  tierLabel: string;
  /** 0-100 confidence in the assigned tier */
  confidence: number;
  /** 0-100 composite risk, higher = more dangerous */
  riskScore: number;
  rationale: string;
  signals: ClassificationSignal[];
  /** how much of the expected input was present (0-100) */
  dataCompleteness: number;
};

export const ENGINE_VERSION = "v1";

function clamp(n: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

const num = (v: number | undefined): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

/**
 * Core classifier. Multi-signal, threshold-gated, fully explainable.
 */
export function classifyToken(input: ClassificationInput): OgClassification {
  const signals: ClassificationSignal[] = [];
  const push = (s: ClassificationSignal) => signals.push(s);

  // ---- data completeness (drives confidence) ----
  const expectedKeys: (keyof ClassificationInput)[] = [
    "isFirstMint", "trueOgProbability", "lpPulled", "mintAuthorityActive",
    "topHolderPct", "liquidityUsd", "holderCount", "ageHours",
  ];
  const present = expectedKeys.filter((k) => input[k] !== undefined).length;
  const dataCompleteness = clamp((present / expectedKeys.length) * 100);

  // =========================================================
  // 1. DANGER SCORE — exploit / rug heuristics (section 6 DANGEROUS)
  // =========================================================
  let danger = 0;
  if (input.honeypot) {
    danger += 60;
    push({ id: "honeypot", label: "Honeypot pattern", direction: "negative", weight: 60, detail: "Sell path blocked — buyers cannot exit." });
  }
  if (input.lpPulled) {
    danger += 55;
    push({ id: "lp_pulled", label: "Liquidity pulled", direction: "negative", weight: 55, detail: "Pool liquidity has been removed (rug signal)." });
  }
  if (input.mintAuthorityActive) {
    danger += 22;
    push({ id: "mint_authority", label: "Mint authority active", direction: "negative", weight: 22, detail: "Deployer can mint unlimited new supply." });
  }
  if (input.freezeAuthorityActive) {
    danger += 18;
    push({ id: "freeze_authority", label: "Freeze authority active", direction: "negative", weight: 18, detail: "Deployer can freeze holder transfers." });
  }
  const top = num(input.topHolderPct);
  if (top !== undefined && top >= 50) {
    danger += 25;
    push({ id: "whale_concentration", label: "Extreme holder concentration", direction: "negative", weight: 25, detail: `Top holder controls ${top.toFixed(1)}% of supply.` });
  } else if (top !== undefined && top >= 25) {
    danger += 12;
    push({ id: "holder_concentration", label: "High holder concentration", direction: "negative", weight: 12, detail: `Top holder controls ${top.toFixed(1)}% of supply.` });
  }
  const bundled = num(input.bundledSupplyPct);
  if (bundled !== undefined && bundled >= 40) {
    danger += 20;
    push({ id: "bundled_supply", label: "Heavily bundled launch", direction: "negative", weight: 20, detail: `${bundled.toFixed(1)}% of supply bundled at launch.` });
  } else if (bundled !== undefined && bundled >= 20) {
    danger += 8;
    push({ id: "bundled_supply_mod", label: "Moderately bundled launch", direction: "negative", weight: 8, detail: `${bundled.toFixed(1)}% of supply bundled at launch.` });
  }
  const rug = num(input.rugRiskScore);
  if (rug !== undefined && rug > 0) {
    const w = Math.round(rug * 0.3);
    danger += w;
    push({ id: "rug_heuristic", label: "External rug heuristic", direction: rug >= 50 ? "negative" : "neutral", weight: w, detail: `External rug-risk score ${rug}/100.` });
  }
  danger = clamp(danger);

  // =========================================================
  // 2. ORIGINALITY SCORE — OG detection (section 6 OG TOKEN)
  // =========================================================
  let og = 0;
  if (input.isFirstMint) {
    og += 35;
    push({ id: "first_mint", label: "First known deployment", direction: "positive", weight: 35, detail: "Earliest instance for this narrative in the token graph." });
  }
  if (input.isPrimaryToken) {
    og += 20;
    push({ id: "primary_token", label: "Dominant token for narrative", direction: "positive", weight: 20, detail: "Leads its narrative cluster on liquidity + adoption." });
  }
  const trueOg = num(input.trueOgProbability);
  if (trueOg !== undefined) {
    const w = Math.round(trueOg * 0.4);
    og += w;
    push({ id: "true_og_prob", label: "Forensic originality", direction: trueOg >= 50 ? "positive" : "neutral", weight: w, detail: `Forensic true-OG probability ${trueOg}/100.` });
  }
  const clone = num(input.cloneProbability);
  if (clone !== undefined && clone >= 50) {
    og -= Math.round(clone * 0.3);
    push({ id: "clone_prob", label: "Clone lineage detected", direction: "negative", weight: Math.round(clone * 0.3), detail: `Forensic clone probability ${clone}/100.` });
  }
  og = clamp(og);

  // =========================================================
  // 3. STABILITY / SAFETY SIGNALS (section 6 SAFE CLONE)
  // =========================================================
  let stability = 0;
  const liq = num(input.liquidityUsd);
  if (liq !== undefined) {
    if (liq >= 25_000) { stability += 25; push({ id: "liquidity_stable", label: "Stable liquidity", direction: "positive", weight: 25, detail: `$${Math.round(liq).toLocaleString()} pooled liquidity.` }); }
    else if (liq >= 5_000) { stability += 12; push({ id: "liquidity_ok", label: "Adequate liquidity", direction: "positive", weight: 12, detail: `$${Math.round(liq).toLocaleString()} pooled liquidity.` }); }
    else { push({ id: "liquidity_low", label: "Thin liquidity", direction: "negative", weight: 10, detail: `Only $${Math.round(liq).toLocaleString()} pooled liquidity.` }); danger += 8; }
  }
  const holders = num(input.holderCount);
  if (holders !== undefined && holders >= 500) { stability += 15; push({ id: "holders_broad", label: "Broad holder base", direction: "positive", weight: 15, detail: `${holders.toLocaleString()} holders.` }); }
  else if (holders !== undefined && holders < 50) { push({ id: "holders_few", label: "Few holders", direction: "negative", weight: 8, detail: `Only ${holders} holders.` }); danger += 6; }
  const age = num(input.ageHours);
  if (age !== undefined && age >= 720) { stability += 10; push({ id: "survived", label: "Survived 30d+", direction: "positive", weight: 10, detail: "Token has persisted past the typical decay window." }); }
  stability = clamp(stability);
  danger = clamp(danger);

  // =========================================================
  // 4. METADATA COMPLETENESS (section 6 RISKY TOKEN)
  // =========================================================
  const metaMissing: string[] = [];
  if (input.hasName === false) metaMissing.push("name");
  if (input.hasSymbol === false) metaMissing.push("symbol");
  if (input.hasSocials === false) metaMissing.push("socials");
  const metadataIncomplete = metaMissing.length > 0;
  if (metadataIncomplete) {
    push({ id: "metadata_incomplete", label: "Incomplete metadata", direction: "negative", weight: 10, detail: `Missing: ${metaMissing.join(", ")}.` });
  }

  // =========================================================
  // 5. DECISION TREE (strict taxonomy, danger-first)
  // =========================================================
  let tier: OgTier;
  let rationale: string;

  const lowData = dataCompleteness < 35;

  if (danger >= 70) {
    tier = "DANGEROUS_TOKEN";
    rationale = "Hard exploit/rug indicators present — treat as malicious.";
  } else if (danger >= 40) {
    tier = "RISKY_TOKEN";
    rationale = "Multiple suspicious behaviour signals without confirmed exploit.";
  } else if (lowData || (metadataIncomplete && danger >= 20)) {
    tier = "RISKY_TOKEN";
    rationale = lowData
      ? "Insufficient on-chain data to verify safety — classified low-confidence."
      : "Incomplete metadata combined with suspicious behaviour.";
  } else if (og >= 65 && danger < 25) {
    tier = "OG_TOKEN";
    rationale = "Verified originality via first-deployment + forensic signals with low risk.";
  } else if (danger < 25 && stability >= 20) {
    tier = "SAFE_CLONE";
    rationale = "Non-original token with stable liquidity and no malicious indicators.";
  } else if (metadataIncomplete) {
    tier = "RISKY_TOKEN";
    rationale = "Incomplete metadata and unproven behaviour.";
  } else {
    tier = "SAFE_CLONE";
    rationale = "No malicious indicators detected; insufficient originality for OG status.";
  }

  // =========================================================
  // 6. CONFIDENCE — decisiveness × data completeness
  // =========================================================
  let decisiveness: number;
  switch (tier) {
    case "DANGEROUS_TOKEN": decisiveness = clamp(50 + (danger - 70) * 1.4 + 20); break;
    case "OG_TOKEN":        decisiveness = clamp(40 + (og - 65) * 1.2 + (25 - danger)); break;
    case "SAFE_CLONE":      decisiveness = clamp(45 + stability - danger); break;
    default:                decisiveness = clamp(40 + Math.abs(danger - 50)); break; // RISKY
  }
  const confidence = clamp(Math.round(decisiveness * (0.55 + 0.45 * (dataCompleteness / 100))));

  // dominant-driver sort for the trace
  signals.sort((a, b) => b.weight - a.weight);

  return {
    tier,
    tierLabel: TIER_LABEL[tier],
    confidence,
    riskScore: danger,
    rationale,
    signals,
    dataCompleteness,
  };
}

/** Map an OgTier to a UI colour intent. */
export function tierIntent(tier: OgTier): "success" | "info" | "warning" | "danger" {
  switch (tier) {
    case "OG_TOKEN": return "success";
    case "SAFE_CLONE": return "info";
    case "RISKY_TOKEN": return "warning";
    case "DANGEROUS_TOKEN": return "danger";
  }
}
