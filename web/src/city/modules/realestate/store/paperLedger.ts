/**
 * Real estate module — local paper-CITY fallback ledger.
 *
 * The module never imports other city modules, so it cannot use the
 * economy module's shared paper wallet directly. The integrator is expected
 * to inject the shared ledger via `RealEstateHub({ ledger })`
 * (e.g. economy's `paperWallet` wrapped to the `PaperLedger` interface).
 *
 * When no ledger is injected, `createLocalPaperLedger()` keeps the module
 * fully playable standalone with its own localStorage-backed balance.
 * Both shapes implement `PaperLedger` from `../types`.
 */
import type { PaperLedger } from "../types";

const STORAGE_KEY = "orbitxcity:realestate-city:v1";
const MAX_ENTRIES = 200;

interface LedgerEntry {
  at: number;
  amount: number;
  label: string;
  source: string;
}

/** Never-pays ledger: paper features degrade gracefully (no rent, no hotel rooms). */
export const noopLedger: PaperLedger = {
  credit: () => undefined,
  debit: () => {
    throw new Error("Paper CITY is not available — pass a ledger to RealEstateHub");
  },
  balance: () => null,
};

export function createLocalPaperLedger(startingBalance = 100): PaperLedger {
  let balance = startingBalance;
  let log: LedgerEntry[] = [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { balance?: number; log?: LedgerEntry[] };
      if (typeof parsed.balance === "number") balance = parsed.balance;
      if (Array.isArray(parsed.log)) log = parsed.log.slice(0, MAX_ENTRIES);
    }
  } catch {
    /* corrupted storage — start fresh */
  }

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ balance, log: log.slice(0, MAX_ENTRIES) }));
    } catch {
      /* storage blocked — keep in memory */
    }
  };

  return {
    credit: (amount: number, label: string, source: string) => {
      const abs = Math.abs(amount);
      balance = Math.round((balance + abs) * 100) / 100;
      log = [{ at: Date.now(), amount: abs, label, source }, ...log].slice(0, MAX_ENTRIES);
      save();
    },
    debit: (amount: number, label: string, source: string) => {
      const abs = Math.abs(amount);
      if (balance < abs) throw new Error("Insufficient CITY");
      balance = Math.round((balance - abs) * 100) / 100;
      log = [{ at: Date.now(), amount: -abs, label, source }, ...log].slice(0, MAX_ENTRIES);
      save();
    },
    balance: () => balance,
  };
}
