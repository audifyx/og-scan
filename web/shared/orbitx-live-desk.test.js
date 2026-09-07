import { describe, expect, it } from "vitest";
import {
  LIVE_AGENTS,
  LIVE_TRADE_USD,
  LIVE_WALLET_PUBKEY,
  decideLiveExit,
  emptyLiveDesk,
  nextLiveAgent,
  pickLiveToken,
  rankForLiveStyle,
  screenLiveCandidate,
  sizeLiveBuy,
  writeLiveThesis,
} from "./orbitx-live-desk.js";

const GOOD = {
  mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
  symbol: "ORBITX",
  change_1h: 6,
  change_24h: 12,
  volume_24h: 900_000,
  liquidity_usd: 2_000_000,
  market_cap: 8_000_000,
  pair_age_min: 240,
};

const SAFETY = { canBuy: true, canSell: true, roundTripLossPct: 4.2, buyImpactPct: 0.8 };

describe("live agent desk rules", () => {
  it("caps a buy at $2 and keeps a fee reserve", () => {
    const sized = sizeLiveBuy({ solBalance: 0.05, solUsd: 150, openCount: 0 });
    expect(sized.ok).toBe(true);
    expect(sized.usd).toBe(LIVE_TRADE_USD);
    expect(sized.sol).toBeCloseTo(2 / 150, 6);
    expect(sizeLiveBuy({ solBalance: 0.01, solUsd: 150, openCount: 0 }).ok).toBe(false);
    expect(sizeLiveBuy({ solBalance: 1, solUsd: 150, openCount: 2 }).skip).toBe("max_open");
  });

  it("rejects rugs / unsellable / mint-authority coins", () => {
    expect(screenLiveCandidate(GOOD, SAFETY).ok).toBe(true);
    expect(screenLiveCandidate(GOOD, { ...SAFETY, canSell: false }).ok).toBe(false);
    expect(screenLiveCandidate({ ...GOOD, liquidity_usd: 500 }, SAFETY).ok).toBe(false);
    expect(screenLiveCandidate(GOOD, { ...SAFETY, mintAuthorityActive: true }).ok).toBe(false);
    expect(screenLiveCandidate({ ...GOOD, pair_age_min: 5 }, SAFETY).ok).toBe(false);
    expect(screenLiveCandidate(GOOD, { ...SAFETY, bondingOnly: true }).ok).toBe(false);
  });

  it("sells 100% at +10% and +30% take-profit", () => {
    const ten = decideLiveExit({ entry_price_usd: 1, tp_pct: 0.1 }, 1.1);
    expect(ten.action).toBe("take_profit");
    const thirty = decideLiveExit({ entry_price_usd: 1, tp_pct: 0.3 }, 1.3);
    expect(thirty.action).toBe("take_profit");
    expect(decideLiveExit({ entry_price_usd: 1, tp_pct: 0.12 }, 1.05).action).toBe("hold");
    expect(decideLiveExit({ entry_price_usd: 1, tp_pct: 0.1 }, 0.79).action).toBe("stop");
  });

  it("writes a thesis and rotates three live books", () => {
    expect(LIVE_AGENTS).toHaveLength(3);
    expect(LIVE_WALLET_PUBKEY).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    const thesis = writeLiveThesis(LIVE_AGENTS[0], GOOD, SAFETY, { usd: 2 });
    expect(thesis).toMatch(/NEON LIVE/);
    expect(thesis).toMatch(/\$2\.00/);
    expect(thesis).toMatch(/sell 100%/);
    expect(nextLiveAgent("neon-live").id).toBe("warden-live");
    const ranked = rankForLiveStyle("momentum", [GOOD, { ...GOOD, mint: "Aaa1111111111111111111111111111111111111111", change_1h: 18, symbol: "HOT" }]);
    expect(pickLiveToken(LIVE_AGENTS[0], ranked).symbol).toBe("HOT");
    expect(emptyLiveDesk().disclaimer).toMatch(/Not financial advice/);
  });
});
