import { describe, expect, it } from "vitest";
import { tickCallsDesk } from "./calls-engine.js";

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
});
