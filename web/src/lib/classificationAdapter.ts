// Maps the scanner's forensic data (TokenForensicScores + JupTokenInfo) into the
// explainable 4-tier classification engine, and reconstructs a time-series for
// the intelligence engines. Keeps the OG Scan tool as the single source of truth.
import {
  hasPulledOrDeadLiquidity, tokenEffectiveLiquidityUsd, tokenOgCreatedAtIso,
  type JupTokenInfo, type TokenForensicScores,
} from "./og";
import type { ClassificationInput } from "./classification";
import type { SeriesPoint } from "./intelligence";

export function forensicToInput(token: JupTokenInfo, score?: TokenForensicScores): ClassificationInput {
  const audit = token.audit;
  const createdIso = tokenOgCreatedAtIso(token);
  const ageHours = createdIso ? (Date.now() - new Date(createdIso).getTime()) / 3.6e6 : undefined;
  const vol = token.stats24h ? (token.stats24h.buyVolume ?? 0) + (token.stats24h.sellVolume ?? 0) : undefined;
  return {
    isFirstMint: score?.isFirstMintToken,
    isPrimaryToken: score?.isPrimaryToken,
    trueOgProbability: score?.trueOgProbability,
    cloneProbability: score?.cloneProbability,
    rugRiskScore: score?.riskScore,
    lpPulled: hasPulledOrDeadLiquidity(token),
    mintAuthorityActive: audit?.mintAuthorityDisabled === undefined ? undefined : !audit.mintAuthorityDisabled,
    freezeAuthorityActive: audit?.freezeAuthorityDisabled === undefined ? undefined : !audit.freezeAuthorityDisabled,
    topHolderPct: token.topHoldersPercent ?? audit?.topHoldersPercentage,
    holderCount: token.holderCount,
    liquidityUsd: tokenEffectiveLiquidityUsd(token),
    volume24hUsd: vol && vol > 0 ? vol : undefined,
    ageHours,
    hasName: Boolean(token.name),
    hasSymbol: Boolean(token.symbol),
  };
}

export function jupSeries(token: JupTokenInfo): SeriesPoint[] {
  const price = token.usdPrice;
  if (price === undefined || !Number.isFinite(price)) return [];
  const now = Date.now();
  const back = (pc?: number) => (pc != null ? price / (1 + pc / 100) : price);
  const vol = token.stats24h ? (token.stats24h.buyVolume ?? 0) + (token.stats24h.sellVolume ?? 0) : undefined;
  return [
    { t: now - 24 * 3.6e6, price: back(token.stats24h?.priceChange), volume: vol },
    { t: now - 1 * 3.6e6, price: back(token.stats1h?.priceChange) },
    { t: now - 5 * 6e4, price: back(token.stats5m?.priceChange) },
    { t: now, price },
  ];
}
