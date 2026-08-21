import { describe, expect, it } from "vitest";
import {
  computeOrbitXTokenIntel,
  snapshotFromComposeRiskInput,
  snapshotFromDexSources,
  toOgCompositeScore,
} from "../../shared/orbitx-token-score.js";

const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const NOW = 1_787_330_000_000; // ~ Aug 21 2026

function score(partial: Record<string, unknown>) {
  return computeOrbitXTokenIntel({ nowMs: NOW, ...partial });
}

describe("OrbitX Token Intelligence Score", () => {
  it("does not treat missing data as danger", () => {
    const r = score({});
    expect(r.overall_score).toBeNull();
    expect(r.safety_score).toBeNull();
    expect(r.confidence).toBe("UNKNOWN");
    expect(r.risk_level).toBe("unknown");
    expect(r.critical_risks).toHaveLength(0);
    expect(r.risk_signals).toHaveLength(0);
  });

  it("caps confirmed honeypots at 20", () => {
    const r = score({ canBuy: true, canSell: false });
    expect(r.overall_score).toBeLessThanOrEqual(20);
    expect(r.safety_score).toBeLessThanOrEqual(20);
    expect(r.critical_risks.some((s) => s.name === "cannot_sell")).toBe(true);
    expect(r.risk_level).toBe("critical");
  });

  it("scores a legitimate new micro-cap well when mechanics are healthy", () => {
    const r = score({
      createdAtMs: NOW - 10 * 60 * 1000,
      liquidityUsd: 5_000,
      marketCapUsd: 15_000,
      mintAuthorityActive: false,
      freezeAuthorityActive: false,
      canBuy: true,
      canSell: true,
      sellSuccessObserved: true,
      lpBurned: true,
      holderCount: 48,
      top10Pct: 42,
      uniqueTraders: 22,
      buyVolume: 1_200,
      sellVolume: 900,
      volume24h: 2_100,
    });
    expect(r.safety_score).toBeGreaterThanOrEqual(70);
    expect(r.overall_score).toBeGreaterThanOrEqual(70);
    expect(r.maturity_score).toBeLessThan(30);
    expect(r.positive_signals.some((s) => s.name === "mint_revoked")).toBe(true);
    expect(r.positive_signals.some((s) => s.name === "healthy_liq_mcap")).toBe(true);
    expect(r.label).toMatch(/Good|Strong|Excellent/);
  });

  it("treats $5k liquidity on $15k mcap as reasonable and $5k on $5M as exit risk", () => {
    const small = score({
      liquidityUsd: 5_000,
      marketCapUsd: 15_000,
      canSell: true,
    });
    const huge = score({
      liquidityUsd: 5_000,
      marketCapUsd: 5_000_000,
      canSell: true,
    });
    expect(small.positive_signals.some((s) => s.name === "healthy_liq_mcap")).toBe(true);
    expect(huge.risk_signals.some((s) => s.name === "exit_liq_thin") || huge.critical_risks.length).toBeTruthy();
    expect((huge.category_scores.liquidity.points || 0) < (small.category_scores.liquidity.points || 0)).toBe(true);
  });

  it("does not auto-fail active mint authority without abuse evidence", () => {
    const r = score({
      mintAuthorityActive: true,
      mintAuthorityKind: "multisig",
      freezeAuthorityActive: false,
      canSell: true,
      liquidityUsd: 20_000,
      marketCapUsd: 40_000,
    });
    expect(r.overall_score).toBeGreaterThanOrEqual(60);
    const mint = r.risk_signals.find((s) => s.name === "mint_active");
    expect(mint?.severity).toMatch(/low|medium/);
    expect(r.critical_risks.some((s) => s.name === "mint_active")).toBe(false);
  });

  it("does not double-penalize deployer concentration as top-holder + whale + distribution", () => {
    const r = score({
      deployerPct: 40,
      top1Pct: 40,
      top10Pct: 55,
      holders: [{ address: "Dev111111111111111111111111111111111111111", pct: 40, role: "deployer" }],
      canSell: true,
    });
    const conc = r.signals.filter((s) => s.group === "concentration");
    expect(conc.length).toBeLessThanOrEqual(1);
  });

  it("excludes LP and burn wallets from whale concentration", () => {
    const r = score({
      holders: [
        { address: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j", pct: 48, role: "lp" },
        { address: "1nc1nerator11111111111111111111111111111111", pct: 20, role: "burn" },
        { address: "SomeHolder11111111111111111111111111111111", pct: 8, role: "holder" },
      ],
      canSell: true,
    });
    expect(r.risk_signals.some((s) => s.name.includes("concentration") && s.severity === "high")).toBe(false);
    expect(r.positive_signals.some((s) => s.name === "top_holder_infrastructure") || r.signals.some((s) => s.name === "top_holder_infrastructure")).toBe(true);
  });

  it("keeps Token-2022 benign without dangerous extensions", () => {
    const r = score({
      tokenProgram: "token-2022",
      mintAuthorityActive: false,
      freezeAuthorityActive: false,
      canSell: true,
    });
    expect(r.positive_signals.some((s) => s.name === "token2022_benign")).toBe(true);
    expect(r.overall_score).toBeGreaterThanOrEqual(70);
  });

  it("scores live ORBITX-like meme profile as Good/Strong, not High Risk", () => {
    const r = score({
      mint: ORBITX_MINT,
      createdAtMs: NOW - 10.5 * 86_400_000,
      liquidityUsd: 17_910,
      marketCapUsd: 53_848,
      volume24h: 17_857,
      buyVolume: 9_100,
      sellVolume: 8_750,
      uniqueTraders: 90,
      holderCount: 320,
      top10Pct: 44,
      mintAuthorityActive: false,
      freezeAuthorityActive: false,
      canBuy: true,
      canSell: true,
      sellSuccessObserved: true,
      poolCount: 1,
    });
    expect(r.overall_score).toBeGreaterThanOrEqual(72);
    expect(r.safety_score).toBeGreaterThanOrEqual(75);
    expect(r.maturity_score).toBeGreaterThan(40);
    expect(r.maturity_score).toBeLessThan(70);
    expect(r.label).toMatch(/Good|Strong|Excellent/);
    expect(["low", "moderate"]).toContain(r.risk_level);
    expect(r.positive_signals.some((s) => s.name === "healthy_liq_mcap")).toBe(true);
  });

  it("distinguishes dangerous new vs legitimate new", () => {
    const legit = score({
      createdAtMs: NOW - 8 * 60 * 1000,
      mintAuthorityActive: false,
      freezeAuthorityActive: false,
      liquidityUsd: 8_000,
      marketCapUsd: 22_000,
      canSell: true,
      sellSuccessObserved: true,
      lpBurned: true,
    });
    const honeypot = score({
      createdAtMs: NOW - 8 * 60 * 1000,
      mintAuthorityActive: false,
      freezeAuthorityActive: false,
      liquidityUsd: 80_000,
      marketCapUsd: 200_000,
      canSell: false,
      holderCount: 4_000,
    });
    expect(legit.overall_score).toBeGreaterThanOrEqual(70);
    expect(honeypot.overall_score).toBeLessThanOrEqual(20);
    expect((legit.overall_score || 0) - (honeypot.overall_score || 0)).toBeGreaterThan(40);
  });

  it("does not penalize a new deployer wallet as a rug", () => {
    const r = score({
      mintAuthorityActive: false,
      freezeAuthorityActive: false,
      canSell: true,
      deployer: { walletAgeMs: 3 * 3_600_000, tokensDeployed: 1, priorRugs: 0 },
    });
    expect(r.risk_signals.some((s) => s.name === "new_deployer_wallet")).toBe(false);
    expect(r.signals.some((s) => s.name === "new_deployer_wallet" && s.points === 0)).toBe(true);
    expect(r.overall_score).toBeGreaterThanOrEqual(70);
  });

  it("caps known rugs and preserves explainability", () => {
    const r = score({
      rugged: true,
      liquidityUsd: 200_000,
      holderCount: 10_000,
      canSell: true,
    });
    expect(r.overall_score).toBeLessThanOrEqual(15);
    expect(r.explanation.concerns.length).toBeGreaterThan(0);
  });

  it("emits OG composite shape without using age as the headline score", () => {
    const intel = score({
      createdAtMs: NOW - 20 * 60 * 1000,
      mintAuthorityActive: false,
      freezeAuthorityActive: false,
      canSell: true,
      liquidityUsd: 6_000,
      marketCapUsd: 12_000,
    });
    const og = toOgCompositeScore(intel, { isPumpFunClone: true });
    expect(og.total).toBe(intel.overall_score);
    expect(og.signals.contract).toBeGreaterThan(50);
    expect(og.intel.maturity_score).toBeLessThan(og.intel.safety_score || 100);
  });

  it("builds a snapshot from DEX payload fields without inventing authorities", () => {
    const snap = snapshotFromDexSources({
      mint: ORBITX_MINT,
      token: { liquidity: 17910, mcap: 53848, volume: 17857, holderCount: 320 },
      meta: { ageDays: 10 },
      safety: {},
      now: NOW,
    });
    expect(snap.mintAuthorityActive).toBeNull();
    const r = computeOrbitXTokenIntel({ ...snap, nowMs: NOW });
    expect(r.positive_signals.some((s) => s.name === "healthy_liq_mcap")).toBe(true);
    expect(r.risk_signals.some((s) => s.name === "mint_active")).toBe(false);
  });

  it("maps compose-risk empty input to unknown, not a numeric scare", () => {
    const snap = snapshotFromComposeRiskInput({});
    const r = computeOrbitXTokenIntel(snap);
    expect(r.confidence).toBe("UNKNOWN");
    expect(r.overall_score).toBeNull();
  });
});
