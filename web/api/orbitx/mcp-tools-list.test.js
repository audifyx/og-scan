import { describe, expect, it } from "vitest";
import { listLiveTools, orderedCoreTools, MCP_TOOLS_LIST_PAGE } from "../orbitx-hub.js";

describe("MCP tools/list", () => {
  it("puts live intel on the first page and stays under the ChatGPT 128-tool cap", () => {
    const first = listLiveTools();
    const names = first.tools.map((t) => t.name);
    expect(first.tools.length).toBeGreaterThan(20);
    expect(first.tools.length).toBeLessThanOrEqual(MCP_TOOLS_LIST_PAGE);
    expect(first.tools.length).toBeLessThanOrEqual(80);
    expect(names).toContain("orbitx_get_token");
    expect(names).toContain("orbitx_full_report");
    expect(names).toContain("orbitx_dex_chart");
    expect(names).toContain("orbitx_auth_link");
    expect(names.indexOf("orbitx_full_report")).toBeLessThan(12);
    expect(names.indexOf("orbitx_get_token")).toBeLessThan(12);
    expect(names.indexOf("orbitx_full_report")).toBeLessThan(names.indexOf("orbitx_life_city"));
    expect(first.nextCursor).toBe("core:80");
  });

  it("orders CORE so GET /api/mcp lists intel before life/gc helpers", () => {
    const names = orderedCoreTools().map((t) => t.name);
    expect(names[0]).toBe("search");
    expect(names).toContain("orbitx_full_report");
    expect(names.indexOf("orbitx_get_token")).toBeLessThan(names.indexOf("orbitx_life_city"));
    expect(names.indexOf("orbitx_full_report")).toBeLessThan(names.indexOf("orbitx_gc_start"));
  });
});
