import { describe, expect, it } from "vitest";
import {
  DEFAULT_MCP_ACCESS_PACKAGES,
  MCP_ACCESS_TOKEN_AMOUNTS,
  MCP_BURN_MINT,
  clearPendingMcpBurn,
  mcpAccessSignUrl,
  parseBurnTxSignature,
  rememberPendingMcpBurn,
  takePendingMcpBurn,
} from "./mcpBurnAccess";

describe("mcpAccessSignUrl", () => {
  it("builds an hour-package burn handoff", () => {
    const url = mcpAccessSignUrl({
      packageId: "hour",
      publicKey: "11111111111111111111111111111111",
      origin: "https://www.orbitx.world",
    });
    expect(url).toContain("/agent/sign?");
    expect(url).toContain("kind=mcp-access");
    expect(url).toContain("package=hour");
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
    expect(url).toContain("amount=10000");
    expect(url).toContain("auto=1");
  });

  it("keeps the published package prices", () => {
    expect(DEFAULT_MCP_ACCESS_PACKAGES.map((p) => [p.id, p.tokens])).toEqual([
      ["hour", 100],
      ["day", 1000],
      ["week", 10_000],
      ["month", 1_000_000],
    ]);
    expect(MCP_ACCESS_TOKEN_AMOUNTS.month).toBe(1_000_000);
  });
});

describe("parseBurnTxSignature", () => {
  const sig = `${"1".repeat(32)}${"2".repeat(32)}abcd`;

  it("accepts a raw signature or a Solscan link", () => {
    expect(parseBurnTxSignature(`  ${sig}  `)).toBe(sig);
    expect(parseBurnTxSignature(`https://solscan.io/tx/${sig}`)).toBe(sig);
    expect(parseBurnTxSignature(`https://explorer.solana.com/tx/${sig}?cluster=mainnet`)).toBe(sig);
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
  it("lists hour/day/week/month burn packages for the shared shop", () => {
    expect(DEFAULT_MCP_ACCESS_PACKAGES).toHaveLength(4);
    expect(DEFAULT_MCP_ACCESS_PACKAGES[0]).toMatchObject({ id: "hour", tokens: 100 });
    expect(DEFAULT_MCP_ACCESS_PACKAGES[1]).toMatchObject({ id: "day", tokens: 1000 });
    expect(DEFAULT_MCP_ACCESS_PACKAGES[2]).toMatchObject({ id: "week", tokens: 10_000 });
    expect(DEFAULT_MCP_ACCESS_PACKAGES[3]).toMatchObject({ id: "month", tokens: 1_000_000 });
  });
});
