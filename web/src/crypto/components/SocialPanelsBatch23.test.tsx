import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ALERT_TRIGGER_META,
  alertRuleBackendSupport,
  checkRulesAgainstScan,
  createAlertRule,
  deleteAlertRule,
  describeRule,
  evaluateRuleAgainstScan,
  loadAlertRules,
  updateAlertRule,
  type AlertRule,
} from "../hooks/useAlertBuilder";
import {
  clearVault,
  deriveStatus,
  loadVault,
  recordScan,
  removeVaultToken,
  toVaultToken,
  type ScanSnapshot,
} from "../hooks/useScanVault";
import { AlertBuilder } from "./SocialPanels";
import { ScanVault } from "./ScanVault";

const MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const MINT2 = "So11111111111111111111111111111111111111112";
const DEV = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

beforeEach(() => {
  window.localStorage.clear();
});

function snap(over: Partial<ScanSnapshot> & { mint: string }): ScanSnapshot {
  return { ogScore: 62, riskScore: 41, scannedAt: Date.now(), ...over };
}

describe("AlertBuilder rules (local-first)", () => {
  it("creates, lists, toggles and deletes rules; rejects bad input", () => {
    expect(loadAlertRules()).toEqual([]);
    expect(createAlertRule({ type: "dev-launch", wallet: "not-a-wallet" })).toBeNull();
    expect(createAlertRule({ type: "bundle-threshold", threshold: -5 })).toBeNull();
    const rule = createAlertRule({ type: "bundle-threshold", threshold: 30, mint: MINT });
    expect(rule).not.toBeNull();
    expect(loadAlertRules()).toHaveLength(1);
    expect(describeRule(rule as AlertRule)).toContain("Bundle over 30%");
    const toggled = updateAlertRule((rule as AlertRule).id, { enabled: false });
    expect(toggled[0].enabled).toBe(false);
    expect(deleteAlertRule((rule as AlertRule).id)).toEqual([]);
  });

  it("bundle/risk rules fire locally on a scan; dev-launch/whale/sniper never fake-fire", () => {
    const bundle = createAlertRule({ type: "bundle-threshold", threshold: 30 }) as AlertRule;
    const risk = createAlertRule({ type: "risk-score", threshold: 70 }) as AlertRule;
    const dev = createAlertRule({ type: "dev-launch", wallet: DEV }) as AlertRule;
    const whale = createAlertRule({ type: "whale-buy", threshold: 10_000 }) as AlertRule;
    const sniper = createAlertRule({ type: "sniper-activity", wallet: DEV }) as AlertRule;
    const hot = { mint: MINT, bundledSupplyPct: 34.2, riskScore: 82, devWallet: DEV };
    expect(evaluateRuleAgainstScan(bundle, hot).triggered).toBe(true);
    expect(evaluateRuleAgainstScan(risk, hot).triggered).toBe(true);
    expect(evaluateRuleAgainstScan(dev, hot).triggered).toBe(false);
    expect(evaluateRuleAgainstScan(whale, hot).triggered).toBe(false); // no trade-tape data in scan
    expect(evaluateRuleAgainstScan(sniper, hot).triggered).toBe(false);
    // Missing data never fires.
    expect(evaluateRuleAgainstScan(bundle, { mint: MINT }).triggered).toBe(false);
    // Disabled never fires.
    const disabled = { ...bundle, enabled: false };
    expect(evaluateRuleAgainstScan(disabled, hot).triggered).toBe(false);
    // checkRulesAgainstScan bumps fire counts and persists.
    const { fired } = checkRulesAgainstScan(loadAlertRules(), hot);
    expect(fired.map((f) => f.rule.type).sort()).toEqual(["bundle-threshold", "risk-score"]);
    expect(loadAlertRules().find((r) => r.id === bundle.id)?.triggerCount).toBe(1);
  });

  it("backend support is honest: only a partial wallet_trade mapping for dev-launch", () => {
    const dev = createAlertRule({ type: "dev-launch", wallet: DEV }) as AlertRule;
    expect(alertRuleBackendSupport(dev)).toMatchObject({ supported: false, partial: true, backendType: "wallet_trade" });
    const bundle = createAlertRule({ type: "bundle-threshold", threshold: 30 }) as AlertRule;
    expect(alertRuleBackendSupport(bundle)).toMatchObject({ supported: false, backendType: null });
    expect(ALERT_TRIGGER_META).toHaveLength(15); // 11 original + 4 W4 triggers (volume-spike, price/mcap-threshold, top10-holder-sell)
  });

  it("AlertBuilder renders picker, creates a rule, toggles and deletes it", () => {
    render(<AlertBuilder mint={MINT} devWallet={DEV} />);
    expect(screen.getByTestId("alert-builder")).toBeInTheDocument();
    expect(screen.getByText("No custom alerts yet — build one above.")).toBeInTheDocument();
    // Default trigger is bundle-threshold; set 30 and create.
    fireEvent.change(screen.getByLabelText(/bundle %/i), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /create alert/i }));
    expect(screen.getByText(/Bundle over 30%/)).toBeInTheDocument();
    expect(screen.getByText("Waiting on backend")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /disable/i }));
    expect(screen.getByRole("button", { name: /enable/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /delete alert/i }));
    expect(screen.getByText("No custom alerts yet — build one above.")).toBeInTheDocument();
    expect(screen.getByTestId("alert-builder").textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it("AlertBuilder rejects a dev-launch rule without a valid wallet", () => {
    render(<AlertBuilder />);
    fireEvent.change(screen.getByLabelText(/alert trigger/i), { target: { value: "dev-launch" } });
    fireEvent.click(screen.getByRole("button", { name: /create alert/i }));
    expect(screen.getByText(/valid wallet address/i)).toBeInTheDocument();
    expect(loadAlertRules()).toEqual([]);
  });
});

describe("Scan History Vault (local-first, no fake history)", () => {
  it("starts empty; re-scans append snapshots with score then vs now", () => {
    expect(loadVault()).toEqual([]);
    recordScan(snap({ mint: MINT, symbol: "OBX", ogScore: 62, scannedAt: 1_000 }));
    recordScan(snap({ mint: MINT, symbol: "OBX", ogScore: 74, riskScore: 30, scannedAt: 2_000 }));
    const [t] = loadVault();
    expect(t.scanCount).toBe(2);
    expect(t.first.ogScore).toBe(62);
    expect(t.latest.ogScore).toBe(74);
    expect(t.scoreDelta).toBe(12);
    expect(t.status).toBe("unknown"); // no outcome known — never guessed
  });

  it("status comes only from a snapshot that knows the outcome", () => {
    expect(deriveStatus([snap({ mint: MINT, scannedAt: 1 })])).toBe("unknown");
    recordScan(snap({ mint: MINT, ogScore: 50, scannedAt: 1_000 }));
    recordScan(snap({ mint: MINT, ogScore: 12, outcome: "rugged", scannedAt: 2_000 }));
    expect(loadVault()[0].status).toBe("rugged");
    // A later scan with no outcome does not erase the known one.
    recordScan(snap({ mint: MINT, ogScore: 10, scannedAt: 3_000 }));
    expect(loadVault()[0].status).toBe("rugged");
  });

  it("toVaultToken sorts newest-first and handles unknown scores", () => {
    const t = toVaultToken(MINT, [
      snap({ mint: MINT, ogScore: null, scannedAt: 5 }),
      snap({ mint: MINT, ogScore: 80, scannedAt: 1 }),
    ]);
    expect(t?.latest.scannedAt).toBe(5);
    expect(t?.scoreDelta).toBeNull();
  });

  it("remove + clear round-trip; bad mints rejected", () => {
    recordScan(snap({ mint: MINT, scannedAt: 1 }));
    recordScan(snap({ mint: MINT2, scannedAt: 2 }));
    expect(recordScan(snap({ mint: "junk", scannedAt: 3 }))).toHaveLength(2);
    expect(removeVaultToken(MINT)).toHaveLength(1);
    expect(clearVault()).toEqual([]);
  });

  it("ScanVault empty state, expandable timeline, score delta", () => {
    const { unmount } = render(<ScanVault />);
    expect(screen.getByText("No scans yet.")).toBeInTheDocument();
    recordScan(snap({ mint: MINT, symbol: "OBX", name: "OrbitX", ogScore: 62, scannedAt: 1_000 }));
    recordScan(snap({ mint: MINT, symbol: "OBX", ogScore: 74, scannedAt: 2_000 }));
    unmount();
    render(<ScanVault />);
    expect(screen.getByText("$OBX")).toBeInTheDocument();
    expect(screen.getByText(/62 → 74/)).toBeInTheDocument();
    expect(screen.getByText(/\(\+12\)/)).toBeInTheDocument();
    expect(screen.getByText("Outcome unknown")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /\$OBX/i }));
    expect(screen.getByText("First scan")).toBeInTheDocument();
    expect(screen.getByTestId("scan-vault").textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});
