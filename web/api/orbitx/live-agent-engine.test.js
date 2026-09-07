import { describe, expect, it } from "vitest";
import { LIVE_AGENTS } from "../../shared/orbitx-live-desk.js";
import { tickLiveDesk } from "./live-agent-engine.js";

function memSb() {
  const tables = {
    ox_live_desk: [{ id: "main", armed: true, paused: false, last_agent_id: null }],
    ox_live_positions: [],
    ox_live_fills: [],
    ox_live_events: [],
  };
  const api = (name) => ({
    select() {
      return {
        eq(col, val) {
          if (name === "ox_live_desk") {
            return {
              async maybeSingle() {
                return { data: tables[name].find((r) => r[col] === val) || null, error: null };
              },
            };
          }
          const rows = tables[name].filter((r) => r[col] === val);
          return {
            order() {
              return {
                async then(resolve) {
                  return resolve({ data: rows, error: null });
                },
                limit() {
                  return Promise.resolve({ data: rows, error: null });
                },
              };
            },
          };
        },
        order() {
          return {
            limit() {
              return Promise.resolve({ data: tables[name], error: null });
            },
          };
        },
      };
    },
    upsert(row) {
      const i = tables[name].findIndex((r) => r.id === row.id);
      if (i >= 0) tables[name][i] = { ...tables[name][i], ...row };
      else tables[name].push({ ...row });
      return Promise.resolve({ data: row, error: null });
    },
    insert(row) {
      const rec = { id: `${name}-${tables[name].length + 1}`, ...row };
      tables[name].push(rec);
      return {
        select() {
          return {
            async single() {
              return { data: rec, error: null };
            },
          };
        },
        then(resolve) {
          return resolve({ data: rec, error: null });
        },
      };
    },
    update(patch) {
      return {
        eq(col, val) {
          tables[name] = tables[name].map((r) => (r[col] === val ? { ...r, ...patch } : r));
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  });
  return {
    from: api,
    _tables: tables,
  };
}

describe("live agent engine tick", () => {
  it("buys $1.50 of a sellable coin then fully exits at take-profit", async () => {
    const prev = process.env.LIVE_AGENT_ENABLED;
    process.env.LIVE_AGENT_ENABLED = "1";
    const sb = memSb();
    const coin = {
      mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
      symbol: "ORBITX",
      name: "OrbitX",
      change_1h: 8,
      change_24h: 14,
      volume_24h: 900_000,
      liquidity_usd: 2_000_000,
      market_cap: 8_000_000,
      pair_age_min: 400,
      price_usd: 1,
    };
    const buy = await tickLiveDesk({
      sb,
      force: true,
      dryRun: true,
      sol_usd: 150,
      solBalance: 0.05,
      keypair: { publicKey: { toBase58: () => "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj" } },
      owner: "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj",
      tape: async () => [coin],
      safety: async () => ({ canBuy: true, canSell: true, roundTripLossPct: 3, buyImpactPct: 0.4 }),
      mark: async () => 1,
      swap: async () => ({ ok: true, signature: "sig-buy", outAmount: "1000" }),
    });
    expect(buy.actions.some((a) => a.type === "buy" && a.usd === 1.5)).toBe(true);
    expect(sb._tables.ox_live_events.some((e) => e.kind === "buy")).toBe(true);
    expect(buy.actions[0].thesis).toMatch(/\$0\.30/);
    expect(LIVE_AGENTS.map((a) => a.id)).toContain(buy.actions[0].agent_id);

    sb._tables.ox_live_positions.push({
      id: "pos-1",
      agent_id: "neon-live",
      mint: coin.mint,
      symbol: "ORBITX",
      usd_in: 1.5,
      sol_in: 1.5 / 150,
      entry_price_usd: 1,
      tp_pct: 0.12,
      status: "open",
      thesis: "test",
    });
    const sell = await tickLiveDesk({
      sb,
      force: true,
      dryRun: true,
      sol_usd: 150,
      solBalance: 0.03,
      keypair: { publicKey: { toBase58: () => "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj" } },
      owner: "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj",
      tape: async () => [coin],
      safety: async () => ({ canBuy: true, canSell: true, roundTripLossPct: 3, buyImpactPct: 0.4 }),
      mark: async () => 1.12,
      swap: async () => ({ ok: true, signature: "sig-sell", outAmount: "15000000" }),
    });
    expect(sell.actions.some((a) => a.type === "sell" && a.reason === "take_profit")).toBe(true);

    if (prev === undefined) delete process.env.LIVE_AGENT_ENABLED;
    else process.env.LIVE_AGENT_ENABLED = prev;
  });

  it("skips a high-MC major like JUP and buys a low-cap with community tape", async () => {
    const prev = process.env.LIVE_AGENT_ENABLED;
    process.env.LIVE_AGENT_ENABLED = "1";
    const sb = memSb();
    const jup = {
      mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
      symbol: "JUP",
      name: "Jupiter",
      change_1h: 5,
      change_24h: -8,
      volume_24h: 40_000_000,
      liquidity_usd: 25_000_000,
      market_cap: 1_200_000_000,
      pair_age_min: 525_600,
      price_usd: 0.4,
    };
    const skip = await tickLiveDesk({
      sb,
      force: true,
      dryRun: true,
      sol_usd: 150,
      solBalance: 0.05,
      keypair: { publicKey: { toBase58: () => "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj" } },
      owner: "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj",
      tape: async () => [jup],
      safety: async () => ({ canBuy: true, canSell: true, roundTripLossPct: 1.2, buyImpactPct: 0.1 }),
      mark: async () => 0.4,
      swap: async () => ({ ok: true, signature: "sig-jup", outAmount: "1000" }),
    });
    expect(skip.actions.some((a) => a.type === "buy")).toBe(false);
    expect(skip.skipped).toBe("no_clean_coin");

    sb._tables.ox_live_events = [];
    const room = {
      mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
      symbol: "ROOM",
      name: "Room",
      change_1h: 9,
      change_24h: 14,
      volume_24h: 220_000,
      liquidity_usd: 180_000,
      market_cap: 2_100_000,
      pair_age_min: 180,
      price_usd: 0.02,
      twitter: "https://x.com/room",
      buys_1h: 120,
    };
    const buy = await tickLiveDesk({
      sb,
      force: true,
      dryRun: true,
      sol_usd: 150,
      solBalance: 0.05,
      keypair: { publicKey: { toBase58: () => "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj" } },
      owner: "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj",
      tape: async () => [jup, room],
      safety: async () => ({ canBuy: true, canSell: true, roundTripLossPct: 3, buyImpactPct: 0.4 }),
      mark: async () => 0.02,
      swap: async () => ({ ok: true, signature: "sig-room", outAmount: "1000" }),
    });
    expect(buy.actions.some((a) => a.type === "buy" && a.symbol === "ROOM" && a.usd === 1.5)).toBe(true);
    expect(buy.actions[0].thesis).toMatch(/\$0\.30/);
    if (prev === undefined) delete process.env.LIVE_AGENT_ENABLED;
    else process.env.LIVE_AGENT_ENABLED = prev;
  });
});
