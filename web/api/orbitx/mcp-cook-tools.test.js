import { describe, expect, it } from "vitest";
import { buildCookTools, cookStats, COOK_META } from "./mcp-cook-tools.js";

describe("mcp cook catalog", () => {
  it("exposes exactly 200 unique tools with dispatch meta", () => {
    const tools = buildCookTools();
    const names = tools.map((t) => t.name);
    expect(names.length).toBe(200);
    expect(new Set(names).size).toBe(200);
    expect(cookStats().cookTools).toBe(200);
    for (const t of tools) {
      expect(COOK_META.has(t.name)).toBe(true);
      expect(t.inputSchema?.type).toBe("object");
    }
  });
});
