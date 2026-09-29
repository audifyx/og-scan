/**
 * Real estate billing adapter — defensive wrapper around the tokenomics
 * billing primitive (`web/src/tokenomics/useOrbitxBilling`, see
 * `web/src/city/BILLING_CONTRACT.md`).
 *
 * The `@/tokenomics/*` directory does not exist yet, so this module NEVER
 * imports it (that would break the build). Instead the integrator injects a
 * provider implementing `OrbitxBillingProvider` (in `../types.ts`, mirroring
 * the contract exactly) into the real estate UI via props, e.g.:
 *
 *   import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
 *   const billing = useOrbitxBilling();
 *   <RealEstateHub billing={billing} />
 *
 * Until then, `useRealEstateBilling()` with no provider returns a safe
 * "not connected" state and premium UI renders the auth-required state.
 * Paper CITY flows keep working regardless.
 *
 * Rules enforced here: every premium spend burns (buy-and-burn per tx —
 * deed purchases, tier upgrades, auction bids INCLUDING losing bids,
 * suite purchases, premium furniture), no per-transaction signing popups
 * (backend-signed), no key custody.
 */
import { useCallback, useMemo, useState } from "react";
import type { BurnRecord, OrbitxBillingProvider } from "./types";

/** Shared with the economy module's bank so burn history is unified. */
const BURN_LOG_KEY = "orbitxcity:burn-log:v1";
const MAX_BURNS = 100;

function loadBurns(): BurnRecord[] {
  try {
    const raw = localStorage.getItem(BURN_LOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_BURNS);
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveBurns(burns: BurnRecord[]) {
  try {
    localStorage.setItem(BURN_LOG_KEY, JSON.stringify(burns.slice(0, MAX_BURNS)));
  } catch {
    /* ignore */
  }
}

export interface RealEstateBilling {
  /** True once the tokenomics provider is injected AND auth-once is complete. */
  ready: boolean;
  /** On-chain ORBITX balance, null when unknown / provider missing. */
  balance: number | null;
  /** True while a burn transaction is in flight. */
  busy: boolean;
  /** Provider injected (false = auth-required / coming-soon UI). */
  providerConnected: boolean;
  /** Spend real ORBITX with auto-burn. Returns the burn signature. */
  buyPremium: (itemId: string, itemLabel: string, amount: number) => Promise<{ signature: string }>;
  /** Kick the dashboard auth-code flow (no-op until provider lands). */
  beginAuth: () => void;
  /** Local history of burn transactions (shared with the economy bank). */
  burns: BurnRecord[];
  /** Refresh burn history from storage. */
  refreshBurns: () => void;
}

export function useRealEstateBilling(provider?: OrbitxBillingProvider): RealEstateBilling {
  const [busy, setBusy] = useState(false);
  const [burns, setBurns] = useState<BurnRecord[]>(() => loadBurns());

  const refreshBurns = useCallback(() => setBurns(loadBurns()), []);

  const buyPremium = useCallback(
    async (itemId: string, itemLabel: string, amount: number) => {
      if (!provider) throw new Error("Billing not connected yet");
      if (!provider.ready) throw new Error("Wallet auth required");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
      const whole = Math.ceil(amount); // ORBITX spends are whole tokens
      setBusy(true);
      try {
        const ref = crypto.randomUUID();
        const { signature } = await provider.spend({
          amount: whole,
          reason: `city-realestate:${itemId}`,
          ref,
        });
        const record: BurnRecord = {
          at: Date.now(),
          itemId,
          itemLabel,
          amount: whole,
          signature,
          ref,
        };
        saveBurns([record, ...loadBurns()]);
        setBurns(loadBurns());
        return { signature };
      } finally {
        setBusy(false);
      }
    },
    [provider]
  );

  const beginAuth = useCallback(() => {
    provider?.beginAuth();
  }, [provider]);

  return useMemo(
    () => ({
      ready: provider?.ready ?? false,
      balance: provider?.balance ?? null,
      busy,
      providerConnected: !!provider,
      buyPremium,
      beginAuth,
      burns,
      refreshBurns,
    }),
    [provider, busy, buyPremium, beginAuth, burns, refreshBurns]
  );
}
