import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * OrbitX City — in-game credit economy (Worker 3).
 *
 * Persisted to localStorage under key `oxc-economy`. Mission payouts credit
 * here; police busts / respawns debit here. These are GAME credits only —
 * never on-chain, never real ORBITX.
 */

export interface CreditEvent {
  at: number;
  delta: number;
  reason: string;
  balance: number;
}

const MAX_EVENTS = 40;

interface EconomyState {
  credits: number;
  events: CreditEvent[];
  addCredits: (n: number, reason: string) => void;
  /** Returns false when funds are insufficient. */
  spendCredits: (n: number, reason: string) => boolean;
}

const STARTING_CREDITS = 500;

export const useEconomyStore = create<EconomyState>()(
  persist(
    (set, get) => ({
      credits: STARTING_CREDITS,
      events: [],

      addCredits: (n: number, reason: string) => {
        if (!Number.isFinite(n) || n <= 0) return;
        const amount = Math.round(n);
        const credits = get().credits + amount;
        const events: CreditEvent[] = [
          { at: Date.now(), delta: amount, reason, balance: credits },
          ...get().events,
        ].slice(0, MAX_EVENTS);
        set({ credits, events });
      },

      spendCredits: (n: number, reason: string) => {
        if (!Number.isFinite(n) || n <= 0) return false;
        const amount = Math.round(n);
        const s = get();
        if (s.credits < amount) return false;
        const credits = s.credits - amount;
        const events: CreditEvent[] = [
          { at: Date.now(), delta: -amount, reason, balance: credits },
          ...s.events,
        ].slice(0, MAX_EVENTS);
        set({ credits, events });
        return true;
      },
    }),
    {
      name: "oxc-economy",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ credits: s.credits, events: s.events }),
    },
  ),
);
