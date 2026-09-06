import { describe, expect, it } from "vitest";
import { buildLifeCmdTools, dispatchLifeCmd, lifeCmdStats, LIFE_CMD_META } from "./mcp-life-cmds.js";
import { lifeHandleFromSlug } from "./mcp-life-social.js";

describe("life cmd catalog", () => {
  it("exposes exactly 100 unique tools with dispatch meta", () => {
    const tools = buildLifeCmdTools();
    const names = tools.map((t) => t.name);
    expect(names.length).toBe(100);
    expect(new Set(names).size).toBe(100);
    expect(lifeCmdStats().lifeCmds).toBe(100);
    for (const t of tools) {
      expect(t.name.startsWith("orbitx_life_")).toBe(true);
      expect(LIFE_CMD_META.has(t.name)).toBe(true);
      expect(t.inputSchema?.type).toBe("object");
    }
    expect(names).not.toContain("orbitx_life_create");
    expect(names).not.toContain("orbitx_life_post");
    expect(names).not.toContain("orbitx_life_timeline");
    expect(names).not.toContain("orbitx_life_follow");
    expect(names).not.toContain("orbitx_life_account");
  });

  it("mints .obx handles", () => {
    expect(lifeHandleFromSlug("nova")).toBe("nova.obx");
    expect(lifeHandleFromSlug("Nova Scout")).toBe("novascout.obx");
  });

  it("dispatches help without a database", async () => {
    const out = await dispatchLifeCmd("orbitx_life_help", {}, { sb: async () => [] });
    expect(out.ok).toBe(true);
    expect(out.cmds).toBe(100);
    expect(out.message).toMatch(/MCP-only/i);
  });
});
