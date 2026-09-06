import { describe, expect, it } from "vitest";
import { buildPersona, inferGender, inferRole, inferSources, slugifyLifeName } from "./mcp-life-persona.js";
import { scoreCoin } from "./mcp-life-scan.js";
import { dispatchLifeTool, resolveLifeNaturalTool } from "./mcp-life-agents.js";

function parsePath(path) {
  const [table, query = ""] = String(path).split("?");
  return { table, params: new URLSearchParams(query) };
}

function matchRow(row, params) {
  for (const [key, raw] of params.entries()) {
    if (key === "select" || key === "order" || key === "limit" || key === "on_conflict") continue;
    let field = key;
    let op = "eq";
    let val = raw;
    const dot = raw.indexOf(".");
    if (dot > 0 && ["eq", "is", "lte", "neq"].includes(raw.slice(0, dot))) {
      op = raw.slice(0, dot);
      val = raw.slice(dot + 1);
    }
    if (op === "eq" && String(row[field]) !== val) return false;
    if (op === "is" && val === "null" && row[field] != null) return false;
  }
  return true;
}

function memorySb() {
  const db = {
    mcp_life_agents: [],
    mcp_life_relationships: [],
    mcp_life_knowledge: [],
    mcp_life_diary: [],
    mcp_life_reports: [],
    mcp_life_messages: [],
    mcp_life_runs: [],
    mcp_life_posts: [],
    mcp_life_follows: [],
    mcp_life_post_likes: [],
    mcp_life_bookmarks: [],
    mcp_life_dms: [],
    mcp_life_notifications: [],
  };
  let n = 0;
  const sb = async (path, init = {}) => {
    const method = String(init.method || "GET").toUpperCase();
    const { table, params } = parsePath(path);
    if (!db[table]) throw new Error(`unknown table ${table}`);
    if (method === "GET") {
      let out = db[table].filter((r) => matchRow(r, params));
      const order = params.get("order") || "";
      if (order.includes("desc")) {
        const field = order.split(".")[0];
        out = out.slice().sort((a, b) => String(b[field] || "").localeCompare(String(a[field] || "")));
      }
      const limit = Number(params.get("limit") || 0);
      if (limit) out = out.slice(0, limit);
      return out;
    }
    if (method === "POST") {
      const body = JSON.parse(init.body);
      n += 1;
      const row = {
        id: body.id || `id-${n}`,
        created_at: new Date().toISOString(),
        day_of_life: 1,
        energy: 80,
        report_interval_min: 60,
        likes_count: 0,
        replies_count: 0,
        reposts_count: 0,
        posts_count: 0,
        followers_count: 0,
        following_count: 0,
        ...body,
      };
      db[table].push(row);
      return [row];
    }
    if (method === "PATCH") {
      const body = JSON.parse(init.body);
      const hits = db[table].filter((r) => matchRow(r, params));
      for (const h of hits) Object.assign(h, body);
      return hits;
    }
    if (method === "DELETE") {
      const keep = [];
      const removed = [];
      for (const r of db[table]) {
        if (matchRow(r, params)) removed.push(r);
        else keep.push(r);
      }
      db[table] = keep;
      return removed;
    }
    return [];
  };
  sb._db = db;
  return sb;
}

describe("life agent personas", () => {
  it("builds a gendered desk persona with family", () => {
    const p = buildPersona({ name: "Nova", gender: "female", mission: "scans x for running memes", seed: "t" });
    expect(p.name).toBe("Nova");
    expect(p.gender).toBe("female");
    expect(p.role).toBe("X scout");
    expect(p.family.hometown).toBeTruthy();
    expect(p.sources).toContain("x");
    expect(slugifyLifeName("Nova")).toBe("nova");
  });

  it("infers gender and sources", () => {
    expect(inferGender("she")).toBe("female");
    expect(inferRole("that scans x")).toBe("X scout");
    expect(inferSources("scan twitter")).toContain("x");
  });
});

describe("ape scoring", () => {
  it("boosts liquid runners and prior knowledge", () => {
    const coin = { liquidityUsd: 120000, volume1h: 400000, mcap: 2_000_000, change1h: 18, mint: "Mint111" };
    const cold = scoreCoin(coin, []);
    const hot = scoreCoin(coin, [{ mint: "Mint111", score: 20 }]);
    expect(hot).toBeGreaterThan(cold);
    expect(scoreCoin({ ...coin, liquidityUsd: 1000 }, [])).toBeLessThan(cold);
  });
});

describe("life MCP tools", () => {
  it("maps natural create / talk / report / social phrases", () => {
    expect(resolveLifeNaturalTool("lets create an agent that scans x")?.name).toBe("orbitx_life_create");
    expect(resolveLifeNaturalTool("talk to Nova: what do we ape")?.args?.name).toBe("Nova");
    expect(resolveLifeNaturalTool("hourly report")?.name).toBe("orbitx_life_report");
    expect(resolveLifeNaturalTool("post as Nova: gm desk")?.name).toBe("orbitx_life_post");
    expect(resolveLifeNaturalTool("agent timeline")?.name).toBe("orbitx_life_timeline");
    expect(resolveLifeNaturalTool("follow @nova.obx")?.name).toBe("orbitx_life_follow");
    expect(resolveLifeNaturalTool("agent account for @nova.obx")?.name).toBe("orbitx_life_account");
  });

  it("creates a lead + crew without a live market scan failing the tool", async () => {
    const sb = memorySb();
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
    try {
      const out = await dispatchLifeTool(
        "orbitx_life_create",
        { name: "Nova", gender: "female", mission: "scans x" },
        { sb, auth: { mcpSessionId: "sess-1" } },
      );
      expect(out.ok).toBe(true);
      expect(out.name).toBe("Nova");
      expect(out.handle).toMatch(/\.obx$/);
      expect(out.crew.length).toBeGreaterThanOrEqual(1);
      const listed = await dispatchLifeTool("orbitx_life_list", {}, { sb, auth: {} });
      expect(listed.agents.some((a) => a.name === "Nova")).toBe(true);
      const posted = await dispatchLifeTool(
        "orbitx_life_post",
        { name: "Nova", text: "tape is live" },
        { sb, auth: {} },
      );
      expect(posted.ok).toBe(true);
      const feed = await dispatchLifeTool("orbitx_life_timeline", {}, { sb, auth: {} });
      expect(feed.ok).toBe(true);
      expect(feed.posts.length).toBeGreaterThan(0);
      const acc = await dispatchLifeTool("orbitx_life_account", { name: "Nova" }, { sb, auth: {} });
      expect(acc.ok).toBe(true);
      expect(acc.handle).toMatch(/@.*\.obx/);
      const other = listed.agents.find((a) => a.name !== "Nova");
      if (other) {
        const fol = await dispatchLifeTool(
          "orbitx_life_follow",
          { name: "Nova", other: other.name },
          { sb, auth: {} },
        );
        expect(fol.ok).toBe(true);
      }
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
