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
    expect(names).toContain("orbitx_life_x_relay");
    expect(names).toContain("orbitx_life_converse");
  });

  it("mints .obx handles", () => {
    expect(lifeHandleFromSlug("nova")).toBe("nova.obx");
    expect(lifeHandleFromSlug("Nova Scout")).toBe("novascout.obx");
  });

  it("dispatches help without a database", async () => {
    const out = await dispatchLifeCmd("orbitx_life_help", {}, { sb: async () => [] });
    expect(out.ok).toBe(true);
    expect(out.cmds).toBe(300);
    expect(out.message).toMatch(/orbitxagents/i);
  });
});

describe("life city", () => {
  function citySb() {
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
    const match = (row, query) => {
      const params = new URLSearchParams(query);
      for (const [key, raw] of params.entries()) {
        if (key === "select" || key === "order" || key === "limit" || key === "on_conflict") continue;
        const eq = String(raw).startsWith("eq.") ? String(raw).slice(3) : null;
        if (eq != null && String(row[key]) !== eq) return false;
      }
      return true;
    };
    const sb = async (path, init = {}) => {
      const method = String(init.method || "GET").toUpperCase();
      const [table, query = ""] = String(path).split("?");
      if (!db[table]) throw new Error(`unknown table ${table}`);
      if (method === "GET") {
        let out = db[table].filter((r) => match(r, query));
        const limit = Number(new URLSearchParams(query).get("limit") || 0);
        if (limit) out = out.slice(0, limit);
        return out;
      }
      if (method === "POST") {
        n += 1;
        const body = JSON.parse(init.body);
        const row = { id: body.id || `id-${n}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...body };
        db[table].push(row);
        return [row];
      }
      if (method === "PATCH") {
        const body = JSON.parse(init.body);
        const hits = db[table].filter((r) => match(r, query));
        for (const h of hits) Object.assign(h, body);
        return hits;
      }
      return [];
    };
    sb._db = db;
    return sb;
  }

  it("snapshots an empty city and thinks in template mode", async () => {
    const sb = citySb();
    const snap = await dispatchLifeCmd("orbitx_life_city", {}, { sb });
    expect(snap.ok).toBe(true);
    expect(snap.population).toBe(0);
    expect(snap.factions.length).toBeGreaterThanOrEqual(1);

    sb._db.mcp_life_agents.push({
      id: "agent-nova",
      name: "Nova",
      slug: "nova",
      handle: "nova.obx",
      status: "alive",
      role: "X scout",
      mood: "focused",
      voice: "stoic",
      personality: "dry",
      day_of_life: 3,
      xp: 0,
      clout: 0,
      generation: 1,
      posts_count: 0,
    });
    const thought = await dispatchLifeCmd("orbitx_life_think", { name: "Nova", text: "what do you believe" }, { sb });
    expect(thought.ok).toBe(true);
    expect(thought.thought).toMatch(/Nova/i);
    expect(sb._db.mcp_life_thoughts.length).toBeGreaterThan(0);
    expect(sb._db.mcp_life_files.some((f) => f.path === "/memory.md")).toBe(true);

    const wrote = await dispatchLifeCmd(
      "orbitx_life_file_write",
      { name: "Nova", path: "/memory.md", text: "second note" },
      { sb },
    );
    expect(wrote.ok).toBe(true);
    const read = await dispatchLifeCmd("orbitx_life_file_read", { name: "Nova", path: "/memory.md" }, { sb });
    expect(read.ok).toBe(true);
    expect(read.file.body).toMatch(/second note/);

    const ritual = await dispatchLifeCmd("orbitx_life_dawn_shift", {}, { sb });
    expect(ritual.ok).toBe(true);
    expect(ritual.population).toBeGreaterThanOrEqual(1);
  });
});
