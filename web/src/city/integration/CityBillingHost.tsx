/**
 * ORBITXCITY integration — shared billing host.
 *
 * Calls the tokenomics `useOrbitxBilling()` primitive ONCE per page mount and
 * exposes it to every city module through context. Each module documents a
 * `billing` provider slot (prop-injection, mirroring BILLING_CONTRACT.md);
 * the apps shell passes this shared value into those slots.
 *
 * The game never custodies keys or funds: every spend is a backend-signed
 * ORBITX burn via the existing in-app wallet infra (auth once up front via
 * the dashboard auth-code flow, no per-transaction signing popups).
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { registerModuleBilling } from "./cityPorts";

/** The shared billing value — a superset of every module's provider shape. */
export type SharedBilling = ReturnType<typeof useOrbitxBilling>;

const CityBillingContext = createContext<SharedBilling | null>(null);

export function CityBillingProvider({ children }: { children: ReactNode }) {
  const billing = useOrbitxBilling();

  // Close the three registry-injection premium seams (heists, social,
  // sports) — see registerModuleBilling in cityPorts.ts. Registers once,
  // then keeps the adapters pointed at the latest billing value as the
  // auth-once flow completes and balances refresh.
  const registeredRef = useRef(false);
  useEffect(() => {
    if (!registeredRef.current) {
      registeredRef.current = true;
      registerModuleBilling(billing);
    } else {
      registerModuleBilling.update(billing);
    }
  }, [billing]);

  return <CityBillingContext.Provider value={billing}>{children}</CityBillingContext.Provider>;
}

/** The integrator-injected billing primitive. Null outside the provider. */
export function useSharedBilling(): SharedBilling | null {
  return useContext(CityBillingContext);
}
