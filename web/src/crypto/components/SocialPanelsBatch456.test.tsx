import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  alertRuleBackendSupport,
  checkRulesAgainstScan,
  createAlertRule,
  describeRule,
  evaluateRuleAgainstScan,
  loadAlertRules,
  type AlertRule,
} from "../hooks/useAlertBuilder";
import { FEED_ALERT_GAP } from "../hooks/useScanSocial";
import { AlertBuilder } from "./SocialPanels";
import { ShareToX, buildScanTweet } from "./ShareToX";

const MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const DEV = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

beforeEach(() => {
  window.localStorage.clear();
});

describe("Batch 4 — liquidity-migration trigger", () => {
  it("requires a mint; optional minimum moved amount", () => {
    expect(createAlertRule({ type: "liquidity-migration" })).toBeNull();
    expect(createAlertRule({ type: "liquidity-migration", mint: "junk" })).toBeNull();
    const rule = createAlertRule({ type: "liquidity-migration", mint: MINT }) as AlertRule;
    expect(rule.threshold).toBeNull();
    expect(describeRule(rule)).toContain("LP migrates");
    const withMin = createAlertRule({ type: "liquidity-migration", mint: MINT, threshold: 50_000 }) as AlertRule;
    expect(withMin.threshold).toBe(50_000);
  });

  it("fires only when the scan carries migration evidence (and the amount, if a minimum is set)", () => {
    const rule = createAlertRule({ type: "liquidity-migration", mint: MINT, threshold: 50_000 }) as AlertRule;
    expect(evaluateRuleAgainstScan(rule, { mint: MINT }).triggered).toBe(false); // no data
    expect(evaluateRuleAgainstScan(rule, { mint: MINT, lpMigrated: false }).triggered).toBe(false);
    // Migrated, but amount unknown → cannot confirm over $50k → must NOT fire.
    expect(evaluateRuleAgainstScan(rule, { mint: MINT, lpMigrated: true }).triggered).toBe(false);
    // Migrated under the minimum → no fire.
    expect(evaluateRuleAgainstScan(rule, { mint: MINT, lpMigrated: true, lpMovedUsd: 10_000 }).triggered).toBe(false);
    // Migrated over the minimum → fire.
    expect(evaluateRuleAgainstScan(rule, { mint: MINT, lpMigrated: true, lpMovedUsd: 80_000 }).triggered).toBe(true);
    // No minimum → any migration fires.
    const anyAmount = createAlertRule({ type: "liquidity-migration", mint: MINT }) as AlertRule;
    expect(evaluateRuleAgainstScan(anyAmount, { mint: MINT, lpMigrated: true }).triggered).toBe(true);
    expect(alertRuleBackendSupport(rule).backendType).toBeNull();
  });
});

describe("Batch 5 — dev-wallet-move trigger + ShareToX", () => {
  it("dev-wallet-move consumes Team A devWalletWatch data; action filter respected", () => {
    const rule = createAlertRule({ type: "dev-wallet-move", wallet: DEV, action: "sell" }) as AlertRule;
    expect(describeRule(rule)).toContain("sells");
    const snap = { mint: MINT, devWalletActivity: { wallet: DEV, action: "sell" as const, amountUsd: 5_000 } };
    expect(evaluateRuleAgainstScan(rule, snap).triggered).toBe(true);
    expect(evaluateRuleAgainstScan(rule, { mint: MINT, devWalletActivity: { wallet: DEV, action: "buy" as const } }).triggered).toBe(false);
    expect(evaluateRuleAgainstScan(rule, { mint: MINT }).triggered).toBe(false); // no activity data
    const transferRule = createAlertRule({ type: "dev-wallet-move", wallet: DEV, action: "transfer" }) as AlertRule;
    expect(alertRuleBackendSupport(transferRule)).toMatchObject({ partial: false, backendType: null });
    expect(alertRuleBackendSupport(rule)).toMatchObject({ partial: true, backendType: "wallet_trade" });
  });

  it("buildScanTweet uses real data only, fits 280, links the scan", () => {
    const t = buildScanTweet({
      mint: MINT,
      symbol: "OBX",
      ogScore: 62,
      ogBand: "Fair",
      riskScore: 41,
      riskLabel: "C",
      flags: ["High bundle risk — 34.2% bundled"],
    });
    expect(t.text).toContain("$OBX");
    expect(t.text).toContain("OG score 62/100");
    expect(t.text).toContain("Risk 41/100 (C)");
    expect(t.text).toContain("34.2% bundled");
    expect(t.url).toContain(`/intel/scan/${MINT}`);
    expect(t.intentUrl).toContain("https://x.com/intent/tweet?text=");
    expect(t.tooLong).toBe(false);
    expect(t.length).toBeLessThanOrEqual(280);
  });

  it("unknowns are written as unknown, never invented; long flags are dropped to fit", () => {
    const t = buildScanTweet({ mint: MINT, flags: ["x".repeat(300)] });
    expect(t.text).toContain("OG score unknown");
    expect(t.text).toContain("Risk unknown");
    expect(t.text).not.toContain("x".repeat(300));
    expect(t.tooLong).toBe(false);
  });

  it("ShareToX shows the exact tweet and opens the X intent on tap", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    render(<ShareToX mint={MINT} symbol="OBX" ogScore={62} riskScore={41} flags={["High bundle risk"]} />);
    expect(screen.getByTestId("share-to-x")).toBeInTheDocument();
    expect(screen.getByText(/\$OBX/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /post on x/i }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0][0])).toContain("x.com/intent/tweet");
    vi.unstubAllGlobals();
  });
});

describe("Batch 6 — lp-drain / dev-sell-move / honeypot-flip / authority-change", () => {
  it("lp-drain fires on drop % or full drain, never without LP data", () => {
    const rule = createAlertRule({ type: "lp-drain", mint: MINT, threshold: 50 }) as AlertRule;
    expect(describeRule(rule)).toContain("LP drops 50%+");
    expect(evaluateRuleAgainstScan(rule, { mint: MINT }).triggered).toBe(false);
    expect(evaluateRuleAgainstScan(rule, { mint: MINT, lpDropPct: 20 }).triggered).toBe(false);
    expect(evaluateRuleAgainstScan(rule, { mint: MINT, lpDropPct: 75 }).triggered).toBe(true);
    expect(evaluateRuleAgainstScan(rule, { mint: MINT, lpUsd: 0 }).triggered).toBe(true);
    expect(createAlertRule({ type: "lp-drain", threshold: 50 })).toBeNull(); // mint required
    expect(alertRuleBackendSupport(rule)).toMatchObject({ supported: false, backendType: null });
  });

  it("dev-sell-move fires on Team A wallet data; buy is excluded by design", () => {
    const rule = createAlertRule({ type: "dev-sell-move", wallet: DEV, action: "sell" }) as AlertRule;
    expect(createAlertRule({ type: "dev-sell-move", wallet: DEV, action: "buy" })).toBeNull();
    expect(evaluateRuleAgainstScan(rule, { mint: MINT }).triggered).toBe(false);
    const sell = { mint: MINT, devWalletActivity: { wallet: DEV, action: "sell" as const, amountUsd: 1_200 } };
    expect(evaluateRuleAgainstScan(rule, sell).triggered).toBe(true);
    const anyRule = createAlertRule({ type: "dev-sell-move", wallet: DEV, action: "any" }) as AlertRule;
    expect(evaluateRuleAgainstScan(anyRule, { mint: MINT, devWalletActivity: { wallet: DEV, action: "transfer" as const } }).triggered).toBe(true);
    expect(evaluateRuleAgainstScan(anyRule, sell).triggered).toBe(true);
  });

  it("honeypot-flip fires on a flip and respects the direction filter", () => {
    const anyDir = createAlertRule({ type: "honeypot-flip", mint: MINT }) as AlertRule;
    expect(evaluateRuleAgainstScan(anyDir, { mint: MINT }).triggered).toBe(false);
    expect(evaluateRuleAgainstScan(anyDir, { mint: MINT, honeypotFlipped: false }).triggered).toBe(false);
    const toHoney = { mint: MINT, honeypotFlipped: true, honeypotSellable: false };
    const back = { mint: MINT, honeypotFlipped: true, honeypotSellable: true };
    expect(evaluateRuleAgainstScan(anyDir, toHoney)).toMatchObject({ triggered: true });
    expect(evaluateRuleAgainstScan(anyDir, back)).toMatchObject({ triggered: true });
    const onlyToHoney = createAlertRule({ type: "honeypot-flip", mint: MINT, direction: "to-honeypot" }) as AlertRule;
    expect(evaluateRuleAgainstScan(onlyToHoney, toHoney).triggered).toBe(true);
    expect(evaluateRuleAgainstScan(onlyToHoney, back).triggered).toBe(false);
    expect(createAlertRule({ type: "honeypot-flip" })).toBeNull(); // mint required
  });

  it("authority-change fires on any observed change kind", () => {
    const rule = createAlertRule({ type: "authority-change", mint: MINT }) as AlertRule;
    expect(evaluateRuleAgainstScan(rule, { mint: MINT }).triggered).toBe(false);
    const res = evaluateRuleAgainstScan(rule, {
      mint: MINT,
      authorityChange: { kind: "mint-enabled", detail: "mint authority re-enabled" },
    });
    expect(res.triggered).toBe(true);
    expect(res.reason).toContain("Mint authority re-enabled");
    expect(alertRuleBackendSupport(rule)).toMatchObject({ supported: false, backendType: null });
  });

  it("checkRulesAgainstScan fires the new triggers together and FEED_ALERT_GAP lists them", () => {
    createAlertRule({ type: "lp-drain", mint: MINT, threshold: 50 });
    createAlertRule({ type: "honeypot-flip", mint: MINT });
    const { fired } = checkRulesAgainstScan(loadAlertRules(), {
      mint: MINT,
      lpDropPct: 80,
      honeypotFlipped: true,
      honeypotSellable: false,
    });
    expect(fired.map((f) => f.rule.type).sort()).toEqual(["honeypot-flip", "lp-drain"]);
    expect(FEED_ALERT_GAP.missingTypes).toEqual(
      expect.arrayContaining(["lp_drain", "dev_wallet_move", "honeypot_flip", "authority_change"]),
    );
    expect(FEED_ALERT_GAP.needed).toContain("honeypot_flip");
  });

  it("AlertBuilder UI offers all 15 triggers and creates an lp-drain rule", () => {
    render(<AlertBuilder mint={MINT} />);
    const select = screen.getByLabelText(/alert trigger/i) as HTMLSelectElement;
    expect(select.options.length).toBe(15);
    fireEvent.change(select, { target: { value: "lp-drain" } });
    fireEvent.change(screen.getByLabelText(/lp drop %/i), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: /create alert/i }));
    expect(screen.getByText(/LP drops 50%\+/)).toBeInTheDocument();
    expect(screen.getByText("Waiting on backend")).toBeInTheDocument();
  });
});
