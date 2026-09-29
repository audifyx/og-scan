/**
 * Theme randomizer ("surprise me" dice) + new-device-every-login.
 * Pure logic — the provider wires it to state.
 */
import {
  ACCENTS,
  BACKGROUND_THEMES,
  DEVICE_THEMES,
} from "./themes";

export const SURPRISE_LOGIN_KEY = "orbitx-surprise-login";

export interface RandomThemePick {
  device: string;
  bg: string;
  accent: string;
}

function pick<T>(arr: T[], exclude?: T): T {
  const pool = exclude === undefined ? arr : arr.filter((x) => x !== exclude);
  const src = pool.length > 0 ? pool : arr;
  return src[Math.floor(Math.random() * src.length)];
}

/** Dice roll: random device theme (≠ current), background, and accent. */
export function rollRandomTheme(current?: RandomThemePick): RandomThemePick {
  const curDevice = DEVICE_THEMES.find((t) => t.id === current?.device);
  const curBg = BACKGROUND_THEMES.find((b) => b.id === current?.bg);
  const curAccent = ACCENTS.find((a) => a.id === current?.accent);
  return {
    device: pick(DEVICE_THEMES, curDevice).id,
    bg: pick(BACKGROUND_THEMES, curBg).id,
    accent: pick(ACCENTS, curAccent).id,
  };
}

export function getSurpriseOnLogin(): boolean {
  try {
    return localStorage.getItem(SURPRISE_LOGIN_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSurpriseOnLogin(v: boolean) {
  try {
    localStorage.setItem(SURPRISE_LOGIN_KEY, v ? "1" : "0");
  } catch {
    /* storage may be unavailable */
  }
}

/**
 * Returns true once per tab session when surprise-on-login is enabled,
 * so the dice rolls exactly once per login/session.
 */
export function shouldSurpriseThisSession(): boolean {
  if (!getSurpriseOnLogin()) return false;
  try {
    if (sessionStorage.getItem("orbitx-surprised") === "1") return false;
    sessionStorage.setItem("orbitx-surprised", "1");
    return true;
  } catch {
    return false;
  }
}
