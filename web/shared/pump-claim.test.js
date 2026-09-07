import { describe, expect, it } from "vitest";
import {
  COLLECT_CREATOR_FEE_DISCRIMINATOR,
  PUMP_PROGRAM_ID,
  SYSTEM_ACCOUNT_RENT_LAMPORTS,
  isRpcQuotaError,
} from "./pump-claim.js";

describe("pump-claim quota detection", () => {
  it("matches the Helius / PumpPortal 429 body", () => {
    expect(isRpcQuotaError("max usage reached")).toBe(true);
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

  it("keeps the official collectCreatorFee discriminator and rent floor", () => {
    expect(PUMP_PROGRAM_ID).toBe("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
    expect(COLLECT_CREATOR_FEE_DISCRIMINATOR).toEqual([20, 22, 86, 123, 198, 28, 219, 132]);
    expect(SYSTEM_ACCOUNT_RENT_LAMPORTS).toBe(890880);
  });
});
