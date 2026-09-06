import { describe, expect, it } from "vitest";
import { buildLifeCmdTools, dispatchLifeCmd, lifeCmdStats, LIFE_CMD_META } from "./mcp-life-cmds.js";
import { lifeHandleFromSlug } from "./mcp-life-social.js";

describe("life cmd catalog", () => {
  it("exposes exactly 300 unique tools with dispatch meta", () => {
    const tools = buildLifeCmdTools();
    const names = tools.map((t) => t.name);
    expect(names.length).toBe(300);
    expect(new Set(names).size).toBe(300);
    expect(lifeCmdStats().lifeCmds).toBe(300);
    for (const t of tools) {
      expect(t.name.startsWith("orbitx_life_")).toBe(true);
      expect(LIFE_CMD_META.has(t.name)).toBe(true);
      expect(t.inputSchema?.type).toBe("object");
    }
    expect(names).not.toContain("orbitx_life_create");
    expect(names).not.toContain("orbitx_life_post");
    expect(names).toContain("orbitx_life_city");
    expect(names).toContain("orbitx_life_think");
    expect(names).toContain("orbitx_life_files");
  });

  it("mints .obx handles", () => {
    expect(lifeHandleFromSlug("nova")).toBe("nova.obx");
    expect(lifeHandleFromSlug("Nova Scout")).toBe("novascout.obx");
  });

  it("dispatches help without a database", async () => {
    const out = await dispatchLifeCmd("orbitx_life_help", {}, { sb: async () => [] });
    expect(out.ok).toBe(true);
    expect(out.cmds).toBe(300);
    expect(out.message).toMatch(/MCP-only/i);
  });
});

describe("life city", () => {
  it("snapshots an empty city and thinks in template mode", async () => {
    const db = {
      mcp_life_agents: [],
      mcp_life_factions: [],
      mcp_life_files: [],
      mcp_life_daily_logs: [],
      mcp_life_thoughts: [],
      mcp_life_talks: [],
      mcp_life_posts: [],
      mcp_life_follows: [],
      mcp_life_post_likes: [],
      mcp_life_notifications: [],
      mcp_life_knowledge: [],
      mcp_life_signals: [],
      mcp_life_votes: [],
      mcp_life_city_ticks: [],
      mcp_life_relationships: [],
    };
    let n = 0;
    const sb = async (path, init = {}) => {
      const method = String(init.method || "GET").toUpperCase();
      const table = String(path).split("?")[0];
      if (!db[table]) throw new Error(`unknown table ${table}`);
      if (method === "GET") return db[table];
      if (method === "POST") {
        n += 1;
        const body = JSON.parse(init.body);
        const row = { id: body.id || `id-${n}`, created_at: new Date().toISOString(), ...body };
        db[table].push(row);
        return [row];
      }
      if (method === "PATCH") return [];
      return [];
    };
    const snap = await dispatchLifeCmd("orbitx_life_city", {}, { sb });
    expect(snap.ok).toBe(true);
    expect(snap.population).toBe(0);
    expect(snap.factions.length).toBeGreaterThanOrEqual(1);
  });
});
