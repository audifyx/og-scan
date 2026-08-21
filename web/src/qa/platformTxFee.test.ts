import { describe, expect, it } from "vitest";
import {
  applyPlatformFeeToSolAmount,
  computePlatformTxFee,
  PLATFORM_TX_FEE_CAP_USD,
  PLATFORM_TX_FEE_BPS,
} from "../../shared/platform-tx-fee.js";

describe("OrbitX platform transaction fee", () => {
  it("charges 1.2% and caps at $10", () => {
    expect(PLATFORM_TX_FEE_BPS).toBe(120);
    expect(PLATFORM_TX_FEE_CAP_USD).toBe(10);
    expect(computePlatformTxFee({ valueUsd: 50 }).feeUsd).toBeCloseTo(0.6, 6);
    expect(computePlatformTxFee({ valueUsd: 100 }).feeUsd).toBeCloseTo(1.2, 6);
    expect(computePlatformTxFee({ valueUsd: 500 }).feeUsd).toBeCloseTo(6, 6);
    const k = computePlatformTxFee({ valueUsd: 1000 });
    expect(k.feeUsd).toBe(10);
    expect(k.capApplied).toBe(true);
    const big = computePlatformTxFee({ valueUsd: 10_000 });
    expect(big.feeUsd).toBe(10);
    expect(big.capApplied).toBe(true);
    expect(big.feeBpsEffective).toBe(10); // $10 / $10000
  });

  it("converts a USD cap into SOL lamports at the given spot", () => {
    const fee = computePlatformTxFee({ valueSol: 10, solUsd: 150 });
    // 10 SOL * $150 = $1500 → cap $10 → 10/150 SOL
    expect(fee.valueUsd).toBe(1500);
    expect(fee.capApplied).toBe(true);
    expect(fee.feeUsd).toBe(10);
    expect(fee.feeSol).toBeCloseTo(10 / 150, 8);
    const split = applyPlatformFeeToSolAmount(10, fee);
    expect(split.tradeSol + fee.feeSol).toBeCloseTo(10, 6);
  });
});
