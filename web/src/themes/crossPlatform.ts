/**
 * Cross-platform theme engine core (Phase 2).
 *
 * A "theme" here = the full platform-wide look: device theme + background
 * (wallpaper) + accent color, serialized as a tiny portable JSON snapshot.
 * Snapshots apply through plain localStorage keys + <html> data attributes,
 * so the SAME theme object works on web, mobile webviews, partner embeds,
 * and any future client — no React context required to apply one.
 *
 * "Theme presets" are named background + accent combos (optionally pinned to
 * a device theme) that apply platform-wide with one tap. Built-ins ship
 * below; users can save their own (localStorage).
 *
 * Defensive by design: never throws, never touches billing/custody, and
 * degrades gracefully when localStorage or DOM are unavailable.
 */

import {
  ACCENT_KEY,
  BACKGROUND_THEMES,
  BG_THEME_KEY,
  DEVICE_THEME_KEY,
  DEVICE_THEMES,
  ACCENTS,
} from "./themes";

/** Portable theme snapshot — the cross-platform unit of theme state. */
export interface ThemeSnapshot {
  v: 1;
  device: string;
  background: string;
  accent: string;
  updatedAt: number;
}

/** A named preset: background + accent (+ optional device pin). */
export interface ThemePreset {
  id: string;
  name: string;
  device?: string;
  background: string;
  accent: string;
  builtin?: boolean;
}

const CUSTOM_PRESETS_KEY = "orbitx-theme-presets-v1";

/* ------------------------------------------------------------------ */
/* snapshots                                                           */
/* ------------------------------------------------------------------ */

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLS(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage may be unavailable */
  }
}

/** Read the current theme as a portable snapshot (web client of record). */
export function readThemeSnapshot(): ThemeSnapshot {
  return {
    v: 1,
    device: readLS(DEVICE_THEME_KEY) || "orbitx",
    background: readLS(BG_THEME_KEY) || "nebula",
    accent: readLS(ACCENT_KEY) || "lime",
    updatedAt: Date.now(),
  };
}

/**
 * Apply a snapshot cross-platform: persists the keys and sets the
 * <html> data attributes directly, then notifies listeners (including the
 * React provider, which re-reads and re-applies on "orbitx:theme-applied").
 * Safe to call from any client — DOM access is guarded.
 */
export function applyThemeSnapshot(snap: Partial<ThemeSnapshot>): ThemeSnapshot {
  const full: ThemeSnapshot = {
    v: 1,
    device: DEVICE_THEMES.some((t) => t.id === snap.device) ? (snap.device as string) : "orbitx",
    background: BACKGROUND_THEMES.some((b) => b.id === snap.background)
      ? (snap.background as string)
      : "nebula",
    accent: ACCENTS.some((a) => a.id === snap.accent) ? (snap.accent as string) : "lime",
    updatedAt: Date.now(),
  };
  writeLS(DEVICE_THEME_KEY, full.device);
  writeLS(BG_THEME_KEY, full.background);
  writeLS(ACCENT_KEY, full.accent);
  if (typeof document !== "undefined") {
    const el = document.documentElement;
    el.dataset.deviceTheme = full.device;
    el.dataset.bgTheme = full.background;
    el.dataset.accent = full.accent;
  }
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent<ThemeSnapshot>("orbitx:theme-applied", { detail: full })
      );
    } catch {
      /* listeners are optional */
    }
  }
  return full;
}

/* ------------------------------------------------------------------ */
/* presets — background + accent combos, platform-wide                 */
/* ------------------------------------------------------------------ */

/** Built-in cross-platform presets: background + accent, device-agnostic. */
export const BUILTIN_PRESETS: ThemePreset[] = [
  { id: "neon-nights", name: "Neon Nights", background: "midnight", accent: "cyan", builtin: true },
  { id: "solar-flare", name: "Solar Flare", background: "sunset", accent: "orange", builtin: true },
  { id: "deep-trench", name: "Deep Trench", background: "ocean", accent: "blue", builtin: true },
  { id: "greenhouse", name: "Greenhouse", background: "matrix", accent: "lime", builtin: true },
  { id: "gridline", name: "Gridline", background: "grid", accent: "violet", builtin: true },
  { id: "rose-protocol", name: "Rosé Protocol", background: "void", accent: "pink", builtin: true },
  { id: "aurora-signal", name: "Aurora Signal", background: "aurora", accent: "cyan", builtin: true },
  { id: "gold-standard", name: "Gold Standard", background: "nebula", accent: "gold", builtin: true },
  { id: "alert-state", name: "Alert State", background: "void", accent: "red", builtin: true },
  { id: "clean-room", name: "Clean Room", background: "paper", accent: "blue", builtin: true },
];

/** User-saved presets (localStorage). Built-ins are never stored. */
export function getCustomPresets(): ThemePreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (p): p is ThemePreset =>
        p &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        BACKGROUND_THEMES.some((b) => b.id === p.background) &&
        ACCENTS.some((a) => a.id === p.accent)
    );
  } catch {
    return [];
  }
}

export function listPresets(): ThemePreset[] {
  return [...BUILTIN_PRESETS, ...getCustomPresets()];
}

/** Save the current snapshot as a named custom preset. Returns the preset or null. */
export function saveCurrentAsPreset(name: string): ThemePreset | null {
  const clean = name.trim().slice(0, 32);
  if (!clean) return null;
  const snap = readThemeSnapshot();
  const preset: ThemePreset = {
    id: `custom-${Date.now().toString(36)}`,
    name: clean,
    device: snap.device,
    background: snap.background,
    accent: snap.accent,
  };
  const all = getCustomPresets();
  all.push(preset);
  writeLS(CUSTOM_PRESETS_KEY, JSON.stringify(all.slice(-24))); // cap at 24
  return preset;
}

export function deleteCustomPreset(id: string): boolean {
  const all = getCustomPresets();
  const next = all.filter((p) => p.id !== id);
  if (next.length === all.length) return false;
  writeLS(CUSTOM_PRESETS_KEY, JSON.stringify(next));
  return true;
}

export function getPreset(id: string): ThemePreset | undefined {
  return listPresets().find((p) => p.id === id);
}

/* ------------------------------------------------------------------ */
/* share — encode/decode a preset as a portable string                 */
/* ------------------------------------------------------------------ */

/** Encode a preset into a shareable portable string (copy/paste, QR, link). */
export function encodePresetShare(preset: ThemePreset): string {
  const payload: ThemePreset = {
    id: preset.id,
    name: preset.name,
    device: preset.device,
    background: preset.background,
    accent: preset.accent,
  };
  try {
    const json = JSON.stringify(payload);
    return `oxp1.${btoa(unescape(encodeURIComponent(json)))}`;
  } catch {
    return "";
  }
}

/** Decode a shared preset string back into a preset (null when invalid). */
export function decodePresetShare(code: string): ThemePreset | null {
  try {
    const trimmed = code.trim();
    if (!trimmed.startsWith("oxp1.")) return null;
    const json = decodeURIComponent(escape(atob(trimmed.slice(5))));
    const p = JSON.parse(json);
    if (
      typeof p.name !== "string" ||
      !BACKGROUND_THEMES.some((b) => b.id === p.background) ||
      !ACCENTS.some((a) => a.id === p.accent)
    )
      return null;
    return {
      id: `shared-${Date.now().toString(36)}`,
      name: String(p.name).slice(0, 32),
      device: DEVICE_THEMES.some((t) => t.id === p.device) ? p.device : undefined,
      background: p.background,
      accent: p.accent,
    };
  } catch {
    return null;
  }
}
