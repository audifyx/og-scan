/**
 * Defensive billing adapter for the social module.
 *
 * HARD RULE: this module NEVER imports `@/tokenomics/*` — that directory does
 * not exist yet and any static or dynamic import of it breaks the production
 * build. Instead the integrator INJECTS the real implementation once the
 * tokenomics team ships `useOrbitxBilling` (see web/src/city/BILLING_CONTRACT.md
 * for the expected shape).
 *
 * Until injection happens, every premium surface renders the
 * "coming soon / auth required" fallback and the world runs on paper CITY.
 *
 * Currency rules (locked by the user):
 * - paper CITY  -> gameplay money (local ledger, no chain) — see paperLedger.ts
 * - real ORBITX -> premium (backend-signed burn, no popups)
 * - the game never custodies keys or funds
 */

import type { SocialBilling } from "./types";

const NOT_READY: SocialBilling = {
  premium: false,
  ready: false,
  balance: null,
  burnForPremium: async () => {
    throw new Error(
      "Premium billing not available yet — tokenomics primitives pending. " +
        "See MODULE.md: the integrator injects the real implementation via injectSocialBilling()."
    );
  },
};

let injected: (() => SocialBilling) | null = null;

/**
 * Called ONCE by the integrator after the tokenomics team ships
 * `web/src/tokenomics/useOrbitxBilling`. Example:
 *
 *   import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
 *   import { injectSocialBilling } from "@/city/modules/social";
 *   injectSocialBilling(() => {
 *     const b = useOrbitxBilling();
 *     return {
 *       premium: true, ready: b.ready, balance: b.balance,
 *       burnForPremium: (o) => b.spend({ amount: o.amount, reason: `city-social:${o.reason}`, ref: o.ref ?? crypto.randomUUID() }),
 *     };
 *   });
 */
export function injectSocialBilling(factory: () => SocialBilling): void {
  injected = factory;
}

export function useSocialBilling(): SocialBilling {
  // Note: hooks rules — the factory itself must call hooks unconditionally
  // at the integrator's call site, so we only *invoke* the already-created
  // closure here. In practice the integrator wraps useSocialBilling in their
  // own hook; this indirection keeps this module import-clean.
  if (!injected) return NOT_READY;
  try {
    return injected();
  } catch {
    return NOT_READY;
  }
}

/**
 * Helper for premium UI: renders either the real burn flow or the
 * "auth required" fallback.
 */
export function premiumButtonState(billing: SocialBilling): {
  label: string;
  disabled: boolean;
  hint: string | null;
} {
  if (!billing.premium)
    return {
      label: "Premium — coming soon",
      disabled: true,
      hint: "ORBITX billing is wiring up. Paper CITY works meanwhile.",
    };
  if (!billing.ready)
    return {
      label: "Connect ORBITX",
      disabled: false,
      hint: "One-time dashboard auth unlocks premium.",
    };
  return { label: "Pay with ORBITX (burns)", disabled: false, hint: null };
}
