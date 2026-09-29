/**
 * Paper-CITY wallet + per-job XP + buffs + toast bus.
 * Pure TS singleton, persisted to localStorage. No chain, no custody —
 * gameplay money only. Premium (real ORBITX) is NOT handled here; see
 * BILLING_CONTRACT.md and MODULE.md (tokenomics primitives not landed).
 */
import type { Buff, JobId, Toast } from "./types";

const WALLET_KEY = "orbitxcity.jobs.wallet.v1";

export interface WalletSnapshot {
  /** paper CITY balance (gameplay earnings) */
  city: number;
  /** lifetime earned, for stats */
  lifetimeEarned: number;
  /** xp per job id */
  xp: Record<string, number>;
  buffs: Buff[];
}

type Listener = () => void;
type ToastListener = (t: Toast) => void;

const listeners = new Set<Listener>();
const toastListeners = new Set<ToastListener>();
let toastId = 1;

function load(): WalletSnapshot {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<WalletSnapshot>;
      return {
        city: typeof s.city === "number" ? s.city : 0,
        lifetimeEarned: typeof s.lifetimeEarned === "number" ? s.lifetimeEarned : 0,
        xp: s.xp && typeof s.xp === "object" ? (s.xp as Record<string, number>) : {},
        buffs: Array.isArray(s.buffs) ? (s.buffs as Buff[]).filter((b) => b.until > Date.now()) : [],
      };
    }
  } catch {
    /* fresh wallet */
  }
  return { city: 0, lifetimeEarned: 0, xp: {}, buffs: [] };
}

let state: WalletSnapshot = load();

function save() {
  try {
    localStorage.setItem(WALLET_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

function emit() {
  save();
  listeners.forEach((l) => l());
}

/** Active (non-expired) buffs, pruned lazily. */
function activeBuffs(now = Date.now()): Buff[] {
  const live = state.buffs.filter((b) => b.until > now);
  if (live.length !== state.buffs.length) {
    state.buffs = live;
    save();
  }
  return live;
}

export function getPayMult(): number {
  return activeBuffs().reduce((m, b) => m * b.payMult, 1);
}
export function getXpMult(): number {
  return activeBuffs().reduce((m, b) => m * b.xpMult, 1);
}
export function getBuffs(): Buff[] {
  return activeBuffs();
}
export function addBuff(buff: Omit<Buff, "until"> & { minutes: number }): void {
  state.buffs = state.buffs.filter((b) => b.id !== buff.id);
  state.buffs.push({ ...buff, until: Date.now() + buff.minutes * 60_000 });
  emit();
  pushToast(`${buff.label} active!`, "info");
}

/** Level for a job: 1 + 1 per 200 xp. Payout scale 1 + 10%/level above 1. */
export function jobLevel(id: JobId): number {
  return 1 + Math.floor((state.xp[id] ?? 0) / 200);
}
export function jobXp(id: JobId): number {
  return state.xp[id] ?? 0;
}
export function levelPayScale(id: JobId): number {
  return 1 + 0.1 * (jobLevel(id) - 1);
}

export function addXp(id: JobId, n: number): { leveled: boolean; level: number } {
  const before = jobLevel(id);
  state.xp[id] = (state.xp[id] ?? 0) + Math.round(n * getXpMult());
  const after = jobLevel(id);
  emit();
  return { leveled: after > before, level: after };
}

export function getCity(): number {
  return state.city;
}
export function getSnapshot(): WalletSnapshot {
  return { ...state, buffs: activeBuffs(), xp: { ...state.xp } };
}

/** Earn paper CITY. Applies active pay buffs. Returns amount actually credited. */
export function earnCity(base: number, reason: string, jobId?: JobId): number {
  const amt = Math.max(0, Math.round(base * getPayMult()));
  state.city += amt;
  state.lifetimeEarned += amt;
  emit();
  pushToast(`+$${amt.toLocaleString()} CITY — ${reason}`, "cash");
  return amt;
}

/** Spend paper CITY. Returns false if insufficient. */
export function spendCity(amount: number, reason: string): boolean {
  const amt = Math.round(amount);
  if (state.city < amt) {
    pushToast(`Need $${amt.toLocaleString()} CITY (${reason})`, "warn");
    return false;
  }
  state.city -= amt;
  emit();
  return true;
}

/** Dev/testing helper + integrator hook: grant paper funds. */
export function grantCity(amount: number): void {
  state.city += Math.round(amount);
  emit();
}

export function pushToast(text: string, kind: Toast["kind"] = "info"): void {
  const t: Toast = { id: toastId++, text, kind };
  toastListeners.forEach((l) => l(t));
}

export function subscribeWallet(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function subscribeToasts(fn: ToastListener): () => void {
  toastListeners.add(fn);
  return () => {
    toastListeners.delete(fn);
  };
}

export function fmtCity(n: number): string {
  return `$${Math.round(n).toLocaleString()} CITY`;
}
