/**
 * OrbitX City save game — localStorage persistence.
 *
 * Key: 'oxc-save-v1'. Stores credits, avatar appearance, selected city,
 * quality/touch prefs, audio prefs, and mission history.
 *
 * Coordination notes:
 * - Credits: source of truth is Worker 3's economy store (persisted as
 *   `oxc-economy`). This save snapshots `useEconomyStore.getState().credits`
 *   on every write; on load, `CitySaveController` restores the economy to
 *   the saved balance via `restoreEconomyCredits()`.
 * - Claimed missions: CityProvider keeps its own 'oxc_claimed_missions' key.
 *   This save snapshots it (via readClaimedMissionIds()) so a wipe of that
 *   key doesn't lose history; on load CitySaveController unions both lists
 *   and writes the union back to the provider's key.
 * - Audio prefs are mirrored into cityAudio's own keys (oxc_music_on, …) —
 *   this save is a portable snapshot layer on top, safe to reset without
 *   losing the live prefs.
 */

import type { AvatarAppearance } from "./types";
import { useEconomyStore } from "./economyStore";

export const CITY_SAVE_KEY = "oxc-save-v1";
/** Legacy provider key — snapshotted into the save, never replaced. */
export const PROVIDER_CLAIMED_MISSIONS_KEY = "oxc_claimed_missions";

export interface CitySaveAudio {
  masterMuted: boolean;
  musicOn: boolean;
  sfxOn: boolean;
  musicVol: number;
  sfxVol: number;
  trackId: string;
}

export interface CitySaveMissions {
  /** Union of claimed mission ids (provider key + save). */
  completedIds: string[];
  /** Times each mission id has been completed. */
  completions: Record<string, number>;
  lastCompletedAt: number | null;
}

export interface CitySave {
  version: 1;
  credits: number;
  avatar: AvatarAppearance;
  selectedCityId: string;
  quality: "high" | "lite";
  touchControls: boolean;
  audio: CitySaveAudio;
  missions: CitySaveMissions;
  updatedAt: number;
}

const DEFAULT_AVATAR: AvatarAppearance = {
  bodyColor: "#12181f",
  accentColor: "#00ff9f",
  skinColor: "#e8d5c0",
  name: "Traveler",
  classId: "pepe",
  hairStyle: "short",
  hairColor: "#151018",
  outfit: "suit",
  faceStyle: "cool",
};

export function defaultSave(): CitySave {
  return {
    version: 1,
    credits: 0,
    avatar: { ...DEFAULT_AVATAR },
    selectedCityId: "nyc",
    quality: "high",
    touchControls: false,
    audio: {
      masterMuted: false,
      musicOn: true,
      sfxOn: true,
      musicVol: 0.45,
      sfxVol: 0.7,
      trackId: "orbitx-theme-01",
    },
    missions: { completedIds: [], completions: {}, lastCompletedAt: null },
    updatedAt: Date.now(),
  };
}

/** Read the provider's own claimed-missions key (CityProvider writes this). */
export function readClaimedMissionIds(): string[] {
  try {
    const raw = localStorage.getItem(PROVIDER_CLAIMED_MISSIONS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Credits source of truth is the economy store (Worker 3, persisted as
 * `oxc-economy`). The save keeps a portable snapshot of it.
 */
export function readEconomyCredits(): number {
  try {
    const n = useEconomyStore.getState().credits;
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  } catch {
    return 0;
  }
}

/**
 * Restore the economy balance to the saved value (ledgered as a restore, so
 * the HUD/event log shows where the change came from).
 */
export function restoreEconomyCredits(target: number): void {
  try {
    const econ = useEconomyStore.getState();
    const diff = Math.round(target) - Math.round(econ.credits);
    if (diff > 0) econ.addCredits(diff, "save restore");
    else if (diff < 0) econ.spendCredits(-diff, "save restore");
  } catch {
    /* ignore */
  }
}

function sanitize(raw: Partial<CitySave> | null | undefined): CitySave | null {
  if (!raw || typeof raw !== "object" || raw.version !== 1) return null;
  const d = defaultSave();
  const avatar: AvatarAppearance = { ...d.avatar, ...(raw.avatar ?? {}) };
  const audio: CitySaveAudio = { ...d.audio, ...(raw.audio ?? {}) };
  const missions: CitySaveMissions = {
    completedIds: Array.isArray(raw.missions?.completedIds) ? raw.missions!.completedIds : [],
    completions:
      raw.missions?.completions && typeof raw.missions.completions === "object"
        ? raw.missions.completions
        : {},
    lastCompletedAt:
      typeof raw.missions?.lastCompletedAt === "number" ? raw.missions.lastCompletedAt : null,
  };
  return {
    version: 1,
    credits: typeof raw.credits === "number" && Number.isFinite(raw.credits) ? raw.credits : 0,
    avatar,
    selectedCityId: typeof raw.selectedCityId === "string" ? raw.selectedCityId : d.selectedCityId,
    quality: raw.quality === "lite" ? "lite" : "high",
    touchControls: raw.touchControls === true,
    audio: {
      masterMuted: audio.masterMuted === true,
      musicOn: audio.musicOn !== false,
      sfxOn: audio.sfxOn !== false,
      musicVol: clamp01(audio.musicVol),
      sfxVol: clamp01(audio.sfxVol),
      trackId: typeof audio.trackId === "string" ? audio.trackId : d.audio.trackId,
    },
    missions,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

function clamp01(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/** Load the save, or null when none exists / corrupt. */
export function loadSave(): CitySave | null {
  try {
    const raw = localStorage.getItem(CITY_SAVE_KEY);
    if (!raw) return null;
    return sanitize(JSON.parse(raw) as Partial<CitySave>);
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return loadSave() !== null;
}

/**
 * Write a save. Merges `partial` over the current save (or defaults) so
 * callers can update one slice without rebuilding the whole object.
 * Credits are always snapshotted from the economy store unless `partial`
 * carries an explicit `credits` value.
 */
export function saveGame(partial: Partial<CitySave> = {}): CitySave {
  const base = loadSave() ?? defaultSave();
  const next: CitySave = {
    ...base,
    ...partial,
    version: 1 as const,
    credits: partial.credits ?? readEconomyCredits(),
    avatar: { ...base.avatar, ...(partial.avatar ?? {}) },
    audio: { ...base.audio, ...(partial.audio ?? {}) },
    missions: { ...base.missions, ...(partial.missions ?? {}) },
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(CITY_SAVE_KEY, JSON.stringify(next));
  } catch {
    /* storage full/blocked — keep going without a save */
  }
  return next;
}

/** Wipe the save. Audio/provider keys are left alone (they're live prefs). */
export function resetSave(): void {
  try {
    localStorage.removeItem(CITY_SAVE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Record a mission completion: bumps completions[missionId], unions the
 * provider's claimed-ids list, and persists. Call from the mission worker
 * on every successful completion (auto-save hook).
 */
export function recordMissionComplete(missionId: string): CitySave {
  const current = loadSave() ?? defaultSave();
  const completedIds = Array.from(new Set([...current.missions.completedIds, ...readClaimedMissionIds(), missionId]));
  const completions = { ...current.missions.completions };
  completions[missionId] = (completions[missionId] ?? 0) + 1;
  return saveGame({
    missions: { completedIds, completions, lastCompletedAt: Date.now() },
  });
}
