import { useCallback, useEffect, useMemo, useState } from "react";
import {
  scanTokenFull,
  isValidMint,
  fetchDexPairs,
  fetchForensics,
  fetchResearchTyped,
  type DexPair,
  type ForensicsPayload,
  type ResearchPayload,
  type SafetyPayload,
  type TokenPayload,
} from "../api/client";
import { composeRisk, type ComposedRisk } from "../risk/composeRisk";
import { holderEntropyScore } from "@/lib/intelligence";

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
};

export type OgScoreCategory = {
  id: string;
  label: string;
  points: number;
  max: number;
  note: string;
};

export type OgScore = {
  /** 0–100, higher = safer. Null when there is no evidence at all. */
  score: number | null;
  band: string;
  label: string;
  categories: OgScoreCategory[];
  caps: string[];
  unknowns: string[];
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

  if (evidence === 0) {
    return { score: null, band: "Unknown", label: "Unverified — not enough signals", categories: cats, caps, unknowns };
  }
  const { band, label } = ogScoreBand(score);
  return { score, band, label, categories: cats, caps, unknowns };
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
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!mint || !isValidMint(mint)) {
      setSafety(null);
      setForensics(null);
      setToken(null);
      setRisk(null);
      setDexPairs(null);
      setResearch(null);
      setError(mint ? "Invalid mint address" : null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDexPairs(null);
    setResearch(null);

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

    return () => {
      cancelled = true;
    };
  }, [mint, tick]);

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
    });
  }, [safety, forensics, token, research]);

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
    refresh,
  };
}
