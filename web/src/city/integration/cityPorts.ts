/**
 * ORBITXCITY integration — shared ports.
 *
 * Bridges between module port interfaces and the concrete implementations
 * that live in other modules:
 *
 *  - `bountyPaper` / `policePaper`: PaperLedgerPort implemented on top of the
 *    economy module's shared paper-CITY wallet (checklist item 2). One wallet
 *    for the whole city — missions, bounties, bail and fines all draw from it.
 *  - `cityPlayer`: stable player identity for bounty posts.
 *  - `burnWith`: adapts the shared tokenomics billing `spend()` to the
 *    `(amount, reason) => Promise<{signature}>` shape that settlement hooks
 *    (e.g. factions `settleVotes`) expect.
 *  - canonical burn API: re-exported from `@/tokenomics/burnFlow` — THE
 *    single buy-and-burn surface every in-game purchase path calls
 *    (upgrades, real estate, vehicles, vendors, auctions, battle pass,
 *    billboards, bribes, entry fees, casino, sponsors…). It validates,
 *    normalizes the ledger reason, writes the shared burn log, and calls
 *    the real backend-signed ORBITX burn (`useOrbitxBilling().spend()` →
 *    orbitx_app_burn). In dry-run mode (test hook only — never on a
 *    production path) it stops right before the execution call so flows
 *    can be verified end-to-end without a real on-chain transaction.
 */
import { useState } from "react";
import { paperWallet } from "@/city/modules/economy/store/paperWallet";
import { setBillingProvider as setHeistsBillingProvider } from "@/city/modules/heists";
import { injectSocialBilling } from "@/city/modules/social";
import type { SocialBilling } from "@/city/modules/social/types";
import { useSharedBilling, type SharedBilling } from "./CityBillingHost";
import { burnPurchase, isBurnDryRun } from "@/tokenomics/burnFlow";

/** Canonical burn API — re-exported so module seams keep one import path. */
export {
  burnReason,
  burnPurchase,
  normalizeBurnReason,
  getBurnLedger,
  getBurnDryRunLog,
  clearBurnDryRunLog,
  setBurnDryRun,
  isBurnDryRun,
  type BurnBillingLike,
  type BurnLogRecord,
  type BurnPurchaseArgs,
  type BurnPurchaseResult,
} from "@/tokenomics/burnFlow";

/** Bounty module's PaperLedgerPort shape (credit → Promise<void>). */
export interface BountyPaperPort {
  getBalance: () => number;
  debit: (amount: number, label: string) => Promise<boolean>;
  credit: (amount: number, label: string) => Promise<void>;
}

/** Shared paper-CITY ledger port, backed by the economy paper wallet. */
export const bountyPaper: BountyPaperPort = {
  getBalance: () => paperWallet.get().balance,
  debit: async (amount: number, label: string) => {
    try {
      paperWallet.spend(amount, label, "bounty-board");
      return true;
    } catch {
      return false;
    }
  },
  credit: async (amount: number, label: string) => {
    paperWallet.earn(amount, label, "bounty-board");
  },
};

/**
 * Police module's PaperLedgerPort shape (credit → Promise<boolean>).
 * Same underlying wallet; the boolean return satisfies both shapes.
 */
export const policePaper = {
  getBalance: () => paperWallet.get().balance,
  debit: async (amount: number, label: string) => {
    try {
      paperWallet.spend(amount, label, "police");
      return true;
    } catch {
      return false;
    }
  },
  credit: async (amount: number, label: string) => {
    paperWallet.earn(amount, label, "police");
    return true;
  },
};

/** Stable per-browser player identity for bounty posts / claims. */
export function cityPlayer(): { playerId: string; displayName: string } {
  let id: string | null = null;
  let name: string | null = null;
  try {
    id = localStorage.getItem("orbitxcity:player-id");
    name = localStorage.getItem("orbitxcity:player-name");
    if (!id) {
      id = `p:${crypto.randomUUID?.().slice(0, 8) ?? Date.now().toString(36)}`;
      localStorage.setItem("orbitxcity:player-id", id);
    }
    if (!name) {
      name = `Runner-${id.slice(2, 6).toUpperCase()}`;
      localStorage.setItem("orbitxcity:player-name", name);
    }
  } catch {
    id = id ?? `p:${Date.now().toString(36)}`;
    name = name ?? "Runner";
  }
  return { playerId: id, displayName: name };
}

/**
 * Adapt shared billing to the `(amount, reason) => Promise<{signature}>`
 * burn shape used by settlement hooks (factions settleVotes, etc.).
 * Routes through the canonical burnPurchase, so dry-run, reason
 * normalization, and the shared burn ledger apply. Throws when the burn
 * fails — callers gate on `billing.ready` first.
 */
export function burnWith(billing: SharedBilling) {
  return async (amount: number, reason: string) => {
    const r = await burnPurchase(billing, {
      amount,
      itemId: reason,
      label: "Vote settlement",
      reason,
      module: "factions",
    });
    if (!r.ok) throw new Error(r.message);
    return { signature: r.signature };
  };
}

/* ------------------------------------------------------------------ */
/* useBurnPurchase — React hook version of the canonical burn API       */
/* ------------------------------------------------------------------ */

/**
 * React hook version of the canonical burn API. Uses the shared city
 * billing (CityBillingHost) — no module may call useOrbitxBilling
 * directly; this is the single sanctioned path.
 */
export function useBurnPurchase() {
  const billing = useSharedBilling();
  const [burning, setBurning] = useState(false);

  const buy = async (args: BurnPurchaseArgs): Promise<BurnPurchaseResult> => {
    setBurning(true);
    try {
      return await burnPurchase(billing, args);
    } finally {
      setBurning(false);
    }
  };

  return {
    ready: billing?.ready ?? false,
    balance: billing?.balance ?? null,
    burning,
    dryRun: isBurnDryRun(),
    buy,
    beginAuth: () => billing?.beginAuth(),
  };
}

/* ------------------------------------------------------------------ */
/* Module registry wiring — closes the three unwired premium seams     */
/* ------------------------------------------------------------------ */

/**
 * Registers the shared tokenomics billing with the modules that expect
 * integrator-side injection instead of a `billing` prop:
 *
 *  - heists: `setBillingProvider` registry (casino entry, fixer skip, VIP
 *    getaway via `tryBurnPremium`). Was never called — those burns were
 *    silently paper-only.
 *  - social: `injectSocialBilling` factory (nightclub premium via
 *    `useSocialBilling().burnForPremium`). Was never called.
 *  - sports: `window.__orbitxBilling` (sponsor/tournament/dojo/surf/golf
 *    via `premiumBilling`). Was never injected.
 *
 * All three route through the canonical `burnPurchase`, so dry-run,
 * reason-namespacing, and the shared burn ledger apply uniformly.
 * Call from the billing host whenever the shared billing value changes.
 */
/**
 * Derive a ledger itemId from a raw reason for the catch-all adapters
 * (heists/social/sports forward caller-built reasons). `city:heists:entry:casino`
 * → `heists:entry:casino`; legacy `city-heists:casino-entry` works too.
 */
function reasonToItemId(module: string, reason: string): string {
  const m = /^(?:city:|city-)([a-z-]+):(.*)$/.exec(reason.trim());
  return m ? `${module}:${m[2]}` : `${module}:premium`;
}

export function registerModuleBilling(billing: SharedBilling | null): void {
  // Live proxy — reads the latest billing at call time (ready/balance
  // change after the auth-once flow completes).
  let latest: SharedBilling | null = billing;
  const current = () => latest;
  registerModuleBilling.update = (b: SharedBilling | null) => {
    latest = b;
  };

  // ---- heists ----
  setHeistsBillingProvider({
    get ready() {
      return current()?.ready ?? false;
    },
    spend: async (opts: { amount: number; reason: string; ref?: string }) => {
      const b = current();
      const r = await burnPurchase(b, {
        amount: opts.amount,
        itemId: reasonToItemId("heists", opts.reason),
        label: "Heists premium",
        reason: opts.reason,
        ref: opts.ref,
        module: "heists",
      });
      if (!r.ok) throw new Error(r.message);
      return { signature: r.signature };
    },
  });

  // ---- social ----
  const factory = (): SocialBilling => {
    const b = current();
    return {
      premium: true,
      ready: b?.ready ?? false,
      balance: b?.balance ?? null,
      burnForPremium: async (opts: { amount: number; reason: string; ref?: string }) => {
        const bb = current();
        const r = await burnPurchase(bb, {
          amount: opts.amount,
          itemId: reasonToItemId("social", opts.reason),
          label: "Social premium",
          reason: opts.reason,
          ref: opts.ref,
          module: "social",
        });
        if (!r.ok) throw new Error(r.message);
        return { signature: r.signature };
      },
    };
  };
  injectSocialBilling(factory);

  // ---- sports (window injection the sports adapter expects) ----
  try {
    if (typeof window !== "undefined") {
      window.__orbitxBilling = {
        get ready() {
          return current()?.ready ?? false;
        },
        get balance() {
          return current()?.balance ?? null;
        },
        spend: async (opts: { amount: number; reason: string; ref?: string }) => {
          const b = current();
          const r = await burnPurchase(b, {
            amount: opts.amount,
            itemId: reasonToItemId("sports", opts.reason),
            label: "Sports premium",
            reason: opts.reason,
            ref: opts.ref,
            module: "sports",
          });
          if (!r.ok) throw new Error(r.message);
          return { signature: r.signature };
        },
      };
    }
  } catch {
    /* ignore */
  }
}

/**
 * Update the live billing seen by the registered module adapters without
 * re-registering them. Assigned by registerModuleBilling.
 */
registerModuleBilling.update = (_b: SharedBilling | null): void => {
  /* replaced on first register */
};
