// ============================================================
// OG Scan — Intelligence Layer (spec section B & 7)
// Pure, dependency-free analytics primitives:
//  - trend velocity scoring (time-series)
//  - lifecycle reconstruction (launch -> growth -> peak -> decay)
//  - clone / narrative similarity (graph edges)
//  - holder distribution entropy
//  - liquidity stability index
//  - hype decay prediction
//  - "why trending" / "why this exists" explanation engines
// ============================================================

export type SeriesPoint = {
  t: number;            // unix ms
  price?: number;
  volume?: number;      // window volume
  liquidity?: number;
};

function finite(n: number | undefined): number | undefined {
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}
function clamp(n: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

// ── Trend velocity ──────────────────────────────────────────
// Blends recent price momentum and volume acceleration into 0-100.
export function trendVelocityScore(series: SeriesPoint[]): number {
  const pts = series.filter((p) => finite(p.price) !== undefined || finite(p.volume) !== undefined);
  if (pts.length < 2) return 0;
  const sorted = pts.slice().sort((a, b) => a.t - b.t);
  const half = Math.max(1, Math.floor(sorted.length / 2));
  const older = sorted.slice(0, half);
  const recent = sorted.slice(-half);

  const priceMomentum = pctChange(mean(older.map((p) => p.price ?? 0)), mean(recent.map((p) => p.price ?? 0)));
  const volAccel = pctChange(mean(older.map((p) => p.volume ?? 0)), mean(recent.map((p) => p.volume ?? 0)));

  // squash unbounded % changes through a logistic-ish map
  const squash = (x: number) => 50 + 50 * Math.tanh(x / 120);
  return clamp(0.6 * squash(priceMomentum) + 0.4 * squash(volAccel));
}

function pctChange(from: number, to: number): number {
  if (!Number.isFinite(from) || from === 0) return to > 0 ? 100 : 0;
  return ((to - from) / Math.abs(from)) * 100;
}

// ── Lifecycle reconstruction ────────────────────────────────
export type LifecycleStage = "launch" | "expansion" | "peak" | "decline";
export type LifecycleResult = {
  stage: LifecycleStage;
  peakIndex: number;
  drawdownFromPeakPct: number;
  ageHours: number;
  failure?: "liquidity_collapse" | "hype_decay" | "dev_abandonment";
  summary: string;
};

export function reconstructLifecycle(series: SeriesPoint[]): LifecycleResult {
  const sorted = series.slice().sort((a, b) => a.t - b.t);
  const prices = sorted.map((p) => p.price ?? 0);
  const ageHours = sorted.length ? (sorted[sorted.length - 1].t - sorted[0].t) / 3.6e6 : 0;

  if (prices.length < 3) {
    return { stage: "launch", peakIndex: 0, drawdownFromPeakPct: 0, ageHours, summary: "Too early to map a lifecycle." };
  }

  let peakIndex = 0;
  for (let i = 1; i < prices.length; i++) if (prices[i] > prices[peakIndex]) peakIndex = i;
  const peak = prices[peakIndex] || 1;
  const last = prices[prices.length - 1];
  const drawdown = clamp(((peak - last) / peak) * 100);

  const lastLiq = finite(sorted[sorted.length - 1].liquidity);
  const peakLiq = finite(sorted[peakIndex].liquidity);
  const lastVol = finite(sorted[sorted.length - 1].volume);

  let stage: LifecycleStage;
  let failure: LifecycleResult["failure"];
  const fracThrough = peakIndex / (prices.length - 1);

  if (peakIndex === prices.length - 1) stage = "expansion";
  else if (drawdown < 15) stage = "peak";
  else if (drawdown >= 60) stage = "decline";
  else stage = fracThrough > 0.7 ? "peak" : "expansion";

  if (ageHours < 6 && drawdown < 20) stage = "launch";

  if (stage === "decline") {
    if (peakLiq && lastLiq !== undefined && lastLiq < peakLiq * 0.25) failure = "liquidity_collapse";
    else if (lastVol !== undefined && lastVol < (mean(sorted.map((p) => p.volume ?? 0)) || 1) * 0.2) failure = "hype_decay";
  }

  const summary =
    stage === "launch" ? "Freshly launched; still in price discovery." :
    stage === "expansion" ? "Growing — price/volume still trending up." :
    stage === "peak" ? "At or near peak; momentum flattening." :
    `Declining ${drawdown.toFixed(0)}% off peak${failure ? ` via ${failure.replace("_", " ")}` : ""}.`;

  return { stage, peakIndex, drawdownFromPeakPct: drawdown, ageHours, failure, summary };
}

// ── Narrative / clone similarity ────────────────────────────
export function normalizeNarrative(value: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

/** 0..1 similarity between two token identities (name/symbol). */
export function narrativeSimilarity(a: string, b: string): number {
  const na = normalizeNarrative(a), nb = normalizeNarrative(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  return clamp((1 - dist / Math.max(na.length, nb.length)) * 100) / 100;
}

export type CloneEdge = { mint: string; similarity: number; relationship: "clone_of" | "same_narrative" };

/** Compare a target against candidates → ranked clone-lineage edges. */
export function detectCloneEdges(
  target: { mint: string; name?: string; symbol?: string },
  candidates: { mint: string; name?: string; symbol?: string }[],
  threshold = 0.6,
): CloneEdge[] {
  const tId = `${target.name ?? ""} ${target.symbol ?? ""}`;
  return candidates
    .filter((c) => c.mint !== target.mint)
    .map((c) => {
      const sim = narrativeSimilarity(tId, `${c.name ?? ""} ${c.symbol ?? ""}`);
      return { mint: c.mint, similarity: sim, relationship: sim >= 0.85 ? "clone_of" as const : "same_narrative" as const };
    })
    .filter((e) => e.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}

// ── Holder distribution entropy (0-100, higher = more decentralised) ──
export function holderEntropyScore(balances: number[]): number {
  const xs = balances.filter((b) => b > 0);
  const total = xs.reduce((a, b) => a + b, 0);
  if (total <= 0 || xs.length < 2) return 0;
  const H = -xs.reduce((acc, b) => { const p = b / total; return acc + p * Math.log(p); }, 0);
  const Hmax = Math.log(xs.length);
  return clamp((H / Hmax) * 100);
}

// ── Liquidity stability index (0-100, higher = more stable) ──
export function liquidityStabilityIndex(liqSeries: number[]): number {
  const xs = liqSeries.filter((x) => Number.isFinite(x) && x >= 0);
  if (xs.length < 2) return 0;
  const m = mean(xs);
  if (m === 0) return 0;
  const cv = stdev(xs) / m; // coefficient of variation
  return clamp(100 * (1 - Math.min(cv, 1)));
}

// ── Hype decay prediction (0-100 probability hype is fading) ──
export function hypeDecayScore(series: SeriesPoint[]): number {
  const sorted = series.slice().sort((a, b) => a.t - b.t);
  if (sorted.length < 3) return 0;
  const vols = sorted.map((p) => p.volume ?? 0);
  const half = Math.max(1, Math.floor(vols.length / 2));
  const recentVol = mean(vols.slice(-half));
  const earlyVol = mean(vols.slice(0, half));
  const volDrop = earlyVol > 0 ? clamp((1 - recentVol / earlyVol) * 100) : 0;
  const life = reconstructLifecycle(sorted);
  const drawdownWeight = life.stage === "decline" ? life.drawdownFromPeakPct : life.drawdownFromPeakPct * 0.5;
  return clamp(0.6 * volDrop + 0.4 * drawdownWeight);
}

// ── Explanation engines ─────────────────────────────────────
export function whyTrending(metrics: { velocity: number; volume24hUsd?: number; priceChange24h?: number; scans24h?: number }): string {
  const bits: string[] = [];
  if (metrics.velocity >= 70) bits.push("sharp momentum acceleration");
  else if (metrics.velocity >= 50) bits.push("steady upward momentum");
  if ((metrics.priceChange24h ?? 0) >= 20) bits.push(`price up ${Math.round(metrics.priceChange24h!)}% (24h)`);
  if ((metrics.volume24hUsd ?? 0) >= 100_000) bits.push("elevated trading volume");
  if ((metrics.scans24h ?? 0) >= 10) bits.push(`${metrics.scans24h} scans in 24h`);
  if (bits.length === 0) return "No strong trending signal yet.";
  return `Trending on ${bits.join(", ")}.`;
}

export function whyExists(token: { name?: string; symbol?: string; narrative?: string; isOg?: boolean; cloneOf?: string }): string {
  const id = token.symbol ? `$${token.symbol}` : token.name ?? "This token";
  if (token.isOg) return `${id} is the original instance of the ${token.narrative ?? token.name ?? "its"} narrative.`;
  if (token.cloneOf) return `${id} is a derivative riding the ${token.cloneOf} narrative.`;
  return `${id} appears to be part of the ${token.narrative ?? token.name ?? "open"} narrative cluster.`;
}
