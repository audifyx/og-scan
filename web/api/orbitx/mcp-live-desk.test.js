import { describe, expect, it } from "vitest";
import { LIVE_AGENTS, LIVE_TRADE_USD } from "../../shared/orbitx-live-desk.js";
import { LIVE_CORE_TOOLS, dispatchLiveTool, isLiveTool, resolveLiveNaturalTool } from "./mcp-live-desk.js";

describe("mcp live desk", () => {
  it("routes natural phrases onto read-only live tools", () => {
    expect(resolveLiveNaturalTool("live feed").name).toBe("orbitx_live_feed");
    expect(resolveLiveNaturalTool("agent city").name).toBe("orbitx_live_world");
    expect(resolveLiveNaturalTool("live desk").name).toBe("orbitx_live_desk");
    expect(resolveLiveNaturalTool("live agent positions").name).toBe("orbitx_live_positions");
    expect(resolveLiveNaturalTool("live agent NEON LIVE").name).toBe("orbitx_live_agent");
    expect(isLiveTool("orbitx_live_desk")).toBe(true);
    expect(isLiveTool("orbitx_live_feed")).toBe(true);
    expect(isLiveTool("orbitx_live_world")).toBe(true);
    expect(isLiveTool("orbitx_paper_desk")).toBe(false);
    expect(LIVE_CORE_TOOLS).toHaveLength(5);
  });

  it("never claims it can execute a swap from MCP", async () => {
    const desk = await dispatchLiveTool("orbitx_live_desk", {}, {});
    expect(desk.wallet).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(desk.trade_usd).toBe(LIVE_TRADE_USD);
    expect(desk.disclaimer).toMatch(/Not financial advice/);
    expect(JSON.stringify(LIVE_CORE_TOOLS)).toMatch(/READ ONLY/);
    expect(JSON.stringify(LIVE_CORE_TOOLS)).not.toMatch(/swap|sendRaw|private key/i);
    expect(desk.agents?.length || LIVE_AGENTS.length).toBe(3);
    const feed = await dispatchLiveTool("orbitx_live_feed", {}, {});
    expect(feed.ok).toBe(true);
    expect(Array.isArray(feed.posts)).toBe(true);
    const world = await dispatchLiveTool("orbitx_live_world", {}, {});
    expect(world.ok).toBe(true);
    expect(world.buildings.some((b) => b.kind === "solscan")).toBe(true);
    expect(world.characters).toHaveLength(3);
  });
});
