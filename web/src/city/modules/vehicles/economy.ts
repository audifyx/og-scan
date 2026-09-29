/**
 * OrbitXCity — Vehicles module: burn/billing bridge.
 *
 * Follows the same pattern as the racing module: until
 * `@/tokenomics/useOrbitxBilling` exists, the integrator injects
 * `createNullBurnProvider()` and the module runs paper-only, recording every
 * premium action as "pending billing" so nothing silently pretends to burn.
 *
 * Once the tokenomics primitive lands, the page shell does:
 * ```ts
 * import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
 * import { adaptBillingToBurnProvider, createNullBurnProvider } from "@/city/modules/vehicles";
 * const billing = useOrbitxBilling();
 * const burn = billing?.ready ? adaptBillingToBurnProvider(billing) : createNullBurnProvider();
 * ```
 * Never imports `@/tokenomics/*` — would break the build.
 */
import type { BurnReceipt } from "./types";

export interface BurnOpts {
  amount: number; // whole ORBITX tokens
  reason: string;
  ref?: string;
}

/** Structural mirror of the contract — no tokenomics import. */
export interface BillingLike {
  ready: boolean;
  balance: number | null;
  spend: (opts: { amount: number; reason: string; ref?: string }) => Promise<{ signature: string }>;
  beginAuth: () => void;
}

export interface IBurnProvider {
  /** Backend-signed burn; resolves a receipt. */
  burn: (opts: BurnOpts) => Promise<BurnReceipt>;
  /** False while billing is not connected (paper-only mode). */
  readonly live: boolean;
  /** All burns recorded locally (for audit / "pending billing" UI). */
  readonly log: BurnReceipt[];
}

/** Paper-only provider: used until the tokenomics primitive lands. */
export function createNullBurnProvider(): IBurnProvider {
  const log: BurnReceipt[] = [];
  return {
    live: false,
    log,
    burn: async (opts) => {
      const r: BurnReceipt = {
        ok: true,
        amount: opts.amount,
        reason: opts.reason,
        paperOnly: true,
      };
      log.push(r);
      return r;
    },
  };
}

/** Maps the tokenomics hook shape onto the module's burn provider. */
export function adaptBillingToBurnProvider(billing: BillingLike): IBurnProvider {
  const log: BurnReceipt[] = [];
  return {
    live: true,
    log,
    burn: async (opts) => {
      if (!billing.ready) throw new Error("Wallet auth required — run the dashboard auth flow first");
      const { signature } = await billing.spend({
        amount: opts.amount,
        reason: opts.reason,
        ref: opts.ref ?? `veh-${Date.now()}`,
      });
      const r: BurnReceipt = { ok: true, signature, amount: opts.amount, reason: opts.reason, paperOnly: false };
      log.push(r);
      return r;
    },
  };
}

/** Unique-ish ref for a premium action (idempotency). */
export function burnRef(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
