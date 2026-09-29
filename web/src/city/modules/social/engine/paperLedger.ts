/**
 * Paper CITY ledger — gameplay money only.
 * Local ledger (localStorage), no chain, no real value.
 * The integrator owns the canonical balance; this is a per-module helper so
 * social UI can earn/spend paper CITY without depending on another module.
 */

const KEY = "orbitxcity.social.paper-ledger.v1";

export interface PaperTx {
  id: string;
  delta: number; // +earn, -spend
  reason: string;
  ts: number;
}

interface LedgerState {
  balance: number;
  txs: PaperTx[];
}

function load(): LedgerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as LedgerState;
      if (typeof s.balance === "number" && Array.isArray(s.txs)) return s;
    }
  } catch {
    /* fresh ledger */
  }
  return { balance: 250, txs: [] }; // starter paper
}

function save(s: LedgerState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, txs: s.txs.slice(-200) }));
  } catch {
    /* storage full/blocked — ledger stays in memory */
  }
}

let state = load();
const listeners = new Set<(balance: number) => void>();

function notify() {
  listeners.forEach((fn) => fn(state.balance));
}

export const paperLedger = {
  get balance() {
    return state.balance;
  },
  subscribe(fn: (balance: number) => void): () => void {
    listeners.add(fn);
    fn(state.balance);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Earn paper CITY. Returns false if amount invalid. */
  earn(amount: number, reason: string): boolean {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    state = {
      balance: state.balance + Math.floor(amount),
      txs: [...state.txs, { id: crypto.randomUUID(), delta: Math.floor(amount), reason, ts: Date.now() }],
    };
    save(state);
    notify();
    return true;
  },
  /** Spend paper CITY. Returns false when funds are insufficient. */
  spend(amount: number, reason: string): boolean {
    const n = Math.floor(amount);
    if (!Number.isFinite(n) || n <= 0) return false;
    if (state.balance < n) return false;
    state = {
      balance: state.balance - n,
      txs: [...state.txs, { id: crypto.randomUUID(), delta: -n, reason, ts: Date.now() }],
    };
    save(state);
    notify();
    return true;
  },
  history(): PaperTx[] {
    return [...state.txs].reverse();
  },
};
