/**
 * Paper CITY wallet — external store so every economy panel / minigame shares
 * one wallet without cross-module context plumbing. Persisted to localStorage.
 */
import { useSyncExternalStore } from "react";
import type { CityLedgerEntry, PaperWalletState } from "../types";

const STORAGE_KEY = "orbitxcity:paper-wallet:v1";
const STARTING_BALANCE = 100;
const MAX_LEDGER = 200;

function load(): PaperWalletState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PaperWalletState;
      if (typeof parsed.balance === "number" && Array.isArray(parsed.ledger)) {
        return { balance: parsed.balance, ledger: parsed.ledger.slice(0, MAX_LEDGER) };
      }
    }
  } catch {
    /* corrupted storage — start fresh */
  }
  return {
    balance: STARTING_BALANCE,
    ledger: [
      {
        id: crypto.randomUUID(),
        at: Date.now(),
        kind: "adjust",
        amount: STARTING_BALANCE,
        label: "Welcome bonus — 100 CITY on arrival",
        source: "economy:welcome",
      },
    ],
  };
}

let state: PaperWalletState = load();
const listeners = new Set<() => void>();

function emit() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full/blocked — keep in-memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PaperWalletState {
  return state;
}

function record(entry: Omit<CityLedgerEntry, "id" | "at"> & { at?: number }) {
  const full: CityLedgerEntry = {
    id: crypto.randomUUID(),
    at: entry.at ?? Date.now(),
    kind: entry.kind,
    amount: entry.amount,
    label: entry.label,
    source: entry.source,
    ...(entry.burnSignature ? { burnSignature: entry.burnSignature } : {}),
  };
  state = {
    balance: Math.max(0, Math.round((state.balance + entry.amount) * 100) / 100),
    ledger: [full, ...state.ledger].slice(0, MAX_LEDGER),
  };
  emit();
  return full;
}

export const paperWallet = {
  /** Current snapshot. */
  get: getSnapshot,
  /** Credit paper CITY. Returns the ledger entry. */
  earn: (amount: number, label: string, source: string, extra?: { burnSignature?: string }) =>
    record({ kind: "earn", amount: Math.abs(amount), label, source, ...extra }),
  /** Debit paper CITY. Throws if insufficient. */
  spend: (amount: number, label: string, source: string) => {
    const abs = Math.abs(amount);
    if (state.balance < abs) throw new Error("Insufficient CITY");
    return record({ kind: "spend", amount: -abs, label, source });
  },
  /** Wager stake is debited immediately; settle with win/loss. */
  placeWager: (amount: number, label: string, source: string) => {
    const abs = Math.abs(amount);
    if (state.balance < abs) throw new Error("Insufficient CITY");
    return record({ kind: "wager", amount: -abs, label, source });
  },
  win: (amount: number, label: string, source: string) =>
    record({ kind: "win", amount: Math.abs(amount), label, source }),
  lose: (amount: number, label: string, source: string) =>
    record({ kind: "loss", amount: -Math.abs(amount), label, source }),
  adjust: (amount: number, label: string, source: string, extra?: { burnSignature?: string }) =>
    record({ kind: "adjust", amount, label, source, ...extra }),
  subscribe,
};

/** React hook over the paper wallet store. */
export function usePaperWallet() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { wallet: snapshot, paperWallet };
}

/** Compact "1,234" / "12.5K" formatting for HUD numbers. */
export function formatCity(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  if (abs >= 100) return `${sign}${Math.round(abs).toLocaleString("en-US")}`;
  return `${sign}${(Math.round(abs * 100) / 100).toLocaleString("en-US")}`;
}

export function formatTime(at: number): string {
  return new Date(at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
