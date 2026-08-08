import { PLATFORM_FEE_BPS, PLATFORM_FEE_PERCENT, PLATFORM_FEE_WALLET } from "@/lib/platformFee";

export interface PlatformFeeBreakdown {
  bps: number;
  percent: number;
  amountRaw: bigint;
  netRaw: bigint;
  recipient: string;
}

/** Calculate the disclosed platform fee before a transaction is signed. */
export function calculatePlatformFee(amountRaw: bigint | number, bps = PLATFORM_FEE_BPS): PlatformFeeBreakdown {
  const gross = typeof amountRaw === "bigint" ? amountRaw : BigInt(Math.max(0, Math.floor(amountRaw)));
  const safeBps = Math.max(0, Math.min(10_000, Math.round(bps)));
  const fee = (gross * BigInt(safeBps)) / 10_000n;
  return { bps: safeBps, percent: safeBps / 100, amountRaw: fee, netRaw: gross - fee, recipient: PLATFORM_FEE_WALLET };
}

export const platformFeeLabel = `${PLATFORM_FEE_PERCENT.toFixed(1)}% platform fee`;
export const platformFeeRecipient = PLATFORM_FEE_WALLET;
