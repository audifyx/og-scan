/**
 * OrbitX City — job payout treasury.
 *
 * ORBITX job rewards are paid from a city treasury wallet that the OWNER funds.
 * The client NEVER mints or fabricates ORBITX: until the treasury is funded,
 * every ORBITX reward line honestly reads "paused — treasury empty".
 *
 * Payout flow (once funded):
 *   1. completeJob() in Jobs.ts queues a payout request in localStorage
 *      (oxc-payouts-pending) — the client cannot sign for the treasury.
 *   2. The owner (or a treasury operator script holding the treasury key)
 *      sweeps the queue and sends real ORBITX to the recorded wallets.
 *   3. JobBoard shows queued rewards as "pending — treasury sweep".
 *
 * Configuring the treasury:
 *   - VITE_CITY_TREASURY env var at build time, or
 *   - setTreasuryAddress(addr) at runtime (persists to localStorage).
 * See web/src/city/TREASURY.md for funding instructions.
 */

const LS_KEY = "oxc-treasury";
export const PAYOUT_QUEUE_KEY = "oxc-payouts-pending";

/** Basic sanity: base58-ish, 32–44 chars. */
export function isPlausibleAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

export function getTreasuryAddress(): string | null {
  try {
    const ls = localStorage.getItem(LS_KEY);
    if (ls && isPlausibleAddress(ls)) return ls;
  } catch { /* noop */ }
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_CITY_TREASURY;
    if (env && isPlausibleAddress(env)) return env;
  } catch { /* noop */ }
  return null;
}

export function setTreasuryAddress(addr: string | null): void {
  try {
    if (addr && isPlausibleAddress(addr)) localStorage.setItem(LS_KEY, addr);
    else localStorage.removeItem(LS_KEY);
  } catch { /* noop */ }
}

export interface TreasuryStatus {
  address: string | null;
  /** true once an address is configured (balance verified separately) */
  funded: boolean;
  /** honest one-line label for UI */
  label: string;
}

export function getTreasuryStatus(): TreasuryStatus {
  const address = getTreasuryAddress();
  if (!address) return { address: null, funded: false, label: "paused — treasury empty" };
  return { address, funded: true, label: "funded" };
}

/** Short display form of the treasury address. */
export function shortTreasury(addr: string | null): string {
  if (!addr) return "—";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export interface PendingPayout {
  wallet: string | null;
  jobId: string;
  amountOrbitx: number;
  at: number;
}

/** Queue an ORBITX reward for the owner's treasury sweep. Never sends on-chain. */
export function queuePayout(wallet: string | null, jobId: string, amountOrbitx: number): void {
  try {
    const raw = localStorage.getItem(PAYOUT_QUEUE_KEY);
    const q: PendingPayout[] = raw ? (JSON.parse(raw) as PendingPayout[]) : [];
    q.push({ wallet, jobId, amountOrbitx, at: Date.now() });
    localStorage.setItem(PAYOUT_QUEUE_KEY, JSON.stringify(q.slice(-200)));
  } catch { /* noop */ }
}

export function loadPayoutQueue(): PendingPayout[] {
  try {
    const raw = localStorage.getItem(PAYOUT_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingPayout[]) : [];
  } catch {
    return [];
  }
}

/** UI label for the ORBITX reward line of a job. Honest by default. */
export function orbitxRewardLabel(amount: number): string {
  const st = getTreasuryStatus();
  if (!st.funded) return `+${amount} ORBITX · ⏸ paused — treasury empty`;
  return `+${amount} ORBITX · queued for treasury sweep`;
}
