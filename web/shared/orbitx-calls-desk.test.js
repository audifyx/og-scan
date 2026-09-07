import { describe, expect, it } from "vitest";
import {
  applyMark,
  chatFromTelegramUpdate,
  formatCallTelegram,
  formatLiveFeedTelegram,
  maskBotToken,
  mcMultiple,
  parseChannelRef,
  pickCallCandidates,
  publicAgentCallsBoard,
  publicWebhookUrl,
  resolveCallStatus,
  stillCooling,
  summarizeCalls,
  unpublishedLiveFeed,
  writeCallThesis,
} from "./orbitx-calls-desk.js";

const coin = {
  mint: "Aw6fiDPWLUnjSsJQtsyEMSaoPaKAUUrStAsYPiPwpump",
  symbol: "MOUSE",
  liquidity_usd: 80_000,
  volume_24h: 120_000,
  volume_1h: 40_000,
  market_cap: 90_000,
  change_5m: 1.2,
  change_1h: 8,
  change_24h: 22,
  buys_1h: 80,
  sells_1h: 40,
  txns_1h: 120,
  pair_age_min: 80,
  twitter: "https://x.com/x",
};

describe("calls desk math", () => {
  it("masks tokens and parses channel refs", () => {
    expect(maskBotToken("123456:ABC-DEFGHIJKLMNOP")).toMatch(/123456…/);
    expect(parseChannelRef("@orbitxcalls")).toEqual({ chatId: null, username: "orbitxcalls" });
    expect(parseChannelRef("https://t.me/orbitxcalls")).toEqual({ chatId: null, username: "orbitxcalls" });
    expect(parseChannelRef("-100123")).toEqual({ chatId: "-100123", username: null });
    expect(publicWebhookUrl("https://www.orbitx.world")).toBe("https://www.orbitx.world/api/orbitx-calls?path=hook");
  });

  it("tracks ATH ATL and win/loss from MC", () => {
    const opened = {
      mc_at_call: 100_000,
      mc_ath: 100_000,
      mc_atl: 100_000,
      called_at: new Date(Date.now() - 1000).toISOString(),
      status: "open",
    };
    const up = applyMark(opened, { market_cap: 180_000 });
    expect(up.multiple_now).toBeCloseTo(1.8);
    expect(up.status).toBe("won");
    expect(up.mc_ath).toBe(180_000);
    const down = applyMark(
      { ...opened, called_at: new Date(Date.now() - 25 * 3600_000).toISOString() },
      { market_cap: 50_000 },
    );
    expect(down.status).toBe("lost");
    expect(mcMultiple(200, 100)).toBe(2);
    expect(resolveCallStatus({ multiple_ath: 1.2, multiple_now: 1.1, called_at: new Date().toISOString() })).toBe("open");
  });

  it("summarizes win rate and paper pnl", () => {
    const s = summarizeCalls([
      { status: "won", multiple_now: 2, multiple_ath: 3 },
      { status: "lost", multiple_now: 0.4, multiple_ath: 0.9 },
      { status: "open", multiple_now: 1.1, multiple_ath: 1.2 },
    ]);
    expect(s.calls).toBe(3);
    expect(s.won).toBe(1);
    expect(s.lost).toBe(1);
    expect(s.win_rate).toBe(0.5);
    expect(s.pnl_now).toBeCloseTo(2 - 1 + 0.4 - 1 + 1.1 - 1);
    expect(s.best.multiple_ath).toBe(3);
  });

  it("cools recently called mints and writes an alert thesis", () => {
    const now = Date.now();
    expect(stillCooling([{ mint: coin.mint, called_at: new Date(now - 3600_000).toISOString() }], coin.mint, now, 12)).toBe(true);
    expect(stillCooling([], coin.mint, now, 12)).toBe(false);
    const thesis = writeCallThesis({ id: "neon-live", name: "NEON LIVE", style: "momentum" }, coin, { ok: true, score: 22 });
    expect(thesis).toMatch(/NEON|calling/i);
    expect(thesis).not.toMatch(/just put \$/);
    const tg = formatCallTelegram({
      mint: coin.mint,
      symbol: "MOUSE",
      agent_name: "NEON LIVE",
      thesis,
      mc_at_call: 90_000,
      liq_at_call: 80_000,
      vol_24h_at_call: 120_000,
      analysis: { change_1h: 8, buys_1h: 80, sells_1h: 40, score: 22 },
      url: "https://dexscreener.com/solana/" + coin.mint,
    });
    expect(tg).toContain("WHY THIS CALL");
    expect(tg).toContain("FULL TAPE");
    expect(tg).toContain(coin.mint);
    expect(tg).toContain("Alert only");
  });

  it("picks unique screened coins", () => {
    const picked = pickCallCandidates([coin, { ...coin, mint: "bad" }], { id: "neon-live", style: "momentum" }, [], {
      max_calls_per_tick: 2,
    });
    expect(picked.every((p) => p.screen.ok)).toBe(true);
    expect(picked[0].coin.mint).toBe(coin.mint);
  });

  it("formats the same /on-chain live feed for Telegram", () => {
    const tg = formatLiveFeedTelegram({
      kind: "buy",
      agent_id: "neon-live",
      symbol: "MOUSE",
      mint: coin.mint,
      usd: 1.5,
      thesis: "NEON just put $1.50 into $MOUSE.",
      at: new Date().toISOString(),
    });
    expect(tg).toContain("NEON");
    expect(tg).toContain("BUY");
    expect(tg).toContain(coin.mint);
    expect(tg).toContain("/on-chain");
    const older = unpublishedLiveFeed(
      [
        { id: "a", at: "2026-09-07T16:00:00.000Z", kind: "skip" },
        { id: "b", at: "2026-09-07T16:05:00.000Z", kind: "buy" },
      ],
      "2026-09-07T16:01:00.000Z",
      8,
    );
    expect(older.map((r) => r.id)).toEqual(["b"]);
    const added = chatFromTelegramUpdate({
      message: { chat: { id: -1002, title: "Calls", type: "supergroup" }, text: "hi" },
    });
    expect(added.chat_id).toBe("-1002");
    expect(added.chat_type).toBe("supergroup");
  });

  it("public agentcalls board is tape-only and never includes bot keys", () => {
    const board = publicAgentCallsBoard(
      {
        ok: true,
        wallet: { pubkey: "W", sol: 1, usd: 2 },
        holding: { mint: "Mint111111111111111111111111111111111111111", symbol: "FOO", usd: 3 },
        hunt: { symbol: "BAR" },
        feed: [{ id: "f1", kind: "buy", text: "NEON bought" }],
        fills: [{ id: "t1", side: "buy" }],
        open: [],
        ledger: { started_at: "2026-01-01T00:00:00.000Z", now_at: "2026-01-01T01:00:00.000Z", trades: 1, wins: 1, losses: 0, pnl_sol: 0.1 },
      },
      {
        ok: true,
        bot_token: "123:SECRET",
        token_masked: "123:****",
        webhook_secret: "whsec",
        armed: true,
        hunt_ca: "Mint111",
        chats: [{ chat_id: "-1001", title: "secret group" }],
        calls: [{ id: "c1", mint: "Mint111", symbol: "FOO", telegram_posts: [{ chat_id: "-1001" }] }],
        stats: { calls: 1, last_scan_at: "now", best: { mint: "Mint111", symbol: "FOO", telegram_posts: [{ chat_id: "-1001" }] } },
      },
    );
    expect(board.ok).toBe(true);
    expect(board.wallet).toBe("W");
    expect(board.feed).toHaveLength(1);
    expect(board.calls[0].symbol).toBe("FOO");
    expect(board.calls[0].telegram_posts).toBeUndefined();
    expect(board.stats.best?.mint).toBe("Mint111");
    expect(board.stats.best?.telegram_posts).toBeUndefined();
    expect(JSON.stringify(board)).not.toMatch(/SECRET|whsec|token_masked|bot_token|-1001/);
  });
});
