/**
 * W4 — alerts live firing: cooldown / dedup / severity tiers, the four new
 * trigger types (volume-spike, price-threshold, mcap-threshold,
 * top10-holder-sell), and the SmartWalletWatch watchlist rendering real
 * wallet-route data. No data is faked anywhere: every "no data" path must
 * not fire and must say so.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  ALERT_TRIGGER_META,
  checkRulesAgainstScan,
  createAlertRule,
  describeRule,
  evaluateRuleAgainstScan,
  summarizeTradeEvidence,
  type AlertRule,
} from "./hooks/useAlertBuilder";
import {
  SMART_WALLET_WATCH_KEY,
  SmartWalletWatch,
} from "./components/SmartWalletWatch";

const MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const DEV = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const TOP1 = "9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const OUTSIDER = "5xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("W4 (a) — cooldown / dedup / severity", () => {
  it("fires when checkRulesAgainstScan is called with matching evidence, and carries the rule severity", () => {
    const rule = createAlertRule({ type: "bundle-threshold", threshold: 30 }) as AlertRule;
    expect(rule.severity).toBe("watch");
    expect(rule.cooldownMinutes).toBe(60);
    const { fired, suppressed } = checkRulesAgainstScan([rule], { mint: MINT, bundledSupplyPct: 45 });
    expect(fired).toHaveLength(1);
    expect(fired[0].rule.id).toBe(rule.id);
    expect(fired[0].rule.triggerCount).toBe(1);
    expect(fired[0].severity).toBe("watch");
    expect(fired[0].reason).toContain("45.0%");
    expect(suppressed).toHaveLength(0);
  });

  it("does not re-fire inside the cooldown — it lands in suppressed instead", () => {
    const rule = createAlertRule({ type: "bundle-threshold", threshold: 30 }) as AlertRule;
    const first = checkRulesAgainstScan([rule], { mint: MINT, bundledSupplyPct: 45 });
    expect(first.fired).toHaveLength(1);
    const firedRule = first.rules[0];
    const second = checkRulesAgainstScan([firedRule], { mint: MINT, bundledSupplyPct: 45 });
    expect(second.fired).toHaveLength(0);
    expect(second.suppressed).toHaveLength(1);
    expect(second.suppressed[0].rule.id).toBe(rule.id);
    expect(second.suppressed[0].cooldownRemainingMs).toBeGreaterThan(0);
    expect(second.rules[0].triggerCount).toBe(1);
  });

  it("fires again once the cooldown has elapsed", () => {
    const rule = createAlertRule({ type: "bundle-threshold", threshold: 30, cooldownMinutes: 60 }) as AlertRule;
    const stale: AlertRule = { ...rule, lastTriggeredAt: Date.now() - 61 * 60_000, triggerCount: 1 };
    const { fired } = checkRulesAgainstScan([stale], { mint: MINT, bundledSupplyPct: 45 });
    expect(fired).toHaveLength(1);
    expect(fired[0].rule.triggerCount).toBe(2);
  });

  it("dedupes: the same rule fires at most once per check call", () => {
    const rule = createAlertRule({ type: "risk-score", threshold: 70 }) as AlertRule;
    const { fired } = checkRulesAgainstScan([rule, rule], { mint: MINT, riskScore: 80 });
    expect(fired).toHaveLength(1);
  });

  it("severity is user-picked and survives a storage round-trip", () => {
    const rule = createAlertRule({ type: "risk-score", threshold: 70, severity: "urgent", cooldownMinutes: 15 }) as AlertRule;
    expect(rule.severity).toBe("urgent");
    expect(rule.cooldownMinutes).toBe(15);
    const reloaded = JSON.parse(window.localStorage.getItem("orbitx:scan-alert-rules") ?? "[]") as AlertRule[];
    expect(reloaded[0].severity).toBe("urgent");
    expect(reloaded[0].cooldownMinutes).toBe(15);
  });

  it("a cooldown of 0 means every matching scan fires", () => {
    const rule = createAlertRule({ type: "bundle-threshold", threshold: 30, cooldownMinutes: 0 }) as AlertRule;
    const first = checkRulesAgainstScan([rule], { mint: MINT, bundledSupplyPct: 45 });
    const second = checkRulesAgainstScan(first.rules, { mint: MINT, bundledSupplyPct: 45 });
    expect(second.fired).toHaveLength(1);
  });
});

describe("W4 (b) — new trigger types", () => {
  it("volume-spike compares 1h volume to the 24h average hourly rate", () => {
    const rule = createAlertRule({ type: "volume-spike", threshold: 3 }) as AlertRule;
    expect(rule.threshold).toBe(3);
    expect(describeRule(rule)).toContain("Volume spike 3×");
    // 24h $240k → avg hourly $10k; 1h $30k = 3.0× → fires.
    expect(evaluateRuleAgainstScan(rule, { mint: MINT, volumeH1: 30_000, volumeH24: 240_000 }).triggered).toBe(true);
    // 1h $29k = 2.9× → no fire.
    expect(evaluateRuleAgainstScan(rule, { mint: MINT, volumeH1: 29_000, volumeH24: 240_000 }).triggered).toBe(false);
    // Missing windows → never fires, never fakes a baseline.
    expect(evaluateRuleAgainstScan(rule, { mint: MINT }).triggered).toBe(false);
    expect(evaluateRuleAgainstScan(rule, { mint: MINT, volumeH1: 30_000 }).triggered).toBe(false);
    expect(evaluateRuleAgainstScan(rule, { mint: MINT, volumeH1: 30_000, volumeH24: 0 }).triggered).toBe(false);
  });

  it("price-threshold fires above or below the level, never without a price", () => {
    const above = createAlertRule({ type: "price-threshold", threshold: 0.01, comparison: "above" }) as AlertRule;
    expect(describeRule(above)).toContain("Price above $0.01");
    expect(evaluateRuleAgainstScan(above, { mint: MINT, priceUsd: 0.05 }).triggered).toBe(true);
    expect(evaluateRuleAgainstScan(above, { mint: MINT, priceUsd: 0.005 }).triggered).toBe(false);
    expect(evaluateRuleAgainstScan(above, { mint: MINT }).triggered).toBe(false);
    const below = createAlertRule({ type: "price-threshold", threshold: 0.01, comparison: "below" }) as AlertRule;
    expect(evaluateRuleAgainstScan(below, { mint: MINT, priceUsd: 0.005 }).triggered).toBe(true);
    expect(evaluateRuleAgainstScan(below, { mint: MINT, priceUsd: 0.05 }).triggered).toBe(false);
  });

  it("mcap-threshold fires above or below the level, never without a mcap", () => {
    const above = createAlertRule({ type: "mcap-threshold", threshold: 1_000_000, comparison: "above" }) as AlertRule;
    expect(evaluateRuleAgainstScan(above, { mint: MINT, mcapUsd: 2_000_000 }).triggered).toBe(true);
    expect(evaluateRuleAgainstScan(above, { mint: MINT, mcapUsd: 500_000 }).triggered).toBe(false);
    expect(evaluateRuleAgainstScan(above, { mint: MINT }).triggered).toBe(false);
    const below = createAlertRule({ type: "mcap-threshold", threshold: 1_000_000, comparison: "below" }) as AlertRule;
    expect(evaluateRuleAgainstScan(below, { mint: MINT, mcapUsd: 500_000 }).triggered).toBe(true);
  });

  it("top10-holder-sell needs a mint, fires on any top-10 sell (or over the minimum)", () => {
    expect(createAlertRule({ type: "top10-holder-sell" })).toBeNull();
    const anySell = createAlertRule({ type: "top10-holder-sell", mint: MINT }) as AlertRule;
    expect(anySell.threshold).toBeNull();
    expect(anySell.severity).toBe("urgent");
    expect(anySell.cooldownMinutes).toBe(30);
    expect(describeRule(anySell)).toContain("Top-10 holder sells");
    expect(evaluateRuleAgainstScan(anySell, { mint: MINT, top10HolderSellUsd: 8_000, top10HolderSellWallet: TOP1 }).triggered).toBe(true);
    expect(evaluateRuleAgainstScan(anySell, { mint: MINT }).triggered).toBe(false);
    const minSell = createAlertRule({ type: "top10-holder-sell", mint: MINT, threshold: 10_000 }) as AlertRule;
    expect(evaluateRuleAgainstScan(minSell, { mint: MINT, top10HolderSellUsd: 8_000 }).triggered).toBe(false);
    expect(evaluateRuleAgainstScan(minSell, { mint: MINT, top10HolderSellUsd: 12_000 }).triggered).toBe(true);
  });

  it("summarizeTradeEvidence joins whale alerts + tape against the top-10 set", () => {
    const ev = summarizeTradeEvidence({
      whaleAlerts: [
        { wallet: TOP1, amountUsd: 20_000, side: "buy" },
        { wallet: TOP1, amountUsd: 8_000, side: "sell" },
        { wallet: OUTSIDER, amountUsd: 99_000, side: "sell" },
      ],
      tradeTape: [{ wallet: TOP1, sizeUsd: 12_000, side: "sell" }],
      top10Wallets: [TOP1],
    });
    expect(ev.whaleBuyUsd).toBe(20_000);
    // Largest top-10 sell is the $12k tape sell, not the outsider's $99k.
    expect(ev.top10HolderSellUsd).toBe(12_000);
    expect(ev.top10HolderSellWallet).toBe(TOP1);
    const empty = summarizeTradeEvidence({ whaleAlerts: null, tradeTape: null, top10Wallets: [TOP1] });
    expect(empty).toEqual({ whaleBuyUsd: null, top10HolderSellUsd: null, top10HolderSellWallet: null });
  });

  it("all four new triggers are in the AlertBuilder trigger list", () => {
    const types = ALERT_TRIGGER_META.map((m) => m.type);
    for (const t of ["volume-spike", "price-threshold", "mcap-threshold", "top10-holder-sell"] as const) {
      expect(types).toContain(t);
    }
  });
});

describe("W4 (c) — SmartWalletWatch renders real wallet-route data", () => {
  const WALLET = DEV;
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes("/api/ogdex/wallet")) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            sol: 12.5,
            totalUsd: 1234.56,
            tradeCount: 7,
            holdings: [{ mint: MINT, pctSupply: 2.5 }],
          }),
        );
      }
      return Promise.resolve(new Response("Not found", { status: 404 }));
    });
  });

  it("shows SOL balance, holding % and trade count from the wallet route", async () => {
    window.localStorage.setItem(SMART_WALLET_WATCH_KEY, JSON.stringify([WALLET]));
    render(<SmartWalletWatch mint={MINT} />);
    await waitFor(() => expect(screen.getByText("12.50 SOL")).toBeTruthy());
    expect(screen.getByText("2.50%")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("$1,234.56")).toBeTruthy();
    // Snapshot honesty: no streaming claim, and the component says outright
    // that no win-rate / PnL exists to show.
    expect(screen.getAllByText(/does not stream/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/No win-rate or PnL is shown/i)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/ogdex/wallet"), expect.anything());
  });

  it("adding a wallet persists it and reads it from the route", async () => {
    render(<SmartWalletWatch mint={MINT} />);
    fireEvent.change(screen.getByLabelText("Wallet address to watch"), { target: { value: WALLET } });
    fireEvent.click(screen.getByText("Watch wallet"));
    await waitFor(() => expect(screen.getByText("12.50 SOL")).toBeTruthy());
    expect(JSON.parse(window.localStorage.getItem(SMART_WALLET_WATCH_KEY) ?? "[]")).toEqual([WALLET]);
  });

  it("rejects an invalid address and never calls the route for it", () => {
    render(<SmartWalletWatch mint={MINT} />);
    fireEvent.change(screen.getByLabelText("Wallet address to watch"), { target: { value: "not-a-wallet" } });
    fireEvent.click(screen.getByText("Watch wallet"));
    expect(screen.getByText("Enter a valid Solana wallet address.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an honest unavailable state when the wallet route fails", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("down")));
    window.localStorage.setItem(SMART_WALLET_WATCH_KEY, JSON.stringify([WALLET]));
    render(<SmartWalletWatch mint={MINT} />);
    await waitFor(() => expect(screen.getByText(/Wallet route unavailable/i)).toBeTruthy());
    expect(screen.queryByText("12.50 SOL")).toBeNull();
  });
});
