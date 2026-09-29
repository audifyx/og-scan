/**
 * Paper CITY ledger for the heists module.
 * Gameplay loot lives here (local ledger, no chain). When the shared
 * `city/economy.ts` ledger lands, the integrator should bridge this class
 * to it (see MODULE.md) — the method names are intentionally economy-shaped.
 */

export interface LedgerEntry {
  id: string;
  ts: number;
  /** +credit / -debit, paper CITY */
  amount: number;
  reason: string;
  balanceAfter: number;
}

const STORAGE_KEY = "oxc_heists_ledger_v1";
const STARTER_GRANT = 250;

function load(): { balance: number; history: LedgerEntry[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { balance: number; history: LedgerEntry[] };
      if (typeof parsed.balance === "number" && Array.isArray(parsed.history)) return parsed;
    }
  } catch {
    /* storage unavailable — run in-memory */
  }
  return { balance: 0, history: [] };
}

function save(balance: number, history: LedgerEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ balance, history: history.slice(-200) }));
  } catch {
    /* ignore */
  }
}

export class PaperLedger {
  private balance: number;
  private history: LedgerEntry[];

  constructor() {
    const { balance, history } = load();
    this.balance = balance;
    this.history = history;
    if (this.history.length === 0 && this.balance === 0) {
      // first run: street cash so the player can case their first job
      this.credit(STARTER_GRANT, "street cash — welcome to OrbitXCity");
    }
  }

  getBalance(): number {
    return Math.round(this.balance);
  }

  credit(amount: number, reason: string): LedgerEntry {
    const entry: LedgerEntry = {
      id: `le_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      amount: Math.round(amount),
      reason,
      balanceAfter: Math.round(this.balance + amount),
    };
    this.balance += amount;
    this.history.push(entry);
    save(this.balance, this.history);
    return entry;
  }

  /** returns false when funds are insufficient (no negative balances) */
  debit(amount: number, reason: string): boolean {
    const amt = Math.round(amount);
    if (amt > this.balance) return false;
    this.credit(-amt, reason);
    return true;
  }

  recent(limit = 25): LedgerEntry[] {
    return this.history.slice(-limit).reverse();
  }
}

/** module singleton — the integrator may replace with the shared economy ledger */
export const heistLedger = new PaperLedger();
