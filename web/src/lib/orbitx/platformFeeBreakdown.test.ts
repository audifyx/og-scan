import { describe, expect, it } from "vitest";
import { PLATFORM_FEE_BPS, PLATFORM_FEE_WALLET } from "@/lib/platformFee";
import { calculatePlatformFee } from "./platformFeeBreakdown";

describe("platform fee routing", () => {
  it("uses the canonical wallet and 1.4 percent", () => {
    expect(PLATFORM_FEE_WALLET).toBe("4qD4UBf9y9wRM51qHYccucAJadB24PRSEku7JWpXV6wu");
    expect(PLATFORM_FEE_BPS).toBe(140);
  });

  it("calculates fee and net atomically with bigint math", () => {
    expect(calculatePlatformFee(100_000n)).toMatchObject({ amountRaw: 1_400n, netRaw: 98_600n, bps: 140, percent: 1.4, recipient: PLATFORM_FEE_WALLET });
  });

  it("rounds down fractional base units", () => {
    expect(calculatePlatformFee(99n).amountRaw).toBe(1n);
  });
});
