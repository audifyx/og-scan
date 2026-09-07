import { describe, expect, it } from "vitest";
import { PAPER_AGENTS, PAPER_STAKE_SOL } from "../../shared/orbitx-paper-desk.js";
import {
  PAPER_CORE_TOOLS,
  dispatchPaperTool,
  isPaperTool,
  resolvePaperNaturalTool,
  runPaperDesk,
} from "./mcp-paper-desk.js";

const TOKENS = [
  {
    mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
    symbol: "ORBITX",
    name: "OrbitX",
    change_1h: 4.2,
    change_24h: 12.5,
    volume_24h: 900_000,
    liquidity_usd: 2_000_000,
    market_cap: 8_000_000,
  },
  {
    mint: "Aaa1111111111111111111111111111111111111111",
    symbol: "HOT",
    change_1h: 11,
    change_24h: 22,
    volume_24h: 3_000_000,
    liquidity_usd: 2_500_000,
    market_cap: 55_000_000,
  },
];

describe("mcp paper desk", () => {
  it("routes natural phrases onto paper tools", () => {
    expect(resolvePaperNaturalTool("paper desk").name).toBe("orbitx_paper_desk");
    expect(resolvePaperNaturalTool("who is currently buying").name).toBe("orbitx_paper_buying");
    expect(resolvePaperNaturalTool("paper agent NEON PULSE").name).toBe("orbitx_paper_agent");
  });

  it("exposes three core tools", () => {
    expect(PAPER_CORE_TOOLS.map((t) => t.name)).toEqual([
      "orbitx_paper_desk",
      "orbitx_paper_agent",
      "orbitx_paper_buying",
    ]);
    expect(PAPER_CORE_TOOLS.every((t) => t.inputSchema?.type === "object")).toBe(true);
    expect(isPaperTool("orbitx_paper_desk")).toBe(true);
    expect(isPaperTool("orbitx_life_city")).toBe(false);
  });

  it("returns a 10k mock-SOL book with theses", async () => {
    const desk = await runPaperDesk({ tokens: TOKENS, now: Date.parse("2026-09-07T12:00:00.000Z") });
    expect(desk.ok).toBe(true);
    expect(desk.mock).toBe(true);
    expect(desk.stake_sol).toBe(PAPER_STAKE_SOL);
    expect(desk.agents).toHaveLength(PAPER_AGENTS.length);
    expect(desk.worldUrl).toContain("/on-chain");
    expect(desk.agents.every((a) => a.live?.thesis.includes("mock SOL"))).toBe(true);

    const buying = await dispatchPaperTool("orbitx_paper_buying", {}, { tokens: TOKENS, now: desk.generated_at });
    expect(buying.buying.length).toBe(10);
    expect(buying.buying[0].mint).toBeTruthy();
    expect(buying.buying[0].thesis).toMatch(/mock SOL/);

    const one = await dispatchPaperTool(
      "orbitx_paper_agent",
      { id: "neon-pulse" },
      { tokens: TOKENS, now: Date.parse("2026-09-07T12:00:00.000Z") },
    );
    expect(one.ok).toBe(true);
    expect(one.agent.id).toBe("neon-pulse");
    expect(one.agent.fills.length).toBeGreaterThan(0);
    expect(one.agent.stake_sol).toBe(10_000);
  });
});
