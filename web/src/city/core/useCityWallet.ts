/**
 * useCityWallet — minimal adapter exposing { address, connected } for
 * insane-mode UI (ArcadeGame, RamenOrder, quests).
 * Wraps the canonical useOrbitxBilling hook.
 */
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";

export function useCityWallet(): {
  address: string | null;
  connected: boolean;
} {
  const billing = useOrbitxBilling();
  return {
    address: billing.wallet,
    connected: billing.ready && billing.wallet != null,
  };
}
