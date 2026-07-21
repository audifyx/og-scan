// OrbitX — Orbit Score engine.
// A transparent, deterministic 0-100 rating computed from live market + registry
// signals. No black box: each sub-score is a documented function of real data
// (liquidity depth, 24h activity, buy pressure, holder spread, safety flags).
export interface OrbitScoreInput {
  liq?: number | null;
  mcap?: number | null;
  vol24?: number | null;
  buys?: number | null;
  sells?: number | null;
  ageMs?: number | null;
  holders?: number | null;
  isVamp?: boolean;
  graduated?: boolean;
}

export interface OrbitScore {
  score: number;        // overall 0-100
  safety: number;
  liquidity: number;
  distribution: number;
  activity: number;
  momentum: number;
}

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const lin = (v: number, lo: number, hi: number) => clamp(((v - lo) / (hi - lo)) * 100);
const log10 = (v: number) => Math.log10(Math.max(1, v));

export function orbitScore(i: OrbitScoreInput): OrbitScore {
  const liq = i.liq ?? 0;
  const vol = i.vol24 ?? 0;
  const buys = i.buys ?? 0;
  const sells = i.sells ?? 0;
  const tx = buys + sells;
  const holders = i.holders ?? null;

  const liquidity = liq <= 0 ? 0 : lin(log10(liq), log10(500), log10(60000));
  const activity = vol <= 0 ? 0 : lin(log10(vol), log10(200), log10(50000));
  const buyRatio = tx > 0 ? buys / tx : 0.5;
  const momentum = tx === 0 ? 50 : clamp(30 + buyRatio * 70);
  const distribution = holders == null ? 60 : lin(log10(holders), log10(20), log10(2000));

  let safety = i.isVamp ? 25 : 80;
  if (i.graduated) safety += 12;
  safety += liquidity * 0.1;
  safety = clamp(safety);

  const score = Math.round(
    clamp(safety * 0.30 + liquidity * 0.22 + distribution * 0.18 + activity * 0.15 + momentum * 0.15),
  );
  return {
    score,
    safety: Math.round(safety),
    liquidity: Math.round(liquidity),
    distribution: Math.round(distribution),
    activity: Math.round(activity),
    momentum: Math.round(momentum),
  };
}

export function scoreTone(score: number): "lime" | "gold" | "blood" {
  if (score >= 75) return "lime";
  if (score >= 50) return "gold";
  return "blood";
}
