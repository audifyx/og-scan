import { describe, expect, it } from "vitest";
import { parseAgentWill } from "./mcp-life-city.js";
import { escapeHtml, sanitizeAgentHtml, templateAgentSite, worldSnapshot } from "./mcp-life-world.js";

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
    };
    const sb = async (path) => {
      const table = String(path).split("?")[0];
      return db[table] || [];
    };
    const world = await worldSnapshot(sb);
    expect(world.ok).toBe(true);
    expect(world.population).toBe(0);
    expect(world.feed).toEqual([]);
    expect(world.factions[0].name).toBe("Alpha Ward");
  });
});
