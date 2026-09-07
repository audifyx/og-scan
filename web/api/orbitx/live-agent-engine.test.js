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
  it("buys $1.50 of a sellable coin then scales 41% and flattens the 59%", async () => {
    const prev = process.env.LIVE_AGENT_ENABLED;
    process.env.LIVE_AGENT_ENABLED = "1";
    const sb = memSb();
    const coin = {
      mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
      symbol: "ORBITX",
      name: "OrbitX",
      change_1h: 8,
      change_5m: -2.1,
      change_24h: 14,
      volume_24h: 220_000,
      liquidity_usd: 80_000,
      market_cap: 420_000,
      pair_age_min: 180,
      price_usd: 1,
      twitter: "https://x.com/orbitx",
      buys_1h: 80,
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

    sb._tables.ox_live_positions = [
      {
        id: "pos-1",
        agent_id: "neon-live",
        mint: coin.mint,
        symbol: "ORBITX",
        usd_in: 1.5,
        sol_in: 1.5 / 150,
        entry_price_usd: 1,
        tp_pct: 0.2,
        status: "open",
        thesis: "test",
        tokens_raw: "1000",
        opened_at: "2026-09-07T12:00:00Z",
      },
    ];
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
      mark: async () => 1.2,
      swap: async () => ({ ok: true, signature: "sig-sell", outAmount: "15000000" }),
    });
    expect(sell.actions.some((a) => a.type === "sell" && a.reason === "scale_out" && a.keep_pct === 0.59)).toBe(true);
    expect(sb._tables.ox_live_positions.some((p) => p.id === "pos-1" && p.status !== "closed")).toBe(true);

    const scaleFill = sb._tables.ox_live_fills.find((f) => f.reason === "scale_out");
    if (scaleFill) scaleFill.created_at = new Date(Date.now() - 9 * 60_000).toISOString();
    const flat = await tickLiveDesk({
      sb,
      force: true,
      dryRun: true,
      sol_usd: 150,
      solBalance: 0.03,
      keypair: { publicKey: { toBase58: () => "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj" } },
      owner: "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj",
      tape: async () => [coin],
      safety: async () => ({ canBuy: true, canSell: true, roundTripLossPct: 3, buyImpactPct: 0.4 }),
      mark: async () => 1.2,
      swap: async () => ({ ok: true, signature: "sig-flat", outAmount: "8000000" }),
    });
    expect(flat.actions.some((a) => a.type === "sell" && a.reason === "take_profit")).toBe(true);

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
    sb._tables.ox_live_desk[0].last_agent_id = null;
    const room = {
      mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
      symbol: "ROOM",
      name: "Room",
      change_1h: 9,
      change_5m: -2.2,
      change_24h: 14,
      volume_24h: 220_000,
      liquidity_usd: 180_000,
      market_cap: 2_100_000,
      pair_age_min: 180,
      price_usd: 0.02,
      twitter: "https://x.com/room",
      buys_1h: 120,
    };
    let probes = 0;
    const buy = await tickLiveDesk({
      sb,
      force: true,
      dryRun: true,
      sol_usd: 150,
      solBalance: 0.05,
      keypair: { publicKey: { toBase58: () => "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj" } },
      owner: "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj",
      tape: async () => [jup, room],
      safety: async () => {
        probes += 1;
        return { canBuy: true, canSell: true, roundTripLossPct: 3, buyImpactPct: 0.4 };
      },
      mark: async () => 0.02,
      swap: async () => ({ ok: true, signature: "sig-room", outAmount: "1000" }),
    });
    expect(probes).toBe(1);
    expect(buy.actions.some((a) => a.type === "buy" && a.symbol === "ROOM" && a.usd === 1.5)).toBe(true);
    expect(buy.last_tick_at).toBeTruthy();
    expect(sb._tables.ox_live_desk[0].last_agent_id).toBe("neon-live");
    expect(sb._tables.ox_live_events.some((e) => e.kind === "tick" && e.reason === "scan")).toBe(false);
    expect(buy.actions[0].thesis).toMatch(/\$0\.30/);

    sb._tables.ox_live_positions = [];
    sb._tables.ox_live_events = [];
    const mouse = {
      mint: "Aw6fiDPWLUnjSsJQtsyEMSaoPaKAUUrStAsYPiPwpump",
      symbol: "ANONYMOUSE",
      change_5m: -8.69,
      change_15m: -7.69,
      change_1h: 122,
      change_24h: 101,
      volume_24h: 364_000,
      liquidity_usd: 24_451,
      market_cap: 85_440,
      pair_age_min: 70,
      price_usd: 0.00008,
      twitter: "https://x.com/OxFlipped",
      buys_1h: 200,
      sells_1h: 260,
    };
    let mouseProbes = 0;
    const skipDump = await tickLiveDesk({
      sb,
      force: true,
      dryRun: true,
      sol_usd: 150,
      solBalance: 0.05,
      keypair: { publicKey: { toBase58: () => "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj" } },
      owner: "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj",
      tape: async () => [mouse],
      safety: async () => {
        mouseProbes += 1;
        return { canBuy: true, canSell: true, roundTripLossPct: 3, buyImpactPct: 0.4 };
      },
      mark: async () => 0.00008,
      swap: async () => ({ ok: true, signature: "sig-mouse", outAmount: "1000" }),
    });
    expect(mouseProbes).toBe(0);
    expect(skipDump.actions.some((a) => a.type === "buy")).toBe(false);
    expect(skipDump.skipped).toBe("no_clean_coin");
    expect(sb._tables.ox_live_desk[0].last_agent_id).toBe("warden-live");

    sb._tables.ox_live_positions = [];
    sb._tables.ox_live_events = [];
    const digesting = {
      ...mouse,
      change_5m: 1.2,
      change_15m: -1.4,
      change_1h: -6.8,
      change_24h: 80,
      buys_1h: 210,
      sells_1h: 150,
    };
    let waitProbes = 0;
    const wait = await tickLiveDesk({
      sb,
      force: true,
      dryRun: true,
      sol_usd: 150,
      solBalance: 0.05,
      keypair: { publicKey: { toBase58: () => "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj" } },
      owner: "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj",
      tape: async () => [digesting, room],
      safety: async () => {
        waitProbes += 1;
        return { canBuy: true, canSell: true, roundTripLossPct: 3, buyImpactPct: 0.4 };
      },
      mark: async () => 0.00008,
      swap: async () => ({ ok: true, signature: "sig-wait", outAmount: "1000" }),
    });
    expect(waitProbes).toBe(1);
    expect(wait.actions.some((a) => a.type === "buy" && a.symbol === "ANONYMOUSE" && a.usd === 1)).toBe(true);
    expect(wait.actions.some((a) => a.type === "buy" && a.symbol === "ROOM")).toBe(false);

    sb._tables.ox_live_positions = [];
    sb._tables.ox_live_events = [];
    const running = {
      ...digesting,
      change_5m: 5.4,
      change_15m: 3.2,
      change_1h: 8.6,
      change_24h: 38,
      buys_1h: 260,
      sells_1h: 170,
    };
    let runProbes = 0;
    const ape = await tickLiveDesk({
      sb,
      force: true,
      dryRun: true,
      sol_usd: 150,
      solBalance: 0.05,
      keypair: { publicKey: { toBase58: () => "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj" } },
      owner: "BhdxqXy1C1PMaLBGUABdncqjR68PqB19xPJYcpGcWPJj",
      tape: async () => [running, room],
      safety: async () => {
        runProbes += 1;
        return { canBuy: true, canSell: true, roundTripLossPct: 3, buyImpactPct: 0.4 };
      },
      mark: async () => 0.00009,
      swap: async () => ({ ok: true, signature: "sig-run", outAmount: "1000" }),
    });
    expect(runProbes).toBe(1);
    expect(ape.actions.some((a) => a.type === "buy" && a.symbol === "ANONYMOUSE" && a.usd === 1)).toBe(true);
    expect(ape.actions.some((a) => a.type === "buy" && a.symbol === "ROOM")).toBe(false);
    if (prev === undefined) delete process.env.LIVE_AGENT_ENABLED;
    else process.env.LIVE_AGENT_ENABLED = prev;
  });
});
