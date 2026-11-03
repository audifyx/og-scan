/**
 * tokenScore — an HONEST, defined token score computed from REAL data only.
 *
 * The score is a 0–100 weighted sum. Every input is optional: an unknown
 * input earns ZERO points for its bucket and is listed in `missing`, so the
 * UI can show "partial data" instead of a fake perfect score. Nothing here
 * is ever invented, interpolated, or defaulted to a flattering value.
 *
 * ── Formula (weights sum to 100) ──────────────────────────────────────────
 *   Liquidity (USD)            25 pts  log-ish bands:
 *     >= $1M → 25 · >= $250K → 20 · >= $100K → 16 · >= $25K → 11
 *     >= $5K → 6 · > $0 → 3 · $0 / unknown → 0
 *   Top-10 holder share        25 pts  (lower = better):
 *     <= 10% → 25 · <= 20% → 20 · <= 30% → 15 · <= 40% → 10
 *     <= 50% → 5 · > 50% → 0 · unknown → 0
 *   Mint authority revoked     15 pts  revoked → 15 · active → 0 · unknown → 0
 *   Freeze authority revoked   15 pts  revoked → 15 · active → 0 · unknown → 0
 *   24h volume (USD)           10 pts:
 *     >= $1M → 10 · >= $250K → 8 · >= $100K → 6 · >= $10K → 4 · > $0 → 2 · else 0
 *   24h transactions           10 pts:
 *     >= 1000 → 10 · >= 500 → 8 · >= 100 → 6 · >= 10 → 4 · > $0 → 2 · else 0
 *
 * ── Labels ────────────────────────────────────────────────────────────────
 *   80–100 Strong · 60–79 Fair · 40–59 Weak · 0–39 Low
 *
 * ── Confidence ────────────────────────────────────────────────────────────
 *   `coverage` = known inputs / 6. `partial` is true whenever any input is
 *   unknown. A score built on partial data is still a real score — it just
 *   can never reach 100, and the UI must say which inputs were missing.
 *
 * ── Input notes ───────────────────────────────────────────────────────────
 *   - `top10Pct` should be the share held by the top 10 WALLETS, excluding
 *     the DEX liquidity-pool token account when the caller can identify it
 *     (raw RugCheck top-10 includes the pool account, which inflates the
 *     number — e.g. ORBITX raw top-10 is 65.1% but ~41% of that is the
 *     pumpswap pool itself, so the wallet-held top-10 is ~24.1%).
 *   - `mintRevoked` / `freezeRevoked`: true = authority is null/revoked
 *     (safer), false = authority still live, undefined = unknown.
 *   - Sources in this codebase: DexScreener pairs (liquidity, volume, txns),
 *     RugCheck report / `TokenIntel.audit` in `@/lib/og` (authorities,
 *     topHoldersPercentage), `fetchTokenBundle` in `./tradeApi`.
 */

export type TokenScoreInput = {
  /** USD liquidity of the best pair. */
  liquidityUsd?: number | null;
  /** Share of supply (0–100) held by the top 10 wallets. See note above. */
  top10Pct?: number | null;
  /** True when the mint authority is revoked (null on-chain). */
  mintRevoked?: boolean | null;
  /** True when the freeze authority is revoked (null on-chain). */
  freezeRevoked?: boolean | null;
  /** 24h trading volume in USD. */
  volume24hUsd?: number | null;
  /** 24h transaction count. */
  txns24h?: number | null;
};

export type TokenScoreLabel = "Strong" | "Fair" | "Weak" | "Low";

export type TokenScore = {
  /** Weighted total, 0–100. Never exceeds what the known inputs support. */
  score: number;
  label: TokenScoreLabel;
  /** Per-bucket points actually earned (0 when the input was unknown). */
  breakdown: {
    liquidity: number;
    holders: number;
    mintAuthority: number;
    freezeAuthority: number;
    volume: number;
    activity: number;
  };
  /** Names of the inputs that were unknown, for the UI to disclose. */
  missing: string[];
  /** Known inputs / 6, 0–1. */
  coverage: number;
  /** True when any input was unknown — show "partial data" in the UI. */
  partial: boolean;
};

export const SCORE_WEIGHTS = {
  liquidity: 25,
  holders: 25,
  mintAuthority: 15,
  freezeAuthority: 15,
  volume: 10,
  activity: 10,
} as const;

function isKnown(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function liquidityPoints(v: number | null | undefined): number {
  if (!isKnown(v)) return 0;
  if (v >= 1_000_000) return 25;
  if (v >= 250_000) return 20;
  if (v >= 100_000) return 16;
  if (v >= 25_000) return 11;
  if (v >= 5_000) return 6;
  if (v > 0) return 3;
  return 0;
}

function holderPoints(v: number | null | undefined): number {
  if (!isKnown(v)) return 0;
  if (v <= 10) return 25;
  if (v <= 20) return 20;
  if (v <= 30) return 15;
  if (v <= 40) return 10;
  if (v <= 50) return 5;
  return 0;
}

function authorityPoints(revoked: boolean | null | undefined): number {
  return revoked === true ? 15 : 0;
}

function volumePoints(v: number | null | undefined): number {
  if (!isKnown(v)) return 0;
  if (v >= 1_000_000) return 10;
  if (v >= 250_000) return 8;
  if (v >= 100_000) return 6;
  if (v >= 10_000) return 4;
  if (v > 0) return 2;
  return 0;
}

function activityPoints(v: number | null | undefined): number {
  if (!isKnown(v)) return 0;
  if (v >= 1000) return 10;
  if (v >= 500) return 8;
  if (v >= 100) return 6;
  if (v >= 10) return 4;
  if (v > 0) return 2;
  return 0;
}

export function scoreLabel(score: number): TokenScoreLabel {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Weak";
  return "Low";
}

/** Pure: real inputs in, honest score out. Unknown inputs earn 0 + are listed. */
export function scoreToken(input: TokenScoreInput): TokenScore {
  const missing: string[] = [];
  if (!isKnown(input.liquidityUsd)) missing.push("liquidity");
  if (!isKnown(input.top10Pct)) missing.push("top-10 holders");
  if (input.mintRevoked == null) missing.push("mint authority");
  if (input.freezeRevoked == null) missing.push("freeze authority");
  if (!isKnown(input.volume24hUsd)) missing.push("24h volume");
  if (!isKnown(input.txns24h)) missing.push("24h transactions");

  const breakdown = {
    liquidity: liquidityPoints(input.liquidityUsd),
    holders: holderPoints(input.top10Pct),
    mintAuthority: authorityPoints(input.mintRevoked),
    freezeAuthority: authorityPoints(input.freezeRevoked),
    volume: volumePoints(input.volume24hUsd),
    activity: activityPoints(input.txns24h),
  };
  const score =
    breakdown.liquidity +
    breakdown.holders +
    breakdown.mintAuthority +
    breakdown.freezeAuthority +
    breakdown.volume +
    breakdown.activity;

  const coverage = (6 - missing.length) / 6;
  return {
    score,
    label: scoreLabel(score),
    breakdown,
    missing,
    coverage,
    partial: missing.length > 0,
  };
}
