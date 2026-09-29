/**
 * Premium billing seam — real ORBITX burns for premium heist purchases
 * (casino entry fee, elite fixer skips, etc.).
 *
 * The tokenomics team's `web/src/tokenomics/*` primitives do NOT exist yet,
 * so this module NEVER statically imports them (that would break the build).
 * Instead the integrator registers the real provider once it lands:
 *
 *   import { setBillingProvider } from "@/city/modules/heists";
 *   setBillingProvider({ ready: billing.ready, spend: (o) => billing.spend(o) });
 *
 * Until then every premium purchase resolves `{ ok: false, code: "unavailable" }`
 * and the UI renders the premium-locked state. Paper CITY gameplay is never
 * gated on billing.
 */

export interface PremiumBurnOpts {
  /** whole ORBITX */
  amount: number;
  /** ledger reason, e.g. "city-heists:casino-entry" */
  reason: string;
  sku: string;
  ref?: string;
}

export type PremiumBurnResult =
  | { ok: true; signature: string }
  | { ok: false; code: "unavailable" | "failed"; message: string };

interface BillingProvider {
  ready: boolean;
  spend: (opts: { amount: number; reason: string; ref?: string }) => Promise<{ signature: string }>;
}

let provider: BillingProvider | null = null;

export function setBillingProvider(p: BillingProvider | null): void {
  provider = p;
}

export function isBillingReady(): boolean {
  return !!provider && provider.ready;
}

export async function tryBurnPremium(opts: PremiumBurnOpts): Promise<PremiumBurnResult> {
  if (!provider || !provider.ready) {
    return {
      ok: false,
      code: "unavailable",
      message: "Premium billing is not connected yet — ORBITX auth required.",
    };
  }
  try {
    const { signature } = await provider.spend({
      amount: opts.amount,
      reason: opts.reason,
      ref: opts.ref ?? `${opts.sku}:${Date.now()}`,
    });
    return { ok: true, signature };
  } catch (err) {
    return {
      ok: false,
      code: "failed",
      message: err instanceof Error ? err.message : "Burn failed",
    };
  }
}

/** premium SKUs owned by the heists module (all burns, per platform law #20) */
export const PREMIUM_SKUS = {
  casinoEntry: "heist:casino-entry",
  fixerSkip: "heist:fixer-skip",
  vipGetaway: "heist:vip-getaway",
} as const;
