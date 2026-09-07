import { describe, expect, it } from "vitest";
import { browserWalletRpcUrl, PUBLIC_SOLANA_RPC } from "./solanaRpc";

describe("browserWalletRpcUrl", () => {
  it("does not embed a Helius API key", () => {
    const url = browserWalletRpcUrl();
    expect(url.toLowerCase()).not.toContain("helius");
    expect(url.toLowerCase()).not.toContain("api-key");
    expect(url === PUBLIC_SOLANA_RPC || url.endsWith("/api/ogdex/rpc")).toBe(true);
  });
});
