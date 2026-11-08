import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  CrossScanComparePanel,
  EntryExitPlannerPanel,
  MetadataAuditPanel,
  PoolVerificationPanel,
  SlippageEstimatorPanel,
  buildCompareRows,
  buildEntryLadder,
  checkMintMatch,
  metadataUpdateAuthority,
  parseCompareMints,
  riskRewardSplit,
  verifyPoolProgram,
  KNOWN_POOL_PROGRAMS,
  MAX_COMPARE_TOKENS,
  SLIPPAGE_PRESET_SIZES_USD,
  type CompareSummary,
} from "./TokenPanels";

/** Scanner v2 W5 (2026-11-08): entry/exit ladder + R:R visual, slippage
 *  presets, compare-up-to-4, pool-program + CA verification, metadata
 *  update authority. All pure helpers are tested directly; panels are
 *  tested for rendering the honest states (verified / unknown / mismatch). */

const MINT_A = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const MINT_B = "So11111111111111111111111111111111111111112";
const MINT_C = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MINT_D = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const RAYDIUM_V4 = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const PUMPFUN = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uMJ9Jv";

function summary(over: Partial<CompareSummary> & { mint: string }): CompareSummary {
  return {
    name: null,
    symbol: null,
    priceUsd: null,
    mcap: null,
    liquidityUsd: null,
    ogScore: null,
    riskScore: null,
    top10Pct: null,
    lpLockedPct: null,
    bundledPct: null,
    holders: null,
    loading: false,
    error: null,
    ...over,
  };
}

describe("buildEntryLadder (ladder math)", () => {
  it("ladders 3 rungs at 0 / -5 / -10% with an equal split", () => {
    const ladder = buildEntryLadder(0.01, 300, 3);
    expect(ladder).not.toBeNull();
    const prices = ladder!.rungs.map((r) => r.price);
    expect(prices[0]).toBeCloseTo(0.01, 8);
    expect(prices[1]).toBeCloseTo(0.0095, 8);
    expect(prices[2]).toBeCloseTo(0.009, 8);
    expect(ladder!.rungs.map((r) => r.sizeUsd)).toEqual([100, 100, 100]);
    expect(ladder!.rungs[0].tokens).toBeCloseTo(10000, 5);
    expect(ladder!.rungs[2].tokens).toBeCloseTo(11111.11, 1);
    expect(ladder!.totalTokens).toBeCloseTo(31637.43, 1);
    expect(ladder!.avgEntry).toBeCloseTo(0.009482, 5);
  });
  it("take-profits are 2x/3x/5x of the average entry", () => {
    const ladder = buildEntryLadder(0.01, 300, 3)!;
    expect(ladder.takeProfits.map((t) => t.multiple)).toEqual([2, 3, 5]);
    expect(ladder.takeProfits[0].price).toBeCloseTo(ladder.avgEntry * 2, 8);
    expect(ladder.takeProfits[0].proceedsUsd).toBeCloseTo(600, 5);
    expect(ladder.takeProfits[2].proceedsUsd).toBeCloseTo(1500, 5);
  });
  it("clamps rungs to 2..4 and returns null for bad inputs", () => {
    expect(buildEntryLadder(0.01, 100, 9)!.rungs.length).toBe(4);
    expect(buildEntryLadder(0.01, 100, 1)!.rungs.length).toBe(2);
    expect(buildEntryLadder(0.01, 100, 4)!.rungs.map((r) => r.dipPct)).toEqual([0, 5, 10, 15]);
    expect(buildEntryLadder(0, 100, 3)).toBeNull();
    expect(buildEntryLadder(0.01, 0, 3)).toBeNull();
    expect(buildEntryLadder(NaN, 100, 3)).toBeNull();
  });
});

describe("riskRewardSplit (R:R visual)", () => {
  it("splits risk vs reward proportionally", () => {
    const split = riskRewardSplit(20, 100)!;
    expect(split.riskShare).toBeCloseTo(16.67, 2);
    expect(split.rewardShare).toBeCloseTo(83.33, 2);
    expect(split.riskShare + split.rewardShare).toBeCloseTo(100, 8);
  });
  it("returns null without a positive risk and reward", () => {
    expect(riskRewardSplit(0, 100)).toBeNull();
    expect(riskRewardSplit(20, 0)).toBeNull();
    expect(riskRewardSplit(NaN, 100)).toBeNull();
  });
});

describe("slippage presets", () => {
  it("preset sizes are $100 / $500 / $1k / $5k", () => {
    expect(SLIPPAGE_PRESET_SIZES_USD).toEqual([100, 500, 1000, 5000]);
  });
  it("tapping $500 sets the size and re-runs the same CPAMM model", () => {
    render(<SlippageEstimatorPanel token={{ priceUsd: 0.01 }} dexPairs={[{ liquidityUsd: 100000 }]} />);
    expect(screen.getByText("0.10%")).toBeTruthy(); // $100 default
    fireEvent.click(screen.getByRole("button", { name: "$500" }));
    expect(screen.getByDisplayValue("500")).toBeTruthy();
    expect(screen.getByText("0.50%")).toBeTruthy(); // 500 / 100500
    fireEvent.click(screen.getByRole("button", { name: "$5k" }));
    expect(screen.getByDisplayValue("5000")).toBeTruthy();
    expect(screen.getByText("4.76%")).toBeTruthy(); // 5000 / 105000
  });
});

describe("parseCompareMints (?compare= comma-separated)", () => {
  it("caps at 3 extra mints, drops invalids and duplicates", () => {
    expect(parseCompareMints(null)).toEqual([]);
    expect(parseCompareMints("")).toEqual([]);
    expect(parseCompareMints(MINT_B)).toEqual([MINT_B]);
    expect(parseCompareMints(`${MINT_B},not-a-mint,${MINT_C},${MINT_B},${MINT_D},${MINT_A}`)).toEqual([
      MINT_B,
      MINT_C,
      MINT_D,
    ]);
    expect(MAX_COMPARE_TOKENS).toBe(4);
  });
});

describe("buildCompareRows + compare-4 rendering", () => {
  const four = [
    summary({ mint: MINT_A, symbol: "ALPHA", ogScore: 80, riskScore: 75, mcap: 1000000, liquidityUsd: 80000, priceUsd: 0.01, top10Pct: 20, lpLockedPct: 90, bundledPct: 5, holders: 1000 }),
    summary({ mint: MINT_B, symbol: "BETA", ogScore: 40, riskScore: 35, mcap: 500000, liquidityUsd: 40000, priceUsd: 0.02, top10Pct: 60, lpLockedPct: 10, bundledPct: 40, holders: 200 }),
    summary({ mint: MINT_C, symbol: "GAMMA", ogScore: 60, riskScore: 50, mcap: 2000000, liquidityUsd: 60000, priceUsd: 0.005, top10Pct: 30, lpLockedPct: 50, bundledPct: 15, holders: 500 }),
    summary({ mint: MINT_D, symbol: "DELTA", ogScore: null, riskScore: null, mcap: null, liquidityUsd: null, priceUsd: null, top10Pct: null, lpLockedPct: null, bundledPct: null, holders: null }),
  ];
  it("picks the best column per metric and keeps unknowns Unknown", () => {
    const rows = buildCompareRows(four);
    expect(rows.find((r) => r.label === "OG score")!.values).toEqual(["80/100", "40/100", "60/100", "Unknown"]);
    expect(rows.find((r) => r.label === "OG score")!.bestIndex).toBe(0);
    expect(rows.find((r) => r.label === "Top-10 holders")!.bestIndex).toBe(0); // lowest wins
    expect(rows.find((r) => r.label === "Bundled supply")!.bestIndex).toBe(0);
    expect(rows.find((r) => r.label === "Holders")!.bestIndex).toBe(0);
    expect(rows.find((r) => r.label === "Market cap")!.bestIndex).toBeNull(); // no "best"
    expect(rows.find((r) => r.label === "Price")!.bestIndex).toBeNull();
  });
  it("renders all four tokens side by side", () => {
    render(<CrossScanComparePanel summaries={four} onAddMint={() => {}} />);
    for (const s of ["ALPHA", "BETA", "GAMMA", "DELTA"]) expect(screen.getByText(s)).toBeTruthy();
    expect(screen.getByText("80/100")).toBeTruthy();
    expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(9);
    // Full at 4: no add-mint form offered.
    expect(screen.queryByPlaceholderText(/Add another mint/)).toBeNull();
  });
  it("legacy a/b props still render the 2-token table", () => {
    render(<CrossScanComparePanel a={four[0]} b={four[1]} />);
    expect(screen.getByText("OG score")).toBeTruthy();
    expect(screen.getByText("80/100")).toBeTruthy();
    expect(screen.getByText("40/100")).toBeTruthy();
  });
});

describe("verifyPoolProgram", () => {
  it("verifies known Raydium / pump.fun programs", () => {
    expect(KNOWN_POOL_PROGRAMS[RAYDIUM_V4]).toBe("Raydium AMM v4");
    expect(KNOWN_POOL_PROGRAMS[PUMPFUN]).toBe("pump.fun");
    expect(verifyPoolProgram(RAYDIUM_V4)).toEqual({ state: "pass", label: "Verified — Raydium AMM v4", programName: "Raydium AMM v4" });
    expect(verifyPoolProgram(PUMPFUN).state).toBe("pass");
  });
  it("never guesses: unknown program ids and missing data stay unknown", () => {
    expect(verifyPoolProgram("11111111111111111111111111111111").state).toBe("unknown");
    expect(verifyPoolProgram("11111111111111111111111111111111").programName).toBeNull();
    expect(verifyPoolProgram(null).state).toBe("unknown");
    expect(verifyPoolProgram(undefined).label).toMatch(/not observed/);
  });
});

describe("checkMintMatch (CA vs advertised address)", () => {
  it("matches when the payload mint is the scanned mint", () => {
    const c = checkMintMatch(MINT_A, MINT_A, 2);
    expect(c.state).toBe("pass");
    expect(c.label).toBe("Matches scanned mint");
    expect(c.detail).toMatch(/2 DexScreener pairs/);
  });
  it("flags a mismatch", () => {
    const c = checkMintMatch(MINT_A, MINT_B, 1);
    expect(c.state).toBe("fail");
    expect(c.label).toMatch(/MISMATCH/);
  });
  it("stays unknown without a payload mint or pairs", () => {
    expect(checkMintMatch(MINT_A, null, 0).state).toBe("unknown");
    expect(checkMintMatch(MINT_A, MINT_A, 0).detail).toMatch(/could not be cross-checked/);
    expect(checkMintMatch(null, MINT_A, 0).state).toBe("unknown");
  });
});

describe("PoolVerificationPanel rendering", () => {
  it("shows verified program + matching mint", () => {
    render(
      <PoolVerificationPanel
        mint={MINT_A}
        token={{ mint: MINT_A }}
        forensics={{ concentration: { pools: [{ poolProgram: RAYDIUM_V4, pct: 100 }] } }}
        dexPairs={[{ dexId: "raydium", pairAddress: MINT_B }]}
      />,
    );
    expect(screen.getByText("Verified — Raydium AMM v4")).toBeTruthy();
    expect(screen.getByText("Matches scanned mint")).toBeTruthy();
    expect(screen.getByText(RAYDIUM_V4)).toBeTruthy();
  });
  it("is honest when nothing is observed", () => {
    render(<PoolVerificationPanel mint={MINT_A} token={{ mint: MINT_A }} forensics={null} dexPairs={[]} />);
    expect(screen.getByText(/pool program not observed/)).toBeTruthy();
    expect(screen.getByText("Matches scanned mint")).toBeTruthy();
    expect(screen.getByText(/could not be cross-checked/)).toBeTruthy();
  });
  it("flags a payload-mint mismatch", () => {
    render(<PoolVerificationPanel mint={MINT_A} token={{ mint: MINT_B }} forensics={null} dexPairs={[]} />);
    expect(screen.getByText(/MISMATCH/)).toBeTruthy();
  });
});

describe("metadataUpdateAuthority", () => {
  it("returns the authority when a feed provides it, null otherwise", () => {
    expect(metadataUpdateAuthority({ metadataUpdateAuthority: MINT_B })).toBe(MINT_B);
    expect(metadataUpdateAuthority({ updateAuthority: MINT_C })).toBe(MINT_C);
    expect(metadataUpdateAuthority({ name: "Nope" })).toBeNull();
    expect(metadataUpdateAuthority(null)).toBeNull();
  });
  it("renders Mutable with the address when known, honest unknown when not", () => {
    const { rerender } = render(
      <MetadataAuditPanel token={{ name: "Alpha", symbol: "ALPHA", metadataUpdateAuthority: MINT_B }} />,
    );
    expect(screen.getByText("Metadata update authority")).toBeTruthy();
    expect(screen.getByText("Mutable")).toBeTruthy();
    expect(screen.getByText("So11…1112")).toBeTruthy();
    rerender(<MetadataAuditPanel token={{ name: "Alpha", symbol: "ALPHA" }} />);
    expect(screen.getByText("Not observed")).toBeTruthy();
    expect(screen.getByText(/update authority not observed/i)).toBeTruthy();
  });
});

describe("EntryExitPlannerPanel ladder + R:R visual", () => {
  it("renders the ladder, TP levels and the risk/reward bar", () => {
    render(<EntryExitPlannerPanel token={{ priceUsd: 0.01 }} />);
    expect(screen.getByText(/Entry ladder — your plan, not a prediction/)).toBeTruthy();
    expect(screen.getByText("1 — now")).toBeTruthy();
    expect(screen.getByText("2 — -5% dip")).toBeTruthy();
    expect(screen.getByText("3 — -10% dip")).toBeTruthy();
    expect(screen.getByText("Average entry")).toBeTruthy();
    expect(screen.getByText("2x")).toBeTruthy();
    expect(screen.getByText("3x")).toBeTruthy();
    expect(screen.getByText("5x")).toBeTruthy();
    expect(screen.getByText("Risk -20%")).toBeTruthy();
    expect(screen.getByText("Reward +100%")).toBeTruthy();
    expect(screen.getByText("1 : 5.00")).toBeTruthy();
  });
});
