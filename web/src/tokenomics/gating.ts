/**
 * Token-gating helpers: hold requirements, pro unlocks, fee discounts.
 * Read-only w.r.t. chain state — they consume useOrbitxBilling().balance.
 */
import { useEffect, useState } from "react";
import { useOrbitxBilling } from "./useOrbitxBilling";
import { feeDiscountBpsFor, ORBITX_PRICES, PRO_UNLOCK_KEY } from "./constants";

export function meetsHold(balance: number | null | undefined, required: number): boolean {
  return Number(balance || 0) >= required;
}

/** #4 — gate for alpha channels / trader rooms. */
export function useAlphaGate(required: number = ORBITX_PRICES.alphaGateHold): {
  allowed: boolean;
  balance: number | null;
  required: number;
} {
  const { balance } = useOrbitxBilling();
  return { allowed: meetsHold(balance, required), balance, required };
}

type ProUnlockReceipt = { expiresAt: number; signature: string };

function readProUnlock(): ProUnlockReceipt | null {
  try {
    const raw = localStorage.getItem(PRO_UNLOCK_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as ProUnlockReceipt;
    return r && r.expiresAt > Date.now() ? r : null;
  } catch {
    return null;
  }
}

export function grantProUnlock(days: number, signature: string): void {
  try {
    localStorage.setItem(
      PRO_UNLOCK_KEY,
      JSON.stringify({
        expiresAt: Date.now() + days * 24 * 60 * 60 * 1000,
        signature,
      } satisfies ProUnlockReceipt),
    );
  } catch {
    /* ignore */
  }
}

/** #3 — pro terminal access (burn-to-unlock, 30 days default). */
export function useProAccess(): {
  hasAccess: boolean;
  receipt: ProUnlockReceipt | null;
  /** Burn the unlock price and grant access. Returns the burn signature. */
  unlock: (spend: (opts: { amount: number; reason: string }) => Promise<{ signature: string }>) => Promise<string>;
} {
  const [receipt, setReceipt] = useState<ProUnlockReceipt | null>(() => readProUnlock());
  useEffect(() => {
    const t = setInterval(() => setReceipt(readProUnlock()), 30_000);
    return () => clearInterval(t);
  }, []);
  const unlock = async (
    spend: (opts: { amount: number; reason: string }) => Promise<{ signature: string }>,
  ): Promise<string> => {
    const { signature } = await spend({
      amount: ORBITX_PRICES.proTerminal,
      reason: "terminal:pro-unlock",
    });
    grantProUnlock(30, signature);
    setReceipt(readProUnlock());
    return signature;
  };
  return { hasAccess: Boolean(receipt), receipt, unlock };
}

/** #10 — platform-wide fee discount from ORBITX held. */
export function useFeeDiscount(): {
  discountBps: number;
  discountPct: number;
  balance: number | null;
  /** Apply the holder discount to a fee quoted in any unit. */
  applyTo: (fee: number) => number;
} {
  const { balance } = useOrbitxBilling();
  const discountBps = feeDiscountBpsFor(balance);
  return {
    discountBps,
    discountPct: discountBps / 100,
    balance,
    applyTo: (fee: number) => fee * (1 - discountBps / 10_000),
  };
}

/** #13 — priority support lane for holders (1k+ ORBITX). */
export function useSupportPriority(): {
  priority: boolean;
  balance: number | null;
} {
  const { balance } = useOrbitxBilling();
  return { priority: meetsHold(balance, 1_000), balance };
}
