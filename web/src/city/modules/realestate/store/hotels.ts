/**
 * Real estate module — hotel chain store.
 *
 * Standard rooms: paper CITY per night. Suites: one-time ORBITX burn
 * purchase, then owned forever — each owned suite pays a daily paper-CITY
 * login bonus with a streak multiplier. "Sleep to save" writes a
 * checkpoint (hotel/home) the integrator can restore on respawn.
 */
import { useSyncExternalStore } from "react";
import type { HotelStay, LoginBonus, PaperLedger, SleepCheckpoint, Suite } from "../types";
import { hotelById, suiteById } from "../data/catalog";
import type { RealEstateBilling } from "../billing";

const STORAGE_KEY = "orbitxcity:realestate-hotels:v1";
const DAY_MS = 86_400_000;

interface HotelBook {
  /** suiteId → { purchasedAt, signature } */
  suites: Record<string, { purchasedAt: number; signature: string }>;
  /** suiteId → { streakDays, lastClaimAt } */
  bonusClaims: Record<string, { streakDays: number; lastClaimAt: number }>;
  currentStay: HotelStay | null;
  checkpoints: SleepCheckpoint[];
}

function load(): HotelBook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as HotelBook;
      if (parsed && typeof parsed === "object") {
        return {
          suites: parsed.suites ?? {},
          bonusClaims: parsed.bonusClaims ?? {},
          currentStay: parsed.currentStay ?? null,
          checkpoints: Array.isArray(parsed.checkpoints) ? parsed.checkpoints.slice(0, 20) : [],
        };
      }
    }
  } catch {
    /* corrupted storage — start fresh */
  }
  return { suites: {}, bonusClaims: {}, currentStay: null, checkpoints: [] };
}

let state: HotelBook = load();
const listeners = new Set<() => void>();

function emit() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage blocked — keep in memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): HotelBook {
  return state;
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export const hotelStore = {
  get: getSnapshot,
  subscribe,

  ownsSuite(suiteId: string): boolean {
    return !!state.suites[suiteId];
  },

  /** Book a standard room — paper CITY per night. */
  checkIn(hotelId: string, nights: number, ledger: PaperLedger): HotelStay {
    const hotel = hotelById(hotelId);
    if (!hotel) throw new Error("Unknown hotel");
    if (!Number.isFinite(nights) || nights < 1) throw new Error("Invalid nights");
    const total = hotel.roomNightCity * Math.ceil(nights);
    ledger.debit(total, `Room — ${hotel.name} (${nights}n)`, "realestate:hotel");
    const stay: HotelStay = { hotelId, roomKind: "standard", checkedInAt: Date.now(), nights: Math.ceil(nights) };
    state = { ...state, currentStay: stay };
    emit();
    return stay;
  },

  /** Buy a suite — one-time ORBITX burn, owned forever. */
  async buySuite(suiteId: string, billing: RealEstateBilling): Promise<Suite> {
    const found = suiteById(suiteId);
    if (!found) throw new Error("Unknown suite");
    if (state.suites[suiteId]) throw new Error("You already own this suite");
    const { signature } = await billing.buyPremium(
      `hotel:suite:${suiteId}`,
      `Suite — ${found.suite.name} @ ${found.hotel.name}`,
      found.suite.priceOrbitx
    );
    state = {
      ...state,
      suites: { ...state.suites, [suiteId]: { purchasedAt: Date.now(), signature } },
      currentStay: { hotelId: found.hotel.id, roomKind: "suite", suiteId, checkedInAt: Date.now(), nights: 1 },
    };
    emit();
    return found.suite;
  },

  /** Sleep to save — writes a checkpoint the game restores on respawn. */
  sleepToSave(note = "Slept through the night"): SleepCheckpoint {
    const stay = state.currentStay;
    const checkpoint: SleepCheckpoint = {
      at: Date.now(),
      hotelId: stay?.hotelId ?? "halcyon",
      roomKind: stay?.roomKind ?? "standard",
      ...(stay?.suiteId ? { suiteId: stay.suiteId } : {}),
      note,
    };
    state = { ...state, checkpoints: [checkpoint, ...state.checkpoints].slice(0, 20) };
    emit();
    return checkpoint;
  },

  lastCheckpoint(): SleepCheckpoint | null {
    return state.checkpoints[0] ?? null;
  },

  /**
   * Claim the daily login bonus for an owned suite.
   * Streak: consecutive calendar days keep building; a missed day resets.
   */
  claimLoginBonus(suiteId: string, ledger: PaperLedger): LoginBonus {
    const found = suiteById(suiteId);
    if (!found) throw new Error("Unknown suite");
    if (!state.suites[suiteId]) throw new Error("Suite not owned");
    const now = Date.now();
    const prev = state.bonusClaims[suiteId];
    if (prev && sameDay(prev.lastClaimAt, now)) throw new Error("Already claimed today");
    let streakDays = 1;
    if (prev && now - prev.lastClaimAt < 2 * DAY_MS && !sameDay(prev.lastClaimAt, now)) {
      streakDays = prev.streakDays + 1;
    }
    const { suite } = found;
    const bonusCity = Math.round(suite.loginBonusCity * (1 + suite.streakBonusPct * (streakDays - 1)));
    ledger.credit(bonusCity, `Login bonus — ${suite.name} (day ${streakDays})`, "realestate:login-bonus");
    state = {
      ...state,
      bonusClaims: { ...state.bonusClaims, [suiteId]: { streakDays, lastClaimAt: now } },
    };
    emit();
    return { claimedAt: now, suiteId, suiteName: suite.name, baseCity: suite.loginBonusCity, streakDays, bonusCity };
  },

  /** Whether the daily bonus is claimable right now. */
  bonusClaimable(suiteId: string, now: number = Date.now()): boolean {
    const prev = state.bonusClaims[suiteId];
    return !!state.suites[suiteId] && (!prev || !sameDay(prev.lastClaimAt, now));
  },
};

export function useHotels() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
