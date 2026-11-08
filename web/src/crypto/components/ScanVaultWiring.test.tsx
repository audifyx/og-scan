/**
 * W2 — scan vault wiring: recordScan stores a forensics snapshot, the
 * leaderboard ranks recorded scans by risk, and the snapshot-powered
 * panels diff against the prior vault snapshot (or say honestly that
 * there is no prior observation).
 */
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  bundleDecayFromSnapshots,
  clearVault,
  diffAuthorities,
  getLastSnapshot,
  getPriorSnapshot,
  honeypotFlipFromSnapshots,
  loadVault,
  lpDrainFromSnapshots,
  rankVaultByRisk,
  recordScan,
  type ScanSnapshot,
} from "../hooks/useScanVault";
import {
  BundleDecayPanel,
  ContractDiffPanel,
  LpDrainAlertPanel,
  RugCheckPanel,
  RugRadarLeaderboardPanel,
} from "./TokenPanels";

const MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const MINT2 = "So11111111111111111111111111111111111111112";

beforeEach(() => {
  window.localStorage.clear();
  clearVault();
});

function snap(over: Partial<ScanSnapshot> & { mint: string }): ScanSnapshot {
  return {
    ogScore: 62,
    riskScore: 41,
    scannedAt: Date.now(),
    ...over,
  };
}

describe("vault recording (W2 item 1)", () => {
  it("recordScan stores the forensics snapshot with the scan", () => {
    recordScan(
      snap({
        mint: MINT,
        name: "Test",
        symbol: "TST",
        ogScore: 62,
        riskScore: 41,
        bundledSupplyPct: 34.2,
        mintRenounced: false,
        freezeRenounced: true,
        lpLockedPct: 12,
        honeypot: false,
        liquidityUsd: 42000,
        scannedAt: 1000,
      }),
    );
    const last = getLastSnapshot(MINT);
    expect(last?.ogScore).toBe(62);
    expect(last?.mintRenounced).toBe(false);
    expect(last?.freezeRenounced).toBe(true);
    expect(last?.lpLockedPct).toBe(12);
    expect(last?.honeypot).toBe(false);
    expect(last?.liquidityUsd).toBe(42000);
    expect(last?.bundledSupplyPct).toBe(34.2);
  });

  it("getPriorSnapshot returns the scan before the newest, not the newest", () => {
    recordScan(snap({ mint: MINT, bundledSupplyPct: 40, scannedAt: 1000 }));
    recordScan(snap({ mint: MINT, bundledSupplyPct: 12, scannedAt: 2000 }));
    expect(getLastSnapshot(MINT)?.bundledSupplyPct).toBe(12);
    expect(getPriorSnapshot(MINT)?.bundledSupplyPct).toBe(40);
    expect(getPriorSnapshot(MINT2)).toBeNull();
  });
});

describe("snapshot diff helpers (W2 item 5)", () => {
  it("diffAuthorities reports a real authority change and only real ones", () => {
    const prior = snap({ mint: MINT, mintRenounced: false, freezeRenounced: true, scannedAt: 1000 });
    const changes = diffAuthorities({ mintRenounced: true, freezeRenounced: true }, prior);
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe("Mint authority");
    expect(changes[0].from).toBe("Live");
    expect(changes[0].to).toBe("Renounced");
    expect(diffAuthorities({ mintRenounced: false, freezeRenounced: true }, prior)).toEqual([]);
    expect(diffAuthorities({ mintRenounced: true, freezeRenounced: true }, null)).toEqual([]);
  });

  it("honeypotFlipFromSnapshots detects a flip and reports no flip honestly", () => {
    const prior = snap({ mint: MINT, honeypot: false, scannedAt: 1000 });
    const flip = honeypotFlipFromSnapshots(true, prior);
    expect(flip?.flipped).toBe(true);
    expect(flip?.from).toBe(false);
    expect(flip?.to).toBe(true);
    expect(honeypotFlipFromSnapshots(false, prior)?.flipped).toBe(false);
    expect(honeypotFlipFromSnapshots(true, null)).toBeNull();
    expect(honeypotFlipFromSnapshots(null, prior)).toBeNull();
  });

  it("bundleDecayFromSnapshots shows the bundled-% trend", () => {
    const prior = snap({ mint: MINT, bundledSupplyPct: 40, scannedAt: 1000 });
    const decay = bundleDecayFromSnapshots(12, prior);
    expect(decay?.deltaPct).toBeCloseTo(-28);
    expect(decay?.trend).toBe("falling");
    expect(bundleDecayFromSnapshots(41, prior)?.trend).toBe("rising");
    expect(bundleDecayFromSnapshots(null, prior)).toBeNull();
    expect(bundleDecayFromSnapshots(12, null)).toBeNull();
  });

  it("lpDrainFromSnapshots computes the liquidity drop %", () => {
    const prior = snap({ mint: MINT, liquidityUsd: 100000, scannedAt: 1000 });
    const drain = lpDrainFromSnapshots(40000, prior);
    expect(drain?.dropPct).toBeCloseTo(60);
    expect(lpDrainFromSnapshots(40000, null)).toBeNull();
  });
});

describe("rug radar leaderboard (W2 item 4)", () => {
  it("ranks recorded scans riskiest first and shows an honest empty state", () => {
    render(<RugRadarLeaderboardPanel />);
    expect(screen.getByText(/No scans recorded yet/)).toBeTruthy();

    recordScan(snap({ mint: MINT, symbol: "SAFE", ogScore: 80, riskScore: 30, scannedAt: 1000 }));
    recordScan(snap({ mint: MINT2, symbol: "RISKY", ogScore: 20, riskScore: 90, scannedAt: 2000 }));
    const ranked = rankVaultByRisk(loadVault());
    expect(ranked[0].mint).toBe(MINT2);
    expect(ranked[1].mint).toBe(MINT);

    const { container } = render(<RugRadarLeaderboardPanel />);
    const html = container.innerHTML;
    expect(html.indexOf("$RISKY")).toBeLessThan(html.indexOf("$SAFE"));
    expect(screen.getByText(/Ranked by risk from your scan vault/)).toBeTruthy();
  });
});

describe("snapshot-powered panels (W2 item 5)", () => {
  it("ContractDiffPanel renders a real authority change vs no prior observation", () => {
    // No prior observation: only one snapshot exists.
    recordScan(snap({ mint: MINT, mintRenounced: false, freezeRenounced: true, scannedAt: 1000 }));
    const { unmount } = render(
      <ContractDiffPanel
        forensics={{ safetyFlags: { mintRenounced: false, freezeRenounced: true } } as never}
        mint={MINT}
      />,
    );
    expect(screen.getByText(/No prior observation/)).toBeTruthy();
    unmount();

    // Second scan: mint authority went Live -> Renounced.
    recordScan(snap({ mint: MINT, mintRenounced: true, freezeRenounced: true, scannedAt: 2000 }));
    render(
      <ContractDiffPanel
        forensics={{ safetyFlags: { mintRenounced: true, freezeRenounced: true } } as never}
        mint={MINT}
      />,
    );
    expect(screen.getByText("Mint authority changed")).toBeTruthy();
    expect(screen.getByText("Live → Renounced")).toBeTruthy();
  });

  it("BundleDecayPanel renders decay vs no prior observation", () => {
    recordScan(snap({ mint: MINT, bundledSupplyPct: 40, scannedAt: 1000 }));
    const bundle = { bundledSupplyPct: 40, analyzedAt: new Date(1000).toISOString() } as never;
    const { unmount } = render(<BundleDecayPanel bundle={bundle} mint={MINT} />);
    expect(screen.getByText(/No prior observation/)).toBeTruthy();
    unmount();

    recordScan(snap({ mint: MINT, bundledSupplyPct: 12, scannedAt: 2000 }));
    render(
      <BundleDecayPanel
        bundle={{ bundledSupplyPct: 12, analyzedAt: new Date(2000).toISOString() } as never}
        mint={MINT}
      />,
    );
    expect(screen.getByText("Bundle change")).toBeTruthy();
    expect(screen.getByText(/-28\.0 pts/)).toBeTruthy();
    expect(screen.getByText("Unwinding")).toBeTruthy();
  });

  it("LpDrainAlertPanel renders the liquidity drop vs no prior observation", () => {
    recordScan(snap({ mint: MINT, liquidityUsd: 100000, scannedAt: 1000 }));
    const { unmount } = render(
      <LpDrainAlertPanel
        forensics={{ safetyFlags: { lpLockedPct: 90 } } as never}
        token={{ liquidityUsd: 100000 } as never}
        mint={MINT}
      />,
    );
    expect(screen.getByText(/No prior observation/)).toBeTruthy();
    unmount();

    recordScan(snap({ mint: MINT, liquidityUsd: 100000, scannedAt: 2000 }));
    render(
      <LpDrainAlertPanel
        forensics={{ safetyFlags: { lpLockedPct: 90 } } as never}
        token={{ liquidityUsd: 40000 } as never}
        mint={MINT}
      />,
    );
    expect(screen.getByText("Liquidity vs last scan")).toBeTruthy();
    expect(screen.getByText(/60\.0%/)).toBeTruthy();
  });

  it("RugCheckPanel renders a honeypot flip vs no prior observation", () => {
    recordScan(snap({ mint: MINT, honeypot: false, scannedAt: 1000 }));
    const { unmount } = render(
      <RugCheckPanel safety={{ canBuy: true, canSell: true }} mint={MINT} />,
    );
    expect(screen.getByText(/No prior observation/)).toBeTruthy();
    unmount();

    recordScan(snap({ mint: MINT, honeypot: false, scannedAt: 2000 }));
    render(<RugCheckPanel safety={{ canBuy: true, canSell: false }} mint={MINT} />);
    expect(screen.getByText("Honeypot flip")).toBeTruthy();
    expect(screen.getByText("Tradable → honeypot")).toBeTruthy();
  });
});
