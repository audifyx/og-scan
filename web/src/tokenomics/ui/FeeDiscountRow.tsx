/**
 * Fee discount row (#10) — shows the holder's platform-wide fee discount.
 * Drop into any fee breakdown.
 */
import { useFeeDiscount } from "../gating";
import { formatOrbitx } from "../constants";

export function FeeDiscountRow(): JSX.Element {
  const { discountPct, balance } = useFeeDiscount();
  if (discountPct <= 0) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">ORBITX holder discount</span>
        <span className="font-mono text-white/30">hold 1k+ for 5% off</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">
        ORBITX holder discount <span className="text-[10px]">({formatOrbitx(balance ?? 0)} held)</span>
      </span>
      <span className="font-mono text-[hsl(var(--og-lime))]">−{discountPct}%</span>
    </div>
  );
}

/** Plain (unstyled) variant for non-tailwind surfaces. */
export function FeeDiscountNote(): JSX.Element {
  const { discountPct, balance } = useFeeDiscount();
  return (
    <span style={{ fontSize: 12, color: discountPct > 0 ? "#4ade80" : "#9ca3af" }}>
      {discountPct > 0
        ? `⚡ ${discountPct}% holder discount applied (${formatOrbitx(balance ?? 0)} held)`
        : "Hold 1,000+ ORBITX for platform-wide fee discounts"}
    </span>
  );
}

export function discountedFee(fee: number, discountBps: number): number {
  return fee * (1 - discountBps / 10_000);
}
