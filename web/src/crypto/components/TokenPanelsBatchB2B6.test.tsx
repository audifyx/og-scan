import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  BundleDecayPanel,
  CexDepositPanel,
  CostBasisPanel,
  CrossScanComparePanel,
  DevSellSimulatorPanel,
  ExitLiquidityPanel,
  GraduationTrackerPanel,
  LiquidityHealthPanel,
  LpDrainAlertPanel,
  RugAutopsyPanel,
  RugCheckPanel,
  RugRadarLeaderboardPanel,
  SlippageEstimatorPanel,
  Token2022Panel,
  priceImpactPct,
  type CompareSummary,
} from "./TokenPanels";

/** Scanner v2 batches B2–B6 (Team B wave 3): every panel renders an honest
 *  state — loading / available / "Unavailable — reason" — and the
 *  calculators use the named constant-product model, never a fake quote. */

const MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

describe("priceImpactPct (named model)", () => {
  it("is 0 for a zero-size sell and grows with size", () => {
    expect(priceImpactPct(0, 100000)).toBe(0);
    expect(priceImpactPct(1000, 100000)).toBeCloseTo(0.99, 2);
    expect(priceImpactPct(100000, 100000)).toBeCloseTo(50, 5);
  });
  it("returns null without liquidity", () => {
    expect(priceImpactPct(100, 0)).toBeNull();
    expect(priceImpactPct(100, NaN)).toBeNull();
  });
});

describe("B2 liquidity health", () => {
  it("says the dev can pull it when LP is unlocked", () => {
    render(
      <LiquidityHealthPanel
        token={{ liquidityUsd: 50000 }}
        forensics={{ safetyFlags: { lpLockedPct: 0, mintRenounced: false, freezeRenounced: false } }}
        dexPairs={[{ dexId: "raydium", liquidityUsd: 50000 }]}
        safety={null}
      />,
    );
    expect(screen.getByText("LP not locked — the dev can pull the liquidity.")).toBeTruthy();
    expect(screen.getByText("LP burned")).toBeTruthy();
  });

  it("renders a Team A verdict verbatim when supplied", () => {
    render(
      <LiquidityHealthPanel
        token={null}
        forensics={null}
        dexPairs={null}
        safety={null}
        liquidityHealth={{ verdict: "Team A says: LP is 100% burned, dev cannot pull it." }}
      />,
    );
    expect(screen.getByText("Team A says: LP is 100% burned, dev cannot pull it.")).toBeTruthy();
  });
});

describe("B3 graduation tracker", () => {
  it("says 'not a pump.fun token' for non-pump tokens", () => {
    render(<GraduationTrackerPanel forensics={{ isPumpFun: false }} token={null} />);
    expect(screen.getByText("Not a pump.fun token")).toBeTruthy();
  });
  it("says graduated when the bonding curve is complete", () => {
    render(<GraduationTrackerPanel forensics={{ isPumpFun: true, bondingComplete: true }} token={null} />);
    expect(screen.getAllByText("Graduated").length).toBeGreaterThanOrEqual(1);
  });
});

describe("B4 dev sell simulator + bundle decay + autopsy", () => {
  it("simulates a dev sell with the named model", () => {
    render(
      <DevSellSimulatorPanel
        token={{ priceUsd: 0.001, marketCap: 1000000 }}
        devWallet={{ available: true, wallet: "dev", solBalance: 1, solUnknown: false, totalUsd: 100, tokenCount: 1, tradeCount: 5, holdingPctOfToken: 10 }}
        dexPairs={[{ liquidityUsd: 50000 }]}
      />,
    );
    expect(screen.getByText("Dev holding")).toBeTruthy();
    expect(screen.getByText(/Constant-product estimate/)).toBeTruthy();
  });
  it("bundle decay says no prior observation on first scan", () => {
    render(
      <BundleDecayPanel
        bundle={{ mint: MINT, state: "complete", reason: null, analyzedAt: new Date().toISOString(), holdersTotal: 10, holdersAnalyzed: 10, holdersTraced: 10, holdersUntraced: 0, untracedAddresses: [], topHoldersSupplyPct: 20, bundledSupplyPct: 5, clusters: [], clusterCount: 0, devLinkedPct: 0, devLinkedWallets: [], creator: null, mintAuthority: null, creatorKnown: false, risk: "low", fundingSources: [] }}
      />,
    );
    expect(screen.getByText(/No prior observation/)).toBeTruthy();
  });
  it("rug autopsy says 'not rugged' for a live token", () => {
    render(<RugAutopsyPanel forensics={{ safetyFlags: { rugged: false, lpLockedPct: 80 } }} token={{ liquidityUsd: 40000 }} />);
    expect(screen.getByText("Not rugged")).toBeTruthy();
  });
});

describe("B5 slippage estimator + compare", () => {
  it("estimates slippage for a sized buy", () => {
    render(<SlippageEstimatorPanel token={{ priceUsd: 0.01 }} dexPairs={[{ liquidityUsd: 100000 }]} />);
    expect(screen.getByText("Est. slippage")).toBeTruthy();
  });
  it("compares two tokens metric by metric", () => {
    const a: CompareSummary = { mint: MINT, name: "Alpha", symbol: "ALPHA", priceUsd: 0.01, mcap: 1000000, liquidityUsd: 80000, ogScore: 80, riskScore: 75, top10Pct: 20, lpLockedPct: 90, bundledPct: 5, holders: 1000, loading: false, error: null };
    const b: CompareSummary = { mint: MINT, name: "Beta", symbol: "BETA", priceUsd: 0.02, mcap: 500000, liquidityUsd: 40000, ogScore: 40, riskScore: 35, top10Pct: 60, lpLockedPct: 10, bundledPct: 40, holders: 200, loading: false, error: null };
    render(<CrossScanComparePanel a={a} b={b} />);
    expect(screen.getByText("OG score")).toBeTruthy();
    expect(screen.getByText("Bundled supply")).toBeTruthy();
    expect(screen.getByText("80/100")).toBeTruthy();
  });
});

describe("B6 exit liquidity, LP drain, cost basis, RugCheck, CEX, Token-2022", () => {
  it("exit test shows proceeds at -10/-25/-50% and honest Jupiter unknowns when no feed returned", () => {
    render(<ExitLiquidityPanel token={{ priceUsd: 0.01, marketCap: 1000000 }} dexPairs={[{ liquidityUsd: 100000 }]} />);
    expect(screen.getByText("After -10%")).toBeTruthy();
    expect(screen.getByText("After -50%")).toBeTruthy();
    expect(screen.getByText("Jupiter sell quotes")).toBeTruthy();
    expect(screen.queryByText(/no Jupiter quote feed wired/)).toBeNull();
  });
  it("exit test renders real Jupiter sims when the feed returns them", () => {
    render(
      <ExitLiquidityPanel
        token={{ priceUsd: 0.01, marketCap: 1000000 }}
        dexPairs={[{ liquidityUsd: 100000 }]}
        exitLiquidity={{
          sell1Sol: { receivedUsd: 95, slippagePct: 5 },
          sell5Sol: { receivedUsd: 460, slippagePct: 8 },
          sell10PctSupply: null,
          drop10PctUsd: 5000,
          drop25PctUsd: 15000,
          drop50PctUsd: 50000,
          model: "live Jupiter lite-api quotes",
          reason: "10%-of-supply sell had no Jupiter route (size too large or no liquidity path)",
        }}
      />,
    );
    expect(screen.getByText(/\$95\.00/)).toBeTruthy();
    expect(screen.getByText(/slippage 5\.00%/)).toBeTruthy();
    expect(screen.getByText("$5.0K")).toBeTruthy();
    expect(screen.queryByText(/no Jupiter quote feed wired/)).toBeNull();
  });
  it("LP drain banner fires on a rugged token", () => {
    render(<LpDrainAlertPanel forensics={{ safetyFlags: { rugged: true } }} token={null} />);
    expect(screen.getByText(/LP DRAINED/)).toBeTruthy();
  });
  it("cost basis is honest about missing entry prices", () => {
    render(
      <CostBasisPanel
        token={{ priceUsd: 0.01, holders: [{ owner: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", pct: 5 }] }}
        forensics={null}
      />,
    );
    expect(screen.getByText(/Cannot compute/)).toBeTruthy();
  });
  it("RugCheck is unavailable when Team A reports null", () => {
    render(<RugCheckPanel rugCheck={null} />);
    expect(screen.getByText(/RugCheck unavailable/)).toBeTruthy();
  });
  it("Token-2022 audit and CEX monitoring report no feed", () => {
    render(<Token2022Panel token={null} />);
    expect(screen.getByText(/Token-2022 extensions audit/)).toBeTruthy();
    render(<CexDepositPanel />);
    expect(screen.getByText(/CEX deposit monitoring/)).toBeTruthy();
  });
  it("rug radar leaderboard is empty with no scans and notes the unscorable count is unknown", () => {
    render(<RugRadarLeaderboardPanel />);
    expect(screen.getByText(/No scans recorded yet/)).toBeTruthy();
    expect(screen.getByText(/Unscorable tokens: unknown/)).toBeTruthy();
  });
});
