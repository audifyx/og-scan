import { afterEach, describe, expect, it, vi } from "vitest";
import { Connection } from "@solana/web3.js";
import { browserWalletRpcUrl, PUBLIC_SOLANA_RPC, sendRawWithFallback } from "./solanaRpc";

describe("browserWalletRpcUrl", () => {
  it("does not embed a Helius API key", () => {
    const url = browserWalletRpcUrl();
    expect(url.toLowerCase()).not.toContain("helius");
    expect(url.toLowerCase()).not.toContain("api-key");
    expect(url === PUBLIC_SOLANA_RPC || url.endsWith("/api/ogdex/rpc")).toBe(true);
  });
});

describe("sendRawWithFallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hops off a quota-exhausted preferred RPC onto the next candidate", async () => {
    const preferred = {
      rpcEndpoint: "https://helius.example/rpc",
      sendRawTransaction: vi.fn().mockRejectedValue(new Error("max usage reached")),
    } as unknown as Connection;
    const liveSend = vi.fn().mockResolvedValue("5".repeat(88));
    vi.spyOn(Connection.prototype, "sendRawTransaction").mockImplementation(liveSend);
    const sig = await sendRawWithFallback(new Uint8Array([1, 2, 3]), preferred);
    expect(preferred.sendRawTransaction).toHaveBeenCalled();
    expect(liveSend).toHaveBeenCalled();
    expect(sig).toHaveLength(88);
  });
});
