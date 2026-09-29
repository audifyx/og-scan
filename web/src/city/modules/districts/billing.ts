/**
 * Districts module billing adapter.
 *
 * The tokenomics team's `web/src/tokenomics/` primitives are READ-ONLY and
 * may not exist yet — per BILLING_CONTRACT.md the game MUST NOT import
 * `@/tokenomics/*` directly. This file is the defensive seam:
 *
 * - `DistrictsBilling` is the interface every paid districts feature codes against.
 * - `NoopBilling` is the fallback: premium actions render in
 *   "coming soon / auth required" state and the world runs on paper CITY.
 *
 * When tokenomics lands `useOrbitxBilling`, the integrator swaps in a real
 * implementation WITHOUT touching any district feature code.
 */

export interface DistrictsBilling {
  /** Backend burn path ready (auth-once complete, ORBITX spendable). */
  ready: boolean;
  /** Human-readable state for UI: "live" | "auth-required" | "coming-soon". */
  state: "live" | "auth-required" | "coming-soon";
  /** Real-ORBITX balance if known, else null. */
  orbitxBalance: number | null;
  /**
   * Burn real ORBITX for a premium item. MUST only be called when
   * `state === "live"`. Rejects otherwise.
   */
  spendPremium(opts: { amount: number; reason: string; ref?: string }): Promise<{ signature: string }>;
}

/** Fallback used until the tokenomics primitives land. */
export class NoopBilling implements DistrictsBilling {
  readonly ready = false;
  readonly state = "coming-soon" as const;
  readonly orbitxBalance: number | null = null;

  async spendPremium(): Promise<{ signature: string }> {
    throw new Error(
      "Premium billing not available yet: tokenomics useOrbitxBilling is not wired. Premium purchases are disabled until auth lands."
    );
  }
}

/**
 * Build a live adapter from the tokenomics hook shape described in
 * BILLING_CONTRACT.md. The integrator constructs this with the hook result:
 *
 *   const hook = useOrbitxBilling(); // from tokenomics team
 *   const billing = billingFromTokenomicsHook(hook);
 */
export function billingFromTokenomicsHook(hook: {
  ready: boolean;
  balance: number | null;
  spend: (opts: { amount: number; reason: string; ref?: string }) => Promise<{ signature: string }>;
}): DistrictsBilling {
  return {
    ready: hook.ready,
    state: hook.ready ? "live" : "auth-required",
    orbitxBalance: hook.balance,
    spendPremium: (opts) => hook.spend(opts),
  };
}

/** Label shown on premium price tags when billing isn't live yet. */
export function premiumPriceLabel(amount: number, billing: DistrictsBilling): string {
  if (billing.state === "live") return `${amount} ORBITX`;
  if (billing.state === "auth-required") return `${amount} ORBITX · auth required`;
  return `${amount} ORBITX · soon`;
}

/* ------------------------------------------------------------------ */
/* cityPorts burn-adapter wiring (no import cycle)                     */
/* ------------------------------------------------------------------ */

/**
 * Structural shape of the canonical burn API in
 * `web/src/city/integration/cityPorts.ts` (`burnPurchase`). Declared
 * structurally (not imported) because integration imports this module —
 * importing cityPorts here would create a module cycle.
 */
export interface BurnPurchaseLike {
  (args: {
    amount: number;
    itemId: string;
    label?: string;
    reason: string;
    ref?: string;
    module?: string;
  }): Promise<{ ok: boolean; signature?: string; message?: string }>;
}

/**
 * Build a LIVE DistrictsBilling backed by the canonical cityPorts burn flow.
 * The integrator wires it once (it owns the SharedBilling from
 * CityBillingHost):
 *
 *   import { burnPurchase, burnReason } from "@/city/integration/cityPorts";
 *   import { billingFromBurnPurchase } from "@/city/modules/districts";
 *   const billing = useSharedBilling();
 *   const districtsBilling = billingFromBurnPurchase({
 *     burn: (a) => burnPurchase(billing, { ...a, module: "districts" }),
 *     isReady: () => billing?.ready ?? false,
 *     getBalance: () => billing?.balance ?? null,
 *   });
 *
 * Every premium district purchase (bank vault, hypercar trim, shop
 * cosmetics, hospital expedited wipe, city-hall premium firm) then routes
 * through `burnPurchase`: namespaced reasons, shared burn ledger, dry-run
 * support, backend-signed ORBITX burn. No district feature code changes.
 */
export function billingFromBurnPurchase(deps: {
  burn: BurnPurchaseLike;
  isReady: () => boolean;
  getBalance: () => number | null;
}): DistrictsBilling {
  return {
    get ready() { return deps.isReady(); },
    get state() { return deps.isReady() ? "live" : "auth-required"; },
    get orbitxBalance() { return deps.getBalance(); },
    async spendPremium(opts: { amount: number; reason: string; ref?: string }) {
      if (!deps.isReady()) {
        throw new Error("ORBITX billing isn't authed yet — run the one-time dashboard link first.");
      }
      const r = await deps.burn({
        amount: Math.floor(opts.amount),
        itemId: opts.reason,
        reason: opts.reason,
        ref: opts.ref,
        module: "districts",
      });
      if (!r.ok || !r.signature) {
        throw new Error(r.message ?? "Burn failed — nothing was charged.");
      }
      return { signature: r.signature };
    },
  };
}
