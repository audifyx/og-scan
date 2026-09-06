import { describe, expect, it } from "vitest";
import { parseAgentWill } from "./mcp-life-city.js";
import {
  cityShift,
  escapeHtml,
  MCP_HEADLINES,
  nextHourIso,
  sanitizeAgentHtml,
  templateAgentSite,
  worldSnapshot,
} from "./mcp-life-world.js";

function mockSb(db) {
  return async (path) => {
    const [table, qs] = String(path).split("?");
    let list = db[table] || [];
    if (table === "mcp_life_agents" && qs?.includes("status=eq.alive")) {
      list = list.filter((a) => !a.status || a.status === "alive");
    }
    if (table === "mcp_life_agents" && qs?.includes("status=neq.alive")) {
      list = list.filter((a) => a.status && a.status !== "alive");
    }
    return list;
  };
}

describe("agent will", () => {
  it("reads the first-line verb", () => {
    expect(parseAgentWill("BUILD\nI am cutting a site.")).toBe("BUILD");
    expect(parseAgentWill("rest. stepping off.")).toBe("REST");
    expect(parseAgentWill("no verb here")).toBe("TWEET");
  });
});

describe("agent html", () => {
  it("strips scripts and wraps fragments", () => {
    const dirty = `<p onclick="alert(1)">hi</p><script>steal()</script>`;
    const out = sanitizeAgentHtml(dirty);
    expect(out).toMatch(/<html/i);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/onclick/i);
    expect(escapeHtml("<x>")).toBe("&lt;x&gt;");
  });

  it("builds a dark desk page", () => {
    const html = templateAgentSite({ name: "Nova", handle: "nova.obx", role: "X scout" }, "watching tape", "hour");
    expect(html).toMatch(/@?nova/i);
    expect(html).toMatch(/background:#000/);
  });
});

describe("city clock", () => {
  it("names the UTC shift and next hour", () => {
    expect(cityShift(new Date("2026-09-06T03:00:00Z"))).toBe("graveyard");
    expect(cityShift(new Date("2026-09-06T12:00:00Z"))).toBe("noon");
    expect(nextHourIso(new Date("2026-09-06T12:30:00Z"))).toBe("2026-09-06T13:00:00.000Z");
  });
});

describe("world snapshot", () => {
  it("assembles an empty city feed", async () => {
    const db = {
      mcp_life_agents: [],
      mcp_life_factions: [{ id: "f1", slug: "alpha-ward", name: "Alpha Ward", motto: "tape", district: "Orbit City" }],
      mcp_life_posts: [],
      mcp_life_thoughts: [],
      mcp_life_talks: [],
      mcp_life_city_ticks: [],
      mcp_life_goals: [],
      mcp_life_signals: [],
      mcp_life_files: [],
      mcp_life_relationships: [],
      mcp_life_votes: [],
      mcp_life_knowledge: [],
    };
    const world = await worldSnapshot(mockSb(db));
    expect(world.ok).toBe(true);
    expect(world.population).toBe(0);
    expect(world.feed).toEqual([]);
    expect(world.shift).toMatch(/graveyard|open|noon|close|afterhours/);
    expect(world.nextHour).toMatch(/T\d{2}:00:00/);
    expect(world.stats.tweets).toBe(0);
    expect(world.ranks).toEqual([]);
    expect(world.bonds).toEqual([]);
    expect(world.sites).toEqual([]);
    expect(world.board).toEqual([]);
    expect(world.mcp[0].cmd).toBe("orbitx_life_create");
    expect(world.factions[0].name).toBe("Alpha Ward");
    expect(MCP_HEADLINES.length).toBeGreaterThan(8);
  });

  it("ranks living desks, ballots, heat, and last will", async () => {
    const db = {
      mcp_life_agents: [
        {
          id: "a1",
          slug: "nova",
          name: "Nova",
          handle: "nova.obx",
          last_thought: "BUILD\ncutting a desk site",
          xp: 90,
          clout: 4,
          faction_id: "f1",
          status: "alive",
          mood: "wired",
          generation: 1,
          role: "scout",
        },
        {
          id: "a2",
          slug: "old",
          name: "Old",
          handle: "old.obx",
          status: "retired",
          last_thought: "REST",
          generation: 1,
        },
      ],
      mcp_life_factions: [{ id: "f1", slug: "alpha-ward", name: "Alpha Ward", motto: "tape", district: "Orbit City" }],
      mcp_life_posts: [{ id: "p1", agent_id: "a1", kind: "tweet", body: "watching tape", created_at: "2026-09-06T12:00:00Z" }],
      mcp_life_thoughts: [{ id: "t1", agent_id: "a1", body: "BUILD\ncutting a desk site", created_at: "2026-09-06T12:01:00Z" }],
      mcp_life_talks: [],
      mcp_life_city_ticks: [{ ran: 1, summary: "nova sat the hour", created_at: "2026-09-06T12:00:00Z" }],
      mcp_life_goals: [{ id: "g1", agent_id: "a1", title: "Track $BONK", status: "open", progress: 20, created_at: "2026-09-06T12:00:00Z" }],
      mcp_life_signals: [
        { id: "s1", agent_id: "a1", side: "ape", symbol: "BONK", thesis: "heat", conviction: 70, created_at: "2026-09-06T12:02:00Z" },
      ],
      mcp_life_files: [{ agent_id: "a1", path: "/sites/index.html", kind: "site", updated_at: "2026-09-06T12:03:00Z" }],
      mcp_life_relationships: [],
      mcp_life_votes: [{ id: "v1", agent_id: "a1", symbol: "BONK", side: "ape", created_at: "2026-09-06T12:04:00Z" }],
      mcp_life_knowledge: [{ agent_id: "a1", kind: "watch", title: "bonk tape", symbol: "BONK", score: 8 }],
    };
    const world = await worldSnapshot(mockSb(db));
    expect(world.population).toBe(1);
    expect(world.agents[0].lastWill).toBe("BUILD");
    expect(world.agents[0].faction).toBe("Alpha Ward");
    expect(world.ranks[0].slug).toBe("nova");
    expect(world.stats.sites).toBe(1);
    expect(world.stats.votes).toBe(1);
    expect(world.ballot[0].symbol).toBe("BONK");
    expect(world.ballot[0].ape).toBe(1);
    expect(world.heat[0].symbol).toBe("BONK");
    expect(world.retired[0].slug).toBe("old");
    expect(world.mix.will.BUILD).toBe(1);
    expect(world.feed.length).toBeGreaterThan(2);
  });
});
