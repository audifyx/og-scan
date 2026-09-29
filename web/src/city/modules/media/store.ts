/**
 * MEDIA MODULE — settings + runtime pub/sub.
 * localStorage keys are module-owned: orbitxcity.media.*.
 */
import { useSyncExternalStore } from "react";
import type { MediaSettings } from "./types";

const SETTINGS_KEY = "orbitxcity.media.settings.v1";

const DEFAULTS: MediaSettings = {
  radioStation: "neon",
  radioVolume: 0.6,
  radioOn: false,
  chatterVoice: true,
  unlockedFilterPacks: [],
  photoCount: 0,
};

function load(): MediaSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<MediaSettings>) };
  } catch { /* noop */ }
  return { ...DEFAULTS };
}

let settings: MediaSettings = typeof window === "undefined" ? DEFAULTS : load();
const listeners = new Set<() => void>();

function save() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* noop */ }
  listeners.forEach((l) => l());
}

export function getMediaSettings(): MediaSettings { return { ...settings }; }

export function updateMediaSettings(patch: Partial<MediaSettings>) {
  settings = { ...settings, ...patch };
  save();
}

/** React hook — re-renders on any settings change. */
export function useMediaSettings(): MediaSettings {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => settings,
  );
}

/* ------------------------------ runtime events ----------------------------- */

export type MediaEvent =
  | { type: "photo-mode"; active: boolean }
  | { type: "radio"; on: boolean; station: string }
  | { type: "theater"; playing: boolean; clipId: string | null }
  | { type: "shot-saved"; id: string };

type MediaListener = (e: MediaEvent) => void;
const evtListeners = new Set<MediaListener>();

/** Module-internal event bus (HUD coordination, no prop drilling). */
export const MediaRuntime = {
  emit(e: MediaEvent) { evtListeners.forEach((l) => l(e)); },
  subscribe(l: MediaListener) { evtListeners.add(l); return () => { evtListeners.delete(l); }; },
};

export { SETTINGS_KEY };
