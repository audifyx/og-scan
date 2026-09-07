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
  summarizeLiveLedger,
  mergeLiveFeed,
  writeLiveThesis,
  liveIsMajor,
  humanLivePost,
  buildLiveWorld,
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
  it("caps a buy at $1.50, one open book, and keeps a fee reserve", () => {
    const sized = sizeLiveBuy({ solBalance: 0.05, solUsd: 150, openCount: 0 });
    expect(sized.ok).toBe(true);
    expect(sized.usd).toBe(LIVE_TRADE_USD);
    expect(LIVE_TRADE_USD).toBe(1.5);
    expect(sized.sol).toBeCloseTo(1.5 / 150, 6);
    expect(sizeLiveBuy({ solBalance: 0.01, solUsd: 150, openCount: 0 }).ok).toBe(false);
    expect(sizeLiveBuy({ solBalance: 1, solUsd: 150, openCount: 1 }).skip).toBe("max_open");
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
    const thesis = writeLiveThesis(LIVE_AGENTS[0], GOOD, SAFETY, { usd: 1.5 });
    expect(thesis).toMatch(/NEON/);
    expect(thesis).toMatch(/\$1\.50/);
    expect(thesis).toMatch(/whole clip/);
    expect(nextLiveAgent("neon-live").id).toBe("warden-live");
    const ranked = rankForLiveStyle("momentum", [GOOD, { ...GOOD, mint: "Aaa1111111111111111111111111111111111111111", change_1h: 18, symbol: "HOT" }]);
    expect(pickLiveToken(LIVE_AGENTS[0], ranked).symbol).toBe("HOT");
    expect(emptyLiveDesk().disclaimer).toMatch(/Not financial advice/);
    expect(emptyLiveDesk().trade_usd).toBe(1.5);
    expect(emptyLiveDesk().max_open).toBe(1);
  });

  it("allows liquid high-MC majors like JUP and USELESS instead of skipping them", () => {
    const jup = {
      mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
      symbol: "JUP",
      change_1h: 4.2,
      change_24h: -6,
      volume_24h: 40_000_000,
      liquidity_usd: 25_000_000,
      market_cap: 1_200_000_000,
      pair_age_min: 525_600,
    };
    const useless = {
      mint: "Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk",
      symbol: "USELESS",
      change_1h: 9,
      change_24h: 18,
      volume_24h: 8_000_000,
      liquidity_usd: 4_000_000,
      market_cap: 220_000_000,
      pair_age_min: 40_000,
    };
    const jupScreen = screenLiveCandidate(jup, SAFETY);
    const uselessScreen = screenLiveCandidate(useless, SAFETY);
    expect(jupScreen.ok).toBe(true);
    expect(jupScreen.major).toBe(true);
    expect(uselessScreen.ok).toBe(true);
    expect(uselessScreen.major).toBe(true);
    expect(screenLiveCandidate(jup, { ...SAFETY, canSell: false }).ok).toBe(false);
    expect(screenLiveCandidate({ ...jup, symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" }, SAFETY).ok).toBe(false);
    expect(
      screenLiveCandidate(
        { ...GOOD, symbol: "MEGA", market_cap: 60_000_000_000, liquidity_usd: 80_000, volume_24h: 50_000 },
        SAFETY,
      ).ok,
    ).toBe(false);
    expect(liveIsMajor({ mint: GOOD.mint, symbol: "PUMP", market_cap: 2_000_000, liquidity_usd: 1_500_000, volume_24h: 800_000 })).toBe(false);
    const ranked = rankForLiveStyle("momentum", [
      { ...GOOD, mint: "Aaa1111111111111111111111111111111111111111", symbol: "HOT", change_1h: 40 },
      jup,
    ]);
    expect(ranked[0].symbol).toBe("JUP");
    expect(writeLiveThesis(LIVE_AGENTS[0], jup, SAFETY, { usd: 1.5 })).toMatch(/liquid major/);
  });

  it("rolls started vs now, wins, losses, and current hold per book", () => {
    const ledger = summarizeLiveLedger({
      startingUsd: 4,
      startingSol: 0.027,
      solBalance: 0.017,
      usdBalance: 2.55,
      equityUsd: 4.2,
      realizedPnlUsd: 0.12,
      open: [{ agent_id: "neon-live", symbol: "ORBITX", usd_in: 1.5, pnl_pct: 10 }],
      fills: [
        { agent_id: "neon-live", side: "buy", usd_amount: 1.5 },
        { agent_id: "warden-live", side: "sell", pnl_usd: 0.18 },
        { agent_id: "raid-live", side: "sell", pnl_usd: -0.06 },
      ],
    });
    expect(ledger.started_usd).toBe(4);
    expect(ledger.currently_usd).toBe(4.2);
    expect(ledger.made_usd).toBeCloseTo(0.2, 6);
    expect(ledger.wins).toBe(1);
    expect(ledger.losses).toBe(1);
    expect(ledger.holding.symbol).toBe("ORBITX");
    const neon = ledger.books.find((a) => a.id === "neon-live");
    expect(neon.currently_hold).toBe("$ORBITX");
    expect(neon.unrealized_pnl_usd).toBeCloseTo(0.15, 6);
    const warden = ledger.books.find((a) => a.id === "warden-live");
    expect(warden.wins).toBe(1);
    expect(warden.made_usd).toBeCloseTo(0.18, 6);
    const raid = ledger.books.find((a) => a.id === "raid-live");
    expect(raid.losses).toBe(1);
    expect(raid.currently_hold).toBe("cash");
  });

  it("merges fills, skip events, and on-chain swaps into one tape", () => {
    const tape = mergeLiveFeed({
      fills: [{ id: "f1", side: "buy", symbol: "ORBITX", usd_amount: 1.5, thesis: "buy thesis", created_at: "2026-09-07T06:00:00Z", signature: "sig-buy" }],
      events: [{ id: "e1", kind: "skip", symbol: "RUG", reason: "cannot sell", created_at: "2026-09-07T06:01:00Z" }],
      chain: [{ signature: "sig-buy", blockTime: Date.parse("2026-09-07T06:00:02Z") / 1000 }],
    });
    expect(tape[0].kind).toBe("skip");
    expect(tape.some((r) => r.kind === "buy" && r.thesis === "buy thesis")).toBe(true);
    expect(tape.some((r) => r.kind === "buy" && /just put/.test(r.text || ""))).toBe(true);
    expect(tape.some((r) => r.kind === "swap" && r.signature === "sig-buy")).toBe(true);
    expect(tape.some((r) => r.solscan_tx && r.solscan_tx.includes("solscan.io/tx"))).toBe(true);
    expect(tape[0].text).toMatch(/passed|sidelines|RUG/i);
  });

  it("writes human posts and a 3D city with a Solscan tower plus coin buildings", () => {
    const buy = humanLivePost({ kind: "buy", agent_id: "neon-live", symbol: "JUP", usd: 1.5 });
    expect(buy).toMatch(/NEON/);
    expect(buy).not.toMatch(/confirmed Jupiter sell route/);
    const sell = humanLivePost({ kind: "sell", agent_id: "warden-live", symbol: "USELESS", usd: 1.5, pnl_usd: 0.18 });
    expect(sell).toMatch(/WARDEN/);
    expect(sell).toMatch(/booked/);
    const world = buildLiveWorld({
      wallet: LIVE_WALLET_PUBKEY,
      open: [{ agent_id: "neon-live", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", usd_in: 1.5 }],
      feed: [{ kind: "buy", agent_id: "neon-live", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", usd: 1.5, text: "Neon just put $1.50 into $JUP." }],
    });
    expect(world.buildings.some((b) => b.kind === "solscan" && b.url.includes("solscan.io/account"))).toBe(true);
    expect(world.buildings.some((b) => b.symbol === "JUP" && b.solscan.includes("/token/"))).toBe(true);
    expect(world.characters).toHaveLength(3);
    expect(world.characters.find((c) => c.id === "neon-live").holding).toBe("$JUP");
    expect(emptyLiveDesk().world.buildings.some((b) => b.kind === "solscan")).toBe(true);
  });
});
