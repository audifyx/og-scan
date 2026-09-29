/**
 * Idle screensavers (ideas 30 + 31).
 *
 * useIdle(minutes) reports when the user has been idle that long
 * (mouse / keys / touch / scroll reset the timer). The Screensaver
 * host (oshome) picks a scene:
 *   "orbiting"  — tokens orbiting a core (idea 30)
 *   "flyover"   — neon city flyover (idea 31, reuses the wallpaper engine)
 * Any input dismisses it.
 */

export type ScreensaverScene = "orbiting" | "flyover" | "off";

export const SCREENSAVER_SCENE_KEY = "orbitx-screensaver-scene";
export const SCREENSAVER_TIMEOUT_KEY = "orbitx-screensaver-timeout";

export const DEFAULT_SCREENSAVER_SCENE: ScreensaverScene = "orbiting";
/** Default idle minutes before the screensaver kicks in. */
export const DEFAULT_SCREENSAVER_TIMEOUT = 5;

export function getScreensaverScene(): ScreensaverScene {
  try {
    const v = localStorage.getItem(SCREENSAVER_SCENE_KEY);
    return v === "flyover" || v === "off" ? v : DEFAULT_SCREENSAVER_SCENE;
  } catch {
    return DEFAULT_SCREENSAVER_SCENE;
  }
}

export function setScreensaverScene(s: ScreensaverScene) {
  try {
    localStorage.setItem(SCREENSAVER_SCENE_KEY, s);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("orbitx:screensaver"));
}

export function getScreensaverTimeout(): number {
  try {
    const v = Number(localStorage.getItem(SCREENSAVER_TIMEOUT_KEY));
    return Number.isFinite(v) && v >= 1 && v <= 60 ? v : DEFAULT_SCREENSAVER_TIMEOUT;
  } catch {
    return DEFAULT_SCREENSAVER_TIMEOUT;
  }
}

export function setScreensaverTimeout(minutes: number) {
  try {
    localStorage.setItem(SCREENSAVER_TIMEOUT_KEY, String(minutes));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("orbitx:screensaver"));
}

import { useEffect, useState } from "react";

const RESET_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll"] as const;

/** True once the user has been idle for `minutes`. Resets on any input. */
export function useIdle(minutes: number, disabled = false): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (disabled || minutes <= 0) {
      setIdle(false);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const arm = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), minutes * 60 * 1000);
    };
    arm();
    for (const ev of RESET_EVENTS) window.addEventListener(ev, arm, { passive: true });
    return () => {
      clearTimeout(t);
      for (const ev of RESET_EVENTS) window.removeEventListener(ev, arm);
    };
  }, [minutes, disabled]);
  return idle;
}
