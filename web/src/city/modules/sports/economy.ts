/**
 * ORBITXCITY sports — paper CITY economy.
 *
 * Gameplay earnings (style points, wagers, catches, prizes) accrue as
 * **paper CITY** — a local ledger, never on-chain. Real ORBITX spending
 * lives behind the premium billing adapter (billing.ts).
 */
import { SportsBus } from "./types";

const LEDGER_KEY = "orbitxcity:sports:paper-ledger:v1";

/** Whole style points -> paper CITY. Tuned so a good session ≈ 20–80 paper. */
export const STYLE_TO_PAPER_RATE = 12;

export interface LedgerEntry {
  at: number;
  delta: number;
  balance: number;
  reason: string;
}

export class PaperLedger {
  private balance = 0;
  private history: LedgerEntry[] = [];
  constructor(private bus: SportsBus) {
    try {
      const raw = localStorage.getItem(LEDGER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { balance?: number; history?: LedgerEntry[] };
        if (typeof parsed.balance === "number") this.balance = Math.max(0, Math.floor(parsed.balance));
        if (Array.isArray(parsed.history)) this.history = parsed.history.slice(-50);
      }
    } catch { /* fresh ledger */ }
  }

  getBalance(): number { return this.balance; }
  getHistory(): LedgerEntry[] { return [...this.history]; }

  /** Award paper. Returns the new balance. */
  earn(amount: number, reason: string): number {
    const delta = Math.max(0, Math.floor(amount));
    if (delta <= 0) return this.balance;
    this.balance += delta;
    this.push(delta, reason);
    this.bus.emit({ type: "paper", delta, balance: this.balance, reason });
    return this.balance;
  }

  /** Convert accumulated style points into paper at the fixed rate. */
  cashStyle(stylePoints: number, label: string): { paper: number; remainder: number } {
    const paper = Math.floor(stylePoints / STYLE_TO_PAPER_RATE);
    const remainder = stylePoints % STYLE_TO_PAPER_RATE;
    if (paper > 0) this.earn(paper, `style cash-in: ${label}`);
    return { paper, remainder };
  }

  /** Spend paper (wagers, entry fees). Returns false when funds are short. */
  spend(amount: number, reason: string): boolean {
    const cost = Math.max(0, Math.floor(amount));
    if (cost <= 0) return true;
    if (this.balance < cost) return false;
    this.balance -= cost;
    this.push(-cost, reason);
    this.bus.emit({ type: "paper", delta: -cost, balance: this.balance, reason });
    return true;
  }

  private push(delta: number, reason: string): void {
    this.history.push({ at: Date.now(), delta, balance: this.balance, reason });
    this.history = this.history.slice(-50);
    try {
      localStorage.setItem(LEDGER_KEY, JSON.stringify({ balance: this.balance, history: this.history }));
    } catch { /* storage full/blocked — ledger still works in memory */ }
  }
}
