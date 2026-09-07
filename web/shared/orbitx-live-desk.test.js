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
  isEarlyRunner,
  isAccumulating,
  isConfirmedRun,
  liveHunt,
  huntClipUsd,
  LIVE_HUNT_USD,
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
  change_5m: -2,
  change_24h: 12,
  volume_24h: 900_000,
  liquidity_usd: 90_000,
  market_cap: 420_000,
  pair_age_min: 180,
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

  it("scales 41% at +$0.30, flattens the 59% remainder after a short hold, and cuts dumps", () => {
    const thirty = decideLiveExit({ entry_price_usd: 1, usd_in: 1.5, tp_pct: 0.2 }, 1.2);
    expect(thirty.action).toBe("scale_out");
    expect(thirty.keepPct).toBe(0.59);
    const dollar = decideLiveExit({ entry_price_usd: 1, usd_in: 1.5, tp_pct: 0.2 }, 1.7);
    expect(dollar.action).toBe("take_profit");
    expect(decideLiveExit({ entry_price_usd: 1, usd_in: 1.5, tp_pct: 0.2 }, 1.05).action).toBe("hold");
    expect(decideLiveExit({ entry_price_usd: 1, usd_in: 1.5, tp_pct: 0.2 }, 0.84).action).toBe("stop");
    const now = Date.parse("2026-09-07T12:22:00Z");
    const scrape = decideLiveExit(
      { entry_price_usd: 1, usd_in: 1.5, tp_pct: 0.2, opened_at: "2026-09-07T12:09:00Z" },
      1.06,
      now,
    );
    expect(scrape.action).toBe("scale_out");
    const rest = decideLiveExit(
      { entry_price_usd: 1, usd_in: 0.885, tp_pct: 0.2, opened_at: "2026-09-07T12:09:00Z" },
      1.06,
      now,
      { scaled: true, scaledAt: "2026-09-07T12:13:00Z" },
    );
    expect(rest.action).toBe("take_profit");
    const rotate = decideLiveExit(
      { entry_price_usd: 1, usd_in: 1.5, tp_pct: 0.2, opened_at: "2026-09-07T11:55:00Z" },
      1.01,
      now,
    );
    expect(rotate.action).toBe("time_stop");
  });

  it("writes a thesis and rotates three live books", () => {
    expect(LIVE_AGENTS).toHaveLength(3);
    expect(LIVE_WALLET_PUBKEY).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    const thesis = writeLiveThesis(LIVE_AGENTS[0], GOOD, SAFETY, { usd: 1.5 });
    expect(thesis).toMatch(/NEON/);
    expect(thesis).toMatch(/\$1\.50/);
    expect(thesis).toMatch(/\$0\.30/);
    expect(nextLiveAgent("neon-live").id).toBe("warden-live");
    const ranked = rankForLiveStyle("momentum", [GOOD, { ...GOOD, mint: "Aaa1111111111111111111111111111111111111111", change_1h: 18, change_5m: -2, symbol: "HOT" }]);
    expect(pickLiveToken(LIVE_AGENTS[0], ranked).symbol).toBe("HOT");
    expect(emptyLiveDesk().disclaimer).toMatch(/Not financial advice/);
    expect(emptyLiveDesk().trade_usd).toBe(1.5);
    expect(emptyLiveDesk().max_open).toBe(1);
  });

  it("skips high-MC majors and boosted-only names, prefers low-cap community tape", () => {
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
    const boosted = {
      ...GOOD,
      mint: "Boost11111111111111111111111111111111111111",
      symbol: "BOOST",
      boosted: true,
      volume_24h: 90_000,
      twitter: null,
      socials: [],
    };
    const room = {
      ...GOOD,
      mint: "Comm111111111111111111111111111111111111111",
      symbol: "ROOM",
      market_cap: 2_400_000,
      change_1h: 11,
      change_5m: -2.4,
      twitter: "https://x.com/room",
      buys_1h: 90,
    };
    const mouse = {
      mint: "Aw6fiDPWLUnjSsJQtsyEMSaoPaKAUUrStAsYPiPwpump",
      symbol: "ANONYMOUSE",
      change_5m: -8.69,
      change_15m: -7.69,
      change_1h: 122,
      change_24h: 101,
      volume_24h: 364_000,
      volume_1h: 274_000,
      liquidity_usd: 24_451,
      market_cap: 85_440,
      pair_age_min: 70,
      twitter: "https://x.com/OxFlipped/status/2096883786357027073",
      buys_1h: 200,
      sells_1h: 260,
    };
    expect(screenLiveCandidate(jup, SAFETY).ok).toBe(false);
    expect(screenLiveCandidate(jup, SAFETY).reasons.some((r) => /mcap too large/.test(r))).toBe(true);
    expect(screenLiveCandidate(boosted, SAFETY).ok).toBe(false);
    expect(screenLiveCandidate(room, SAFETY).ok).toBe(true);
    expect(screenLiveCandidate({ ...GOOD, change_1h: 80 }, SAFETY).ok).toBe(false);
    expect(screenLiveCandidate({ ...GOOD, change_24h: 938 }, SAFETY).ok).toBe(false);
    expect(screenLiveCandidate(mouse, SAFETY).ok).toBe(false);
    expect(screenLiveCandidate(mouse, SAFETY).reasons.some((r) => /dumping|topped|already pumped|liq/.test(r))).toBe(true);
    const digesting = {
      ...mouse,
      change_5m: 1.4,
      change_15m: -1.2,
      change_1h: -6.5,
      change_24h: 88,
      buys_1h: 220,
      sells_1h: 160,
    };
    expect(isAccumulating(digesting)).toBe(true);
    expect(isConfirmedRun(digesting)).toBe(false);
    expect(screenLiveCandidate(digesting, SAFETY).ok).toBe(true);
    const bounce = { ...digesting, change_5m: 4.3, change_1h: -8.2 };
    expect(isConfirmedRun(bounce)).toBe(false);
    expect(screenLiveCandidate(bounce, SAFETY).ok).toBe(true);
    const running = {
      ...digesting,
      change_5m: 5.2,
      change_15m: 3.1,
      change_1h: 9.4,
      change_24h: 42,
      buys_1h: 280,
      sells_1h: 190,
    };
    expect(isConfirmedRun(running)).toBe(true);
    expect(screenLiveCandidate(running, SAFETY).ok).toBe(true);
    expect(liveHunt(running).symbol).toBe("ANONYMOUSE");
    expect(huntClipUsd(running)).toBe(LIVE_HUNT_USD);
    expect(LIVE_HUNT_USD).toBe(1);
    expect(sizeLiveBuy({ solBalance: 0.05, solUsd: 150, openCount: 0, tradeUsd: LIVE_HUNT_USD }).usd).toBe(1);
    expect(writeLiveThesis(LIVE_AGENTS[0], running, SAFETY, { usd: 1 })).toMatch(/\$1\.00/);
    expect(writeLiveThesis(LIVE_AGENTS[0], running, SAFETY, { usd: 1 })).toMatch(/300k/);
    expect(writeLiveThesis(LIVE_AGENTS[0], running, SAFETY, { usd: 1 })).toMatch(/600k/);
    const pos = { mint: running.mint, entry_price_usd: 1, usd_in: 1, tp_pct: 0.2 };
    expect(decideLiveExit(pos, 1.05, Date.now(), { marketCap: 85_000 }).reason).toMatch(/300k/);
    expect(decideLiveExit(pos, 3.5, Date.now(), { marketCap: 300_000 }).action).toBe("scale_out");
    expect(decideLiveExit(pos, 7, Date.now(), { marketCap: 600_000 }).action).toBe("take_profit");
    expect(decideLiveExit(pos, 3.5, Date.now(), { marketCap: 300_000, scaled: true }).reason).toMatch(/600k/);
    const rankedHunt = rankForLiveStyle("momentum", [room, digesting]);
    expect(rankedHunt[0].symbol).toBe("ANONYMOUSE");
    expect(screenLiveCandidate({ ...GOOD, change_5m: -12, change_1h: 9 }, SAFETY).ok).toBe(false);
    expect(screenLiveCandidate({ ...GOOD, change_1h: 0.4, change_5m: 0.2, volume_1h: 200, volume_24h: 1_000, txns_1h: 4, buys_1h: 2 }, SAFETY).ok).toBe(false);
    expect(liveIsMajor({ mint: GOOD.mint, symbol: "PUMP", market_cap: 2_000_000, liquidity_usd: 1_500_000, volume_24h: 800_000 })).toBe(false);
    const ranked = rankForLiveStyle("momentum", [
      { ...GOOD, mint: "Aaa1111111111111111111111111111111111111111", symbol: "HOT", change_1h: 18, change_5m: -2, twitter: "https://x.com/hot" },
      jup,
    ]);
    expect(ranked[0].symbol).toBe("HOT");
    expect(writeLiveThesis(LIVE_AGENTS[0], room, SAFETY, { usd: 1.5 })).toMatch(/\$0\.30/);
    expect(writeLiveThesis(LIVE_AGENTS[0], room, SAFETY, { usd: 1.5 })).toMatch(/Community/);
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
    expect(world.climate.phase).toMatch(/dawn|day|dusk|night/);
    expect(world.roads.length).toBeGreaterThan(4);
    expect(world.trees.length).toBeGreaterThan(3);
    expect(world.generation).toBeGreaterThanOrEqual(1);
    expect(world.buildings.length).toBeGreaterThan(8);
    expect(world.water?.length || world.hills?.length).toBeGreaterThan(0);
    const grown = buildLiveWorld({
      fills: [
        { side: "buy", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", usd_amount: 1.5, agent_id: "neon-live" },
        { side: "buy", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", usd_amount: 1.5, agent_id: "raid-live" },
      ],
    });
    expect(grown.built).toBeGreaterThanOrEqual(2);
    expect(grown.generation).toBeGreaterThan(world.generation);
    expect(emptyLiveDesk().world.buildings.some((b) => b.kind === "solscan")).toBe(true);
  });
});
