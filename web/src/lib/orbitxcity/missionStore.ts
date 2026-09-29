import { create } from "zustand";
import { getWorldBlock } from "./worlds";
import { buildMissionDefs, currentObjective, type MissionDef, type MissionInstance } from "./missions";
import { useEconomyStore } from "./economyStore";
import { useGameStore } from "./gameStore";
import { cityAudio } from "./cityAudio";
import type { CityId } from "./types";

/**
 * OrbitX City — mission state machine (Worker 3).
 *
 * Real playable missions: delivery, race, collector, taxi. The 3D
 * MissionMarkers component runs the director tick (proximity, timers,
 * cops, heat) — this store only holds state and transitions.
 *
 * NOTE: the legacy one-shot "claim" board in CityProvider
 * (claimedMissionIds / claimMission) is untouched and separate.
 */

export interface MissionHistoryEntry {
  id: string;
  name: string;
  status: "completed" | "failed" | "aborted";
  payout: number;
  at: number;
}

interface MissionState {
  cityId: CityId | null;
  defs: MissionDef[];
  active: MissionInstance | null;
  history: MissionHistoryEntry[];

  /** Rebuild mission layouts when the district changes. */
  setCity: (cityId: CityId) => void;
  /** Begin a mission. Returns false if one is already active. */
  startMission: (id: string, shardsNow: number) => boolean;
  /** Advance to the next objective (director). */
  advanceObjective: () => void;
  /** Collector progress (director). */
  setProgress: (n: number) => void;
  /** Finish with payout. */
  completeMission: () => void;
  /** Give up. failed=true also adds heat (GTA-style trouble). */
  abortMission: (failed?: boolean) => void;
  /** Push the deadline forward (used when unpausing so pause freezes timers). */
  shiftDeadline: (ms: number) => void;
}

const MAX_HISTORY = 24;

export const useMissionStore = create<MissionState>()((set, get) => ({
  cityId: null,
  defs: [],
  active: null,
  history: [],

  setCity: (cityId: CityId) => {
    if (get().cityId === cityId) return;
    const block = getWorldBlock(cityId);
    set({ cityId, defs: buildMissionDefs(block, cityId) });
    // Switching districts voids an in-progress run (positions are city-local).
    if (get().active) get().abortMission(false);
  },

  startMission: (id: string, shardsNow: number) => {
    const s = get();
    if (s.active) return false;
    const def = s.defs.find((d) => d.id === id);
    if (!def) return false;
    const now = Date.now();
    set({
      active: {
        defId: def.id,
        startedAt: now,
        deadline: def.timeLimit > 0 ? now + def.timeLimit * 1000 : 0,
        objectiveIndex: 0,
        shardsAtStart: shardsNow,
        progress: 0,
      },
    });
    cityAudio.play("confirm");
    return true;
  },

  advanceObjective: () => {
    const s = get();
    if (!s.active) return;
    const def = s.defs.find((d) => d.id === s.active!.defId);
    if (!def) return;
    const next = s.active.objectiveIndex + 1;
    if (next >= def.objectives.length) {
      get().completeMission();
      return;
    }
    set({ active: { ...s.active, objectiveIndex: next } });
    cityAudio.play("coin");
  },

  setProgress: (n: number) => {
    const s = get();
    if (!s.active) return;
    if (s.active.progress === n) return;
    const active = { ...s.active, progress: n };
    set({ active });
    const def = s.defs.find((d) => d.id === active.defId);
    const obj = def ? currentObjective(def, active) : null;
    if (def && obj?.kind === "collect" && obj.count && n >= obj.count) {
      get().completeMission();
    }
  },

  completeMission: () => {
    const s = get();
    if (!s.active) return;
    const def = s.defs.find((d) => d.id === s.active!.defId);
    const name = def?.name ?? s.active.defId;
    const payout = def?.payout ?? 0;
    if (payout > 0) {
      useEconomyStore.getState().addCredits(payout, `Mission complete: ${name}`);
    }
    cityAudio.play("confirm");
    const entry: MissionHistoryEntry = {
      id: s.active.defId,
      name,
      status: "completed",
      payout,
      at: Date.now(),
    };
    set({ active: null, history: [entry, ...s.history].slice(0, MAX_HISTORY) });
  },

  abortMission: (failed = false) => {
    const s = get();
    if (!s.active) return;
    const def = s.defs.find((d) => d.id === s.active!.defId);
    const name = def?.name ?? s.active.defId;
    if (failed) {
      useGameStore.getState().addHeat(18);
      cityAudio.play("error");
    }
    const entry: MissionHistoryEntry = {
      id: s.active.defId,
      name,
      status: failed ? "failed" : "aborted",
      payout: 0,
      at: Date.now(),
    };
    set({ active: null, history: [entry, ...s.history].slice(0, MAX_HISTORY) });
  },

  shiftDeadline: (ms: number) => {
    const s = get();
    if (!s.active || s.active.deadline <= 0) return;
    set({ active: { ...s.active, deadline: s.active.deadline + ms } });
  },
}));

/** Convenience: def + instance for the active run (or null). */
export function useActiveMission(): { def: MissionDef; instance: MissionInstance } | null {
  const defs = useMissionStore((s) => s.defs);
  const active = useMissionStore((s) => s.active);
  if (!active) return null;
  const def = defs.find((d) => d.id === active.defId);
  if (!def) return null;
  return { def, instance: active };
}
