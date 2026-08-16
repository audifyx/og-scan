import { describe, expect, it } from "vitest";
import {
  DEFAULT_MCP_ACCESS_PACKAGES,
  MCP_BURN_MINT,
  clearPendingMcpBurn,
  mcpAccessSignUrl,
  rememberPendingMcpBurn,
  takePendingMcpBurn,
} from "./mcpBurnAccess";

describe("mcpAccessSignUrl", () => {
  it("builds a day-package burn handoff", () => {
    const url = mcpAccessSignUrl({
      packageId: "day",
      publicKey: "11111111111111111111111111111111",
      origin: "https://www.orbitx.world",
    });
    expect(url).toContain("/agent/sign?");
    expect(url).toContain("kind=mcp-access");
    expect(url).toContain("package=day");
    expect(url).toContain("amount=100");
    expect(url).toContain(MCP_BURN_MINT);
  });

  it("builds a week-package auto-confirm handoff", () => {
    const url = mcpAccessSignUrl({
      packageId: "week",
      publicKey: "11111111111111111111111111111111",
      auto: true,
      origin: "https://orbitx.world",
    });
    expect(url.startsWith("https://www.orbitx.world/agent/sign?")).toBe(true);
    expect(url).toContain("package=week");
    expect(url).toContain("amount=1000");
    expect(url).toContain("auto=1");
  });

  it("keeps the published package prices", () => {
    expect(DEFAULT_MCP_ACCESS_PACKAGES.map((p) => [p.id, p.tokens])).toEqual([
      ["day", 100],
      ["week", 1000],
    ]);
  });
});

describe("pending burn handoff", () => {
  it("remembers a Jupiter burn so shop can grant access if confirm raced the RPC", () => {
    clearPendingMcpBurn();
    rememberPendingMcpBurn({
      signature: "sig123",
      publicKey: "11111111111111111111111111111111",
      packageId: "day",
    });
    expect(takePendingMcpBurn()).toMatchObject({
      signature: "sig123",
      packageId: "day",
    });
    clearPendingMcpBurn();
    expect(takePendingMcpBurn()).toBeNull();
  });
});

describe("MCP shop catalog", () => {
  it("lists both burn packages for the shared shop", () => {
    expect(DEFAULT_MCP_ACCESS_PACKAGES).toHaveLength(2);
    expect(DEFAULT_MCP_ACCESS_PACKAGES[0]).toMatchObject({ id: "day", tokens: 100 });
    expect(DEFAULT_MCP_ACCESS_PACKAGES[1]).toMatchObject({ id: "week", tokens: 1000 });
  });
});
