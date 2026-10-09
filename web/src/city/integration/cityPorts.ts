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
 */
import { paperWallet } from "@/city/modules/economy/store/paperWallet";
import type { SharedBilling } from "./CityBillingHost";

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
 * Throws when billing isn't authed — callers gate on `billing.ready`.
 */
export function burnWith(billing: SharedBilling) {
  return (amount: number, reason: string) =>
    billing.spend({ amount, reason, ref: `city:${Date.now().toString(36)}` });
}
