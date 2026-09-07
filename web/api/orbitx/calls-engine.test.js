import { describe, expect, it } from "vitest";
import { ingestCallsHook, pushLiveDeskToTelegram, tickCallsDesk } from "./calls-engine.js";

function memSb() {
  const tables = {
    ox_calls_desk: [
      {
        id: "main",
        bot_token: "123456:TESTTOKENTESTTOKENTESTTOKEN12",
        bot_username: "orbitxcallsbot",
        channel_id: "-1001",
        channel_title: "OrbitX Calls",
        broadcast_groups: true,
        armed: true,
        max_calls_per_tick: 2,
        cooldown_hours: 12,
        last_agent_id: null,
      },
    ],
    ox_calls_chats: [{ chat_id: "-1001", title: "OrbitX Calls", chat_type: "channel", status: "member" }],
    ox_calls_ledger: [],
  };
  const api = (name) => ({
    select() {
      return {
        eq(col, val) {
          const rows = (tables[name] || []).filter((r) => r[col] === val);
          return {
            async maybeSingle() {
              return { data: rows[0] || null, error: null };
            },
            async then(resolve) {
              return resolve({ data: rows, error: null });
            },
          };
        },
        order() {
          return {
            limit() {
              return Promise.resolve({ data: tables[name], error: null });
            },
            async then(resolve) {
              return resolve({ data: tables[name], error: null });
            },
          };
        },
      };
    },
    upsert(row) {
      const list = tables[name];
      const key = name === "ox_calls_desk" ? "id" : "chat_id";
      const i = list.findIndex((r) => r[key] === row[key]);
      if (i >= 0) list[i] = { ...list[i], ...row };
      else list.push(row);
      return Promise.resolve({ error: null });
    },
    insert(row) {
      const rec = { id: `c${tables[name].length + 1}`, ...row };
      tables[name].unshift(rec);
      return {
        select() {
          return {
            async single() {
              return { data: rec, error: null };
            },
          };
        },
      };
    },
    update(patch) {
      return {
        eq(col, val) {
          const rec = tables[name].find((r) => r[col] === val);
          if (rec) Object.assign(rec, patch);
          return Promise.resolve({ error: null });
        },
      };
    },
  });
  return { from: api, _tables: tables };
}

const clean = {
  mint: "Aw6fiDPWLUnjSsJQtsyEMSaoPaKAUUrStAsYPiPwpump",
  symbol: "TEST",
  liquidity_usd: 90_000,
  volume_24h: 80_000,
  volume_1h: 30_000,
  market_cap: 120_000,
  change_5m: 1.1,
  change_1h: 7,
  change_24h: 18,
  buys_1h: 90,
  sells_1h: 50,
  txns_1h: 140,
  pair_age_min: 90,
  twitter: "https://x.com/t",
  url: "https://dexscreener.com/solana/x",
};

describe("calls engine tick", () => {
  it("posts an agent call to the linked channel when armed", async () => {
    const sb = memSb();
    const sent = [];
    const out = await tickCallsDesk({
      sb,
      dryRun: false,
      force: true,
      tape: async () => [clean],
      send: async (_token, method, body) => {
        sent.push({ method, body });
        return { ok: true, result: { message_id: 9 } };
      },
    });
    expect(out.actions.some((a) => a.type === "call" && a.symbol === "TEST")).toBe(true);
    expect(sent.some((s) => s.method === "sendMessage" && String(s.body.text).includes("WHY THIS CALL"))).toBe(true);
    expect(sb._tables.ox_calls_ledger[0].mint).toBe(clean.mint);
    expect(sb._tables.ox_calls_ledger[0].telegram_posts[0].message_id).toBe(9);
  });

  it("skips posting when the desk is not armed", async () => {
    const sb = memSb();
    sb._tables.ox_calls_desk[0].armed = false;
    const sent = [];
    const out = await tickCallsDesk({
      sb,
      tape: async () => [clean],
      send: async (_t, method, body) => {
        sent.push({ method, body });
        return { ok: true, result: {} };
      },
    });
    expect(out.skipped).toBe("not_armed");
    expect(sent.filter((s) => s.method === "sendMessage" && /WHY THIS CALL/.test(s.body?.text || ""))).toHaveLength(0);
  });

  it("mirrors /on-chain live feed rows to the group the bot is in", async () => {
    const sb = memSb();
    const sent = [];
    const at = new Date().toISOString();
    const out = await pushLiveDeskToTelegram({
      sb,
      live: {
        wallet: "Desk111",
        feed: [
          {
            id: "evt-1",
            at,
            kind: "buy",
            agent_id: "neon-live",
            symbol: "MOUSE",
            mint: clean.mint,
            text: "NEON just put $1.50 into $MOUSE.",
            usd: 1.5,
          },
        ],
      },
      send: async (_token, method, body) => {
        sent.push({ method, body });
        return { ok: true, result: { message_id: 11 } };
      },
    });
    expect(out.posted).toBe(1);
    expect(sent[0].body.chat_id).toBe("-1001");
    expect(String(sent[0].body.text)).toContain("MOUSE");
    expect(String(sent[0].body.text)).toContain("/on-chain");
  });

  it("does not telegram skip ticks and caps bursts to 1 per 2 minutes", async () => {
    const sb = memSb();
    const sent = [];
    const send = async (_token, method, body) => {
      sent.push({ method, body });
      return { ok: true, result: { message_id: sent.length } };
    };
    const t0 = Date.parse("2026-09-07T18:00:00.000Z");
    const skipOut = await pushLiveDeskToTelegram({
      sb,
      now: t0,
      send,
      live: {
        feed: [
          { id: "s1", at: new Date(t0).toISOString(), kind: "skip", text: "passed" },
          { id: "s2", at: new Date(t0 + 1000).toISOString(), kind: "tick", text: "scan" },
        ],
      },
    });
    expect(skipOut.posted).toBe(0);
    expect(sent).toHaveLength(0);
    const buy1 = await pushLiveDeskToTelegram({
      sb,
      now: t0 + 2000,
      send,
      live: {
        feed: [{ id: "b1", at: new Date(t0 + 2000).toISOString(), kind: "buy", symbol: "ONE", mint: clean.mint, text: "bought one" }],
      },
    });
    expect(buy1.posted).toBe(1);
    const buy2 = await pushLiveDeskToTelegram({
      sb,
      now: t0 + 60_000,
      send,
      live: {
        feed: [{ id: "b2", at: new Date(t0 + 60_000).toISOString(), kind: "buy", symbol: "TWO", mint: "Mint222222222222222222222222222222222222222", text: "bought two" }],
      },
    });
    expect(buy2.posted).toBe(0);
    expect(buy2.skipped).toBe("min_gap");
    expect(sent.filter((s) => String(s.body?.text || "").includes("ONE"))).toHaveLength(1);
    expect(sent.filter((s) => String(s.body?.text || "").includes("TWO"))).toHaveLength(0);
  });

  it("registers a group from a Telegram message and sends the linked notice", async () => {
    const sb = memSb();
    sb._tables.ox_calls_chats = [];
    const sent = [];
    const out = await ingestCallsHook({
      sb,
      live: { feed: [] },
      body: { message: { chat: { id: -2002, title: "OrbitX group", type: "supergroup" }, text: "hello" } },
      send: async (_t, method, body) => {
        sent.push({ method, body });
        return { ok: true, result: { message_id: 1 } };
      },
    });
    expect(out.chat_id).toBe("-2002");
    expect(sb._tables.ox_calls_chats[0].chat_id).toBe("-2002");
    expect(sb._tables.ox_calls_desk[0].armed).toBe(true);
    expect(sent.some((s) => String(s.body.text).includes("live desk linked"))).toBe(true);
  });
});
