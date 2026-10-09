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
import { createContext, useContext, type ReactNode } from "react";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";

/** The shared billing value — a superset of every module's provider shape. */
export type SharedBilling = ReturnType<typeof useOrbitxBilling>;

const CityBillingContext = createContext<SharedBilling | null>(null);

export function CityBillingProvider({ children }: { children: ReactNode }) {
  const billing = useOrbitxBilling();
  return <CityBillingContext.Provider value={billing}>{children}</CityBillingContext.Provider>;
}

/** The integrator-injected billing primitive. Null outside the provider. */
export function useSharedBilling(): SharedBilling | null {
  return useContext(CityBillingContext);
}
