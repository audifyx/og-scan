/**
 * OrbitXCity — Seasons module: billing adapter (defensive).
 *
 * Premium battle-pass entry burns REAL ORBITX, backend-signed, no signing
 * popups — per `web/src/city/BILLING_CONTRACT.md` (#20: every in-game
 * purchase burns).
 *
 * The `@/tokenomics/*` directory does not exist yet, so this module NEVER
 * imports it (that would break the build). Instead the integrator injects a
 * provider implementing `SeasonBillingProvider` (in `../types.ts`, mirroring
 * the contract exactly) into the season UI via props, e.g.:
 *
 *   import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
 *   const billing = useOrbitxBilling();
 *   <SeasonPassPanel billing={billing} />
 *
 * Until then, `useSeasonBilling()` with no provider returns a safe
 * "not connected" state and the premium-entry button renders the
 * auth-required / coming-soon state. The free track and paper-ORBITX claims
 * keep working regardless.
 */

import { useCallback, useMemo, useState } from "react";
import type { SeasonBillingProvider } from "./types";
import { burnPurchase } from "@/tokenomics/burnFlow";

export interface SeasonBilling {
  /** True once the tokenomics provider is injected AND auth-once is complete. */
  ready: boolean;
  /** On-chain ORBITX balance, null when unknown / provider missing. */
  balance: number | null;
  /** True while the entry burn is in flight. */
  busy: boolean;
  /** Provider injected (false = coming-soon / auth-required UI). */
  providerConnected: boolean;
  /** Last error from a failed burn attempt. */
  error: string | null;
  /**
   * Enter the premium track: burns real ORBITX backend-signed.
   * Resolves with the burn signature; the store unlocks the track on it.
   */
  enterPremium: (seasonId: string, amount: number) => Promise<{ signature: string }>;
  /** Kick the dashboard auth-code flow (no-op until provider lands). */
  beginAuth: () => void;
  clearError: () => void;
}

export function useSeasonBilling(provider?: SeasonBillingProvider | null): SeasonBilling {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const beginAuth = useCallback(() => {
    provider?.beginAuth();
  }, [provider]);

  const enterPremium = useCallback(
    async (seasonId: string, amount: number): Promise<{ signature: string }> => {
      if (!provider) throw new Error("Billing provider not connected yet.");
      if (!provider.ready) throw new Error("Wallet auth required — complete the one-time auth first.");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid entry amount.");
      setBusy(true);
      setError(null);
      try {
        // Canonical buy-and-burn — dry-run safe, normalized reason, shared ledger.
        const res = await burnPurchase(provider, {
          amount: Math.floor(amount),
          itemId: seasonId,
          label: `Season pass: ${seasonId}`,
          reason: `city:season-pass:${seasonId}`,
          module: "seasons",
        });
        if (!res.ok) {
          const msg = res.message;
          setError(msg);
          throw new Error(msg);
        }
        return { signature: res.signature };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Burn failed — no ORBITX was spent.";
        setError(msg);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [provider],
  );

  return useMemo(
    () => ({
      ready: provider?.ready === true,
      balance: provider?.balance ?? null,
      busy,
      providerConnected: !!provider,
      error,
      enterPremium,
      beginAuth,
      clearError,
    }),
    [provider, busy, error, enterPremium, beginAuth, clearError],
  );
}
