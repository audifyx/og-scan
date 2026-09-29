/**
 * Paper-CITY local ledger. Gameplay earnings only — never touches the chain.
 * Per BILLING_CONTRACT.md this merges into the game's economy.ts once the
 * tokenomics primitives land; until then it lives here, self-contained.
 */

export interface LedgerEntry {
  amount: number; // +earn / -spend
  reason: string;
  at: number;
}

export class CityLedger {
  balance = 0;
  readonly log: LedgerEntry[] = [];

  earn(amount: number, reason: string): number {
    const n = Math.max(0, Math.round(amount));
    if (n <= 0) return this.balance;
    this.balance += n;
    this.log.push({ amount: n, reason, at: Date.now() });
    if (this.log.length > 60) this.log.shift();
    return this.balance;
  }

  spend(amount: number, reason: string): boolean {
    const n = Math.max(0, Math.round(amount));
    if (n <= 0 || n > this.balance) return false;
    this.balance -= n;
    this.log.push({ amount: -n, reason, at: Date.now() });
    return true;
  }
}
