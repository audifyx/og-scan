/**
 * Character-module billing adapter.
 *
 * Defensive by design: `web/src/tokenomics/*` does NOT exist yet, so we NEVER
 * import it (that would break the production build). Instead the integrator
 * passes a `CharacterBillingProvider` (mirroring
 * web/src/city/BILLING_CONTRACT.md) into character UI via props:
 *
 *     import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling"; // when it lands
 *     const billing = useOrbitxBilling();
 *     <CharacterCreator billing={billing} />
 *
 * Until then, components render the "auth required / coming soon" state and
 * everything else (stats, gym, companion, preview) keeps working.
 *
 * Rules honored: every premium purchase is an ORBITX burn (buy-and-burn per
 * tx), backend-signed, no per-transaction signing popups, no key custody.
 */
import { useMemo, useRef, useState } from "react";
import type { BurnReceipt, CharacterBillingProvider } from "./types";
import { burnPurchase } from "@/tokenomics/burnFlow";

const NOT_CONNECTED: CharacterBillingProvider = {
  ready: false,
  balance: null,
  beginAuth: () => { /* billing primitive not mounted yet — UI shows auth state */ },
  spend: () => Promise.reject(new Error("ORBITX billing is not connected yet.")),
};

/** Resolve the effective provider: injected prop, else the safe stub. */
export function resolveBilling(provider?: CharacterBillingProvider | null): CharacterBillingProvider {
  return provider ?? NOT_CONNECTED;
}

/**
 * Attempt an ORBITX-burn purchase. Returns a receipt on success, or
 * `{ ok: false, code: "not-connected" }` when the billing primitive is
 * not mounted yet. Never throws — callers branch on the result.
 */
export async function purchaseBurn(
  billing: CharacterBillingProvider,
  itemId: string,
  kind: BurnReceipt["kind"],
  amount: number,
): Promise<{ ok: true; receipt: BurnReceipt } | { ok: false; code: "not-connected" | "failed"; message: string }> {
  if (!billing.ready) {
    return { ok: false, code: "not-connected", message: "Connect your OrbitX wallet to burn ORBITX for purchases." };
  }
  try {
    // Canonical buy-and-burn — dry-run safe, normalized reason, shared ledger.
    const res = await burnPurchase(billing, {
      amount,
      itemId: `${kind}:${itemId}`,
      label: `Character ${kind}: ${itemId}`,
      reason: `city:character:${kind}:${itemId}`,
      module: "character",
    });
    if (!res.ok) {
      return {
        ok: false as const,
        code: (res.code === "not-authed" ? "not-connected" : "failed") as "not-connected" | "failed",
        message: res.message,
      };
    }
    return {
      ok: true,
      receipt: { itemId, kind, amount, signature: res.signature, at: Date.now() },
    };
  } catch (err) {
    return { ok: false, code: "failed", message: err instanceof Error ? err.message : "Burn failed." };
  }
}

/** React hook: memoised provider + a tiny "burning" flag for UI spinners. */
export function useBilling(provider?: CharacterBillingProvider | null) {
  const billing = useMemo(() => resolveBilling(provider), [provider]);
  const [burning, setBurning] = useState(false);
  const burnRef = useRef(false);

  const buy = async (itemId: string, kind: BurnReceipt["kind"], amount: number) => {
    if (burnRef.current) return { ok: false as const, code: "busy" as const, message: "Already processing." };
    burnRef.current = true;
    setBurning(true);
    try {
      return await purchaseBurn(billing, itemId, kind, amount);
    } finally {
      burnRef.current = false;
      setBurning(false);
    }
  };

  return { billing, burning, buy };
}
