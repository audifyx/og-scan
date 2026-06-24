import { TokenDetailData } from "./api";

/* =========================================================================
 * OG DEX Predictive Intelligence — heuristic, transparent on-chain model.
 * These are statistical estimates derived from current on-chain signals,
 * NOT financial advice and NOT guarantees. Every output exposes its drivers.
 * ========================================================================= */

export interface SurvivalPoint { days: number; prob: number; }
export interface McProb { label: string; mult: number; prob: number; }
export interface Driver { label: string; impact: "pos" | "neg" | "neutral"; detail: string; }
export interface Predictive {
  survival: SurvivalPoint[];
  survivalScore: number;
  hazardLabel: string;
  upside: McProb[];
  upsideScore: number;
  expectedMcap30d: { low: number | null; base: number | null; high: number | null };
  drivers: Driver[];
  confidence: "low" | "medium" | "high";
}

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const num = (v: any): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

function gather(d: TokenDetailData) {
  const t: any = d.token || {};
  const meta: any = d.meta || {};
  const intel: any = (d as any).intel || {};
  const safety: any = d.safety || intel.safety || {};
  const flags: any = d.flags || {};
  const holders: any[] = intel.holders || [];
  const real = holders.filter((h) => h.label !== "liquidity pool" && h.label !== "burn");
  const top10 = real.slice(0, 10).reduce((s, h) => s + (h.pct || 0), 0);
  const buyVol = num(meta.buyVolume24h ?? t.buyVolume);
  const sellVol = num(meta.sellVolume24h ?? t.sellVolume);
  const bp = buyVol != null && sellVol != null && buyVol + sellVol > 0 ? buyVol / (buyVol + sellVol) : null;
  return {
    t, meta, intel, safety, flags, holders, real, top10, buyVol, sellVol, bp,
    mcap: num(t.mcap ?? meta.mcap),
    liq: num(t.liquidity ?? meta.liquidity),
    vol: num(t.volume ?? (buyVol || 0) + (sellVol || 0)),
    age: num(meta.ageDays),
    poolAge: num(meta.poolAgeDays ?? meta.ageDays),
    organic: num(t.organicScore ?? meta.organicScore),
    risk: num(safety.riskScore),
    lpLocked: num(safety.lpLockedPct),
    og: num(d.score?.total ?? meta.organicScore),
    momentum: num(d.momentum ?? meta.momentum),
    netBuyers: num(meta.netBuyers24h),
    whales: holders.filter((h) => h.label === "whale").length,
  };
}

/** Survival modeling: daily hazard rate -> exponential survival curve. */
function survivalModel(g: ReturnType<typeof gather>, drivers: Driver[]) {
  let h = 0.022; // baseline daily failure hazard for a fresh SPL token
  const F = g.flags, S = g.safety;

  if (S?.rugged) { h *= 12; drivers.push({ label: "Rugged", impact: "neg", detail: "Flagged as already rugged" }); }
  if (F?.lpPulled) { h *= 6; drivers.push({ label: "LP pulled", impact: "neg", detail: "Liquidity removal detected" }); }

  if (F?.mintAuthorityDisabled) { h *= 0.6; drivers.push({ label: "Mint renounced", impact: "pos", detail: "Fixed supply integrity" }); }
  else { h *= 1.6; drivers.push({ label: "Mint authority active", impact: "neg", detail: "Supply can be inflated" }); }

  if (F?.freezeAuthorityDisabled) h *= 0.72; else { h *= 1.5; drivers.push({ label: "Freeze authority active", impact: "neg", detail: "Accounts can be frozen" }); }

  if (g.lpLocked != null) {
    if (g.lpLocked > 50) { h *= 0.6; drivers.push({ label: `LP ${g.lpLocked.toFixed(0)}% locked`, impact: "pos", detail: "Liquidity hard to pull" }); }
    else if (g.lpLocked < 10) h *= 1.3;
  }
  if (F?.minLiquidity) h *= 0.8; else h *= 1.35;

  if (g.liq != null) {
    if (g.liq > 100000) { h *= 0.7; drivers.push({ label: "Deep liquidity", impact: "pos", detail: "$" + Math.round(g.liq).toLocaleString() }); }
    else if (g.liq < 10000) { h *= 1.8; drivers.push({ label: "Thin liquidity", impact: "neg", detail: "$" + Math.round(g.liq).toLocaleString() }); }
    else h *= 1.15;
  }

  if (g.risk != null) h *= 0.7 + (g.risk / 100) * 1.3;
  if (g.organic != null) { if (g.organic >= 70) h *= 0.75; else if (g.organic < 30) h *= 1.3; }

  if (g.whales > 0) { h *= Math.min(1 + g.whales * 0.12, 1.8); drivers.push({ label: `${g.whales} whale wallet(s)`, impact: "neg", detail: "Holders >5% of supply" }); }
  if (g.top10 > 50) { h *= 1.5; drivers.push({ label: "Concentrated top 10", impact: "neg", detail: g.top10.toFixed(0) + "% of supply" }); }
  else if (g.top10 > 0 && g.top10 < 25) drivers.push({ label: "Broad distribution", impact: "pos", detail: "Top 10 hold " + g.top10.toFixed(0) + "%" });

  if (g.age != null) {
    if (g.age > 90) { h *= 0.6; drivers.push({ label: "Established age", impact: "pos", detail: g.age + " days survived" }); }
    else if (g.age >= 30) h *= 0.8;
    else if (g.age < 3) { h *= 1.4; drivers.push({ label: "Very new", impact: "neg", detail: g.age + "d old" }); }
  }

  h = clamp(h, 0.0008, 0.6);
  const surv = (days: number) => Math.exp(-h * days);
  const survival: SurvivalPoint[] = [7, 30, 90].map((days) => ({ days, prob: surv(days) }));
  const s90 = surv(90);
  const hazardLabel = S?.rugged || F?.lpPulled ? "Critical" : s90 > 0.7 ? "Low" : s90 > 0.4 ? "Moderate" : s90 > 0.15 ? "High" : "Critical";
  return { survival, survivalScore: Math.round(surv(30) * 100), hazardLabel, surv };
}

/** Upside modeling: blended growth-potential score -> multiple probabilities + mcap scenarios. */
function upsideModel(g: ReturnType<typeof gather>, surv: (d: number) => number, drivers: Driver[]) {
  const parts: number[] = [];
  if (g.momentum != null) parts.push(clamp(g.momentum / 100));
  if (g.organic != null) parts.push(clamp(g.organic / 100));
  if (g.bp != null) { parts.push(clamp(g.bp)); if (g.bp > 0.6) drivers.push({ label: "Buy pressure", impact: "pos", detail: (g.bp * 100).toFixed(0) + "% buys (24h)" }); else if (g.bp < 0.4) drivers.push({ label: "Sell pressure", impact: "neg", detail: (g.bp * 100).toFixed(0) + "% buys (24h)" }); }
  if (g.liq != null && g.mcap) { const r = g.liq / g.mcap; parts.push(clamp(r / 0.06)); }
  if (g.vol != null && g.mcap) { const r = g.vol / g.mcap; parts.push(clamp(r / 1.5)); if (r > 0.5) drivers.push({ label: "High turnover", impact: "pos", detail: (r * 100).toFixed(0) + "% vol/mcap" }); }
  if (g.netBuyers != null) parts.push(clamp(0.5 + Math.sign(g.netBuyers) * 0.2));

  let upside = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0.4;
  if (g.age != null && g.age < 7) upside = clamp(upside + 0.08); // early-stage convexity
  upside = clamp(upside);

  const s30 = surv(30);
  const mk = (label: string, mult: number, base: number, sw: number): McProb =>
    ({ label, mult, prob: clamp(base) * (sw + (1 - sw) * s30) });
  const upsideProbs: McProb[] = [
    mk("2x", 2, 0.05 + upside * 0.6, 0.4),
    mk("5x", 5, upside * 0.28, 0.3),
    mk("10x", 10, upside * 0.12, 0.25),
  ];

  const mcap = g.mcap;
  const drift = upside - 0.45;
  const expectedMcap30d = mcap == null ? { low: null, base: null, high: null } : {
    low: Math.max(mcap * 0.15, mcap * (0.45 + 0.45 * s30)),
    base: mcap * (0.85 + upside * 0.9),
    high: mcap * (1.2 + upside * 3.2),
  };
  return { upside: upsideProbs, upsideScore: Math.round(upside * 100), expectedMcap30d };
}

export function computePredictive(d: TokenDetailData): Predictive {
  const g = gather(d);
  const drivers: Driver[] = [];
  const surv = survivalModel(g, drivers);
  const up = upsideModel(g, surv.surv, drivers);
  const present = [g.mcap, g.liq, g.organic, g.risk, g.age, g.holders.length || null].filter((x) => x != null).length;
  const confidence = present >= 5 ? "high" : present >= 3 ? "medium" : "low";
  // dedupe + prioritise drivers (neg first, then pos)
  const seen = new Set<string>();
  const ranked = drivers.filter((x) => (seen.has(x.label) ? false : seen.add(x.label)))
    .sort((a, b) => (a.impact === b.impact ? 0 : a.impact === "neg" ? -1 : 1)).slice(0, 8);
  return {
    survival: surv.survival, survivalScore: surv.survivalScore, hazardLabel: surv.hazardLabel,
    upside: up.upside, upsideScore: up.upsideScore, expectedMcap30d: up.expectedMcap30d,
    drivers: ranked, confidence,
  };
}

/* ============================ Capital flow / smart money ===================== */

export interface FlowTrade { side: string; volumeUsd: number; owner?: string; time?: number; }
export interface CapitalFlow {
  buyVol24h: number | null; sellVol24h: number | null; net24h: number | null; buyPct: number | null;
  netBuyers24h: number | null; traders24h: number | null;
  recentNet: number; recentBuys: number; recentSells: number;
  topBuys: FlowTrade[]; topSells: FlowTrade[];
  whales: { owner: string; pct: number; usd: number | null; label: string }[];
  smartScore: number; flowLabel: string;
  metrics: { label: string; value: string; tone: "pos" | "neg" | "neutral" }[];
}

export function computeCapitalFlow(d: TokenDetailData): CapitalFlow {
  const t: any = d.token || {};
  const meta: any = d.meta || {};
  const intel: any = (d as any).intel || {};
  const price = num(t.priceUsd ?? meta.priceUsd);
  const trades: any[] = intel.trades || [];
  const holders: any[] = intel.holders || [];

  const buyVol24h = num(meta.buyVolume24h ?? t.buyVolume);
  const sellVol24h = num(meta.sellVolume24h ?? t.sellVolume);
  const net24h = buyVol24h != null && sellVol24h != null ? buyVol24h - sellVol24h : null;
  const buyPct = buyVol24h != null && sellVol24h != null && buyVol24h + sellVol24h > 0 ? (buyVol24h / (buyVol24h + sellVol24h)) * 100 : null;

  const buys = trades.filter((x) => x.side === "buy");
  const sells = trades.filter((x) => x.side === "sell");
  const sumUsd = (a: any[]) => a.reduce((s, x) => s + (num(x.volumeUsd) || 0), 0);
  const recentNet = sumUsd(buys) - sumUsd(sells);
  const byUsd = (a: any[]) => [...a].sort((x, y) => (num(y.volumeUsd) || 0) - (num(x.volumeUsd) || 0)).slice(0, 4)
    .map((x) => ({ side: x.side, volumeUsd: num(x.volumeUsd) || 0, owner: x.owner, time: x.time }));

  const whales = holders.filter((h) => h.label === "whale" || h.label === "large holder")
    .slice(0, 6).map((h) => ({ owner: h.owner, pct: h.pct || 0, usd: price && h.uiAmount ? h.uiAmount * price : null, label: h.label }));

  // smart-money / accumulation score
  let score = 50;
  if (buyPct != null) score += (buyPct - 50) * 0.6;
  if (recentNet !== 0) score += clamp(recentNet / (Math.abs(recentNet) + 5000)) * 18 * Math.sign(recentNet);
  const nb = num(meta.netBuyers24h); if (nb != null) score += clamp(nb / 200) * 14 * Math.sign(nb);
  if (whales.length >= 3) score -= 8;
  score = Math.round(clamp(score, 0, 100));
  const flowLabel = score >= 60 ? "Accumulation" : score <= 40 ? "Distribution" : "Balanced";

  const fmt = (n: number) => (n >= 0 ? "+$" : "-$") + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const metrics: CapitalFlow["metrics"] = [];
  if (net24h != null) metrics.push({ label: "Net flow (24h)", value: fmt(net24h), tone: net24h >= 0 ? "pos" : "neg" });
  if (buyPct != null) metrics.push({ label: "Buy share (24h)", value: buyPct.toFixed(0) + "%", tone: buyPct >= 50 ? "pos" : "neg" });
  metrics.push({ label: "Net flow (recent feed)", value: fmt(recentNet), tone: recentNet >= 0 ? "pos" : "neg" });
  if (nb != null) metrics.push({ label: "Net buyers (24h)", value: nb.toLocaleString(), tone: nb >= 0 ? "pos" : "neg" });
  if (meta.numTraders24h != null) metrics.push({ label: "Active traders (24h)", value: Number(meta.numTraders24h).toLocaleString(), tone: "neutral" });
  if (whales.length) metrics.push({ label: "Whale wallets", value: String(whales.length), tone: whales.length >= 3 ? "neg" : "neutral" });

  return {
    buyVol24h, sellVol24h, net24h, buyPct, netBuyers24h: nb, traders24h: num(meta.numTraders24h),
    recentNet, recentBuys: buys.length, recentSells: sells.length,
    topBuys: byUsd(buys), topSells: byUsd(sells), whales, smartScore: score, flowLabel, metrics,
  };
}
