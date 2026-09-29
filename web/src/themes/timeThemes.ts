/**
 * Time-based themes — the OS re-skins itself as the day moves.
 * Slots: morning / day / sunset / night. When timeAuto is on, the provider
 * evaluates the slot every minute and switches device theme accordingly.
 * A manual theme change pauses auto-switching for 30 minutes.
 */
import { DEVICE_THEMES } from "./themes";

export type TimeSlot = "morning" | "day" | "sunset" | "night";

export const TIME_AUTO_KEY = "orbitx-time-auto";
export const MANUAL_THEME_TS_KEY = "orbitx-manual-theme-ts";
const MANUAL_PAUSE_MS = 30 * 60 * 1000;

/** Default slot → device theme mapping (all ids exist in the phase-1 registry). */
export const SLOT_THEMES: Record<TimeSlot, string> = {
  morning: "ios", // bright start
  day: "gameboy", // approved: Game Boy by day
  sunset: "ps4", // approved: PS4 by night begins at dusk
  night: "crt", // phosphor after dark
};

export function getTimeSlot(d = new Date()): TimeSlot {
  const h = d.getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "sunset";
  return "night";
}

export function slotLabel(slot: TimeSlot): string {
  return { morning: "Morning", day: "Day", sunset: "Sunset", night: "Night" }[slot];
}

/** Human summary of the current schedule, e.g. "Day → Game Boy". */
export function describeSchedule(): { slot: TimeSlot; label: string; themeName: string }[] {
  return (Object.keys(SLOT_THEMES) as TimeSlot[]).map((slot) => {
    const themeId = SLOT_THEMES[slot];
    const theme = DEVICE_THEMES.find((t) => t.id === themeId);
    return { slot, label: slotLabel(slot), themeName: theme ? theme.name : themeId };
  });
}

export function getTimeAuto(): boolean {
  try {
    return localStorage.getItem(TIME_AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTimeAutoLS(v: boolean) {
  try {
    localStorage.setItem(TIME_AUTO_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Record a manual theme change so auto mode backs off for a while. */
export function markManualThemeChange() {
  try {
    localStorage.setItem(MANUAL_THEME_TS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function manualPauseActive(): boolean {
  try {
    const ts = Number(localStorage.getItem(MANUAL_THEME_TS_KEY) || "0");
    return Date.now() - ts < MANUAL_PAUSE_MS;
  } catch {
    return false;
  }
}
