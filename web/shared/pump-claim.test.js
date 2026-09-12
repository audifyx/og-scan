import { describe, expect, it, vi, afterEach } from "vitest";
import {
  COLLECT_CREATOR_FEE_DISCRIMINATOR,
  COLLECT_CREATOR_FEE_V2_DISCRIMINATOR,
  PUMP_PROGRAM_ID,
  SYSTEM_ACCOUNT_RENT_LAMPORTS,
  CLAIM_RPC_URLS,
  isRpcQuotaError,
  isRpcUnavailableError,
  jsonRpcWithFallback,
} from "./pump-claim.js";

describe("pump-claim quota detection", () => {
  it("matches the Helius / PumpPortal 429 body and the user-facing 'used usage'", () => {
    expect(isRpcQuotaError("max usage reached")).toBe(true);
    expect(isRpcQuotaError("used usage")).toBe(true);
    expect(isRpcQuotaError("PumpPortal claim build failed (429): max usage reached")).toBe(true);
    expect(isRpcQuotaError({ status: 429, message: "max usage reached" })).toBe(true);
    expect(isRpcQuotaError({ error: { message: "Max Usage Reached" } })).toBe(true);
    expect(isRpcQuotaError({ data: { error: { message: "credits exhausted" } } })).toBe(true);
  });

  it("does not treat unrelated failures as quota", () => {
    expect(isRpcQuotaError("User rejected the request")).toBe(false);
    expect(isRpcQuotaError({ message: "429 Too Many Requests" })).toBe(false);
    expect(isRpcQuotaError(null)).toBe(false);
  });

  it("treats generic 429 / 403 as unavailable so send can hop RPCs", () => {
    expect(isRpcUnavailableError({ message: "429 Too Many Requests" })).toBe(true);
    expect(isRpcUnavailableError("403 Forbidden")).toBe(true);
    expect(isRpcUnavailableError("failed to fetch")).toBe(true);
    expect(isRpcUnavailableError("User rejected the request")).toBe(false);
  });

  it("keeps the official collect discriminators and rent floor", () => {
    expect(PUMP_PROGRAM_ID).toBe("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
    expect(COLLECT_CREATOR_FEE_DISCRIMINATOR).toEqual([20, 22, 86, 123, 198, 28, 219, 132]);
    expect(COLLECT_CREATOR_FEE_V2_DISCRIMINATOR).toEqual([207, 17, 138, 242, 4, 34, 19, 56]);
    expect(SYSTEM_ACCOUNT_RENT_LAMPORTS).toBe(890880);
    expect(CLAIM_RPC_URLS.length).toBeGreaterThan(1);
  });
});

describe("jsonRpcWithFallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips a quota-exhausted endpoint and uses the next", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        json: async () => ({ error: { message: "max usage reached" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ jsonrpc: "2.0", id: 1, result: "ok" }),
      }));
    const out = await jsonRpcWithFallback(
      { method: "getLatestBlockhash", params: [] },
      ["https://dead.example/rpc", "https://live.example/rpc"],
    );
    expect(out.result).toBe("ok");
  });
});
