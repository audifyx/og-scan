/**
 * Platform-wide achievements (idea 28).
 *
 * Registry of trading milestones with Xbox-style unlock pops.
 * Unlock state persists in localStorage; unlocks broadcast on
 * window ("orbitx:achievement") so the OS home toast host picks them
 * up anywhere in the app. Sounds use the theme-native pack (sounds.ts).
 *
 * Platform integration: any feature calls unlockAchievement("first-trade")
 * (guarded — repeat calls are no-ops). Showcase data comes from
 * getUnlockedAchievements() / ACHIEVEMENTS.
 */

import { playAchievement } from "./sounds";

export interface AchievementDef {
  id: string;
  name: string;
  blurb: string;
  /** glyph for the pop + showcase */
  glyph: string;
  /** rarity weight for the showcase */
  rarity: "common" | "rare" | "epic" | "legendary";
  points: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-trade", name: "First Contact", blurb: "Execute your first trade", glyph: "🚀", rarity: "common", points: 10 },
  { id: "ten-trades", name: "Warming Up", blurb: "Execute 10 trades", glyph: "🔥", rarity: "common", points: 25 },
  { id: "hundred-trades", name: "Degen Certified", blurb: "Execute 100 trades", glyph: "💯", rarity: "rare", points: 100 },
  { id: "first-win", name: "Green Candle", blurb: "Close a trade in profit", glyph: "🕯️", rarity: "common", points: 15 },
  { id: "ten-x", name: "Moonshot", blurb: "Hit a 10x on a single trade", glyph: "🌙", rarity: "epic", points: 250 },
  { id: "diamond", name: "Diamond Hands", blurb: "Hold a position 30+ days", glyph: "💎", rarity: "rare", points: 80 },
  { id: "whale-watch", name: "Whale Watcher", blurb: "Track your first whale wallet", glyph: "🐋", rarity: "common", points: 10 },
  { id: "first-launch", name: "Liftoff", blurb: "Launch your first token", glyph: "🛫", rarity: "rare", points: 120 },
  { id: "theme-smith", name: "Theme Smith", blurb: "Create a custom palette", glyph: "🎨", rarity: "common", points: 10 },
  { id: "night-owl", name: "Night Owl", blurb: "Trade between midnight and 5am", glyph: "🦉", rarity: "rare", points: 40 },
  { id: "paper-hands-no-more", name: "Conviction", blurb: "Survive a 50% dip without selling", glyph: "🛡️", rarity: "epic", points: 200 },
  { id: "orbit-legend", name: "Orbit Legend", blurb: "Unlock every other achievement", glyph: "👑", rarity: "legendary", points: 500 },
];

export const ACHIEVEMENTS_UNLOCKED_KEY = "orbitx-achievements";

export interface UnlockedAchievement {
  id: string;
  at: number;
}

function readUnlocked(): UnlockedAchievement[] {
  try {
    const arr = JSON.parse(localStorage.getItem(ACHIEVEMENTS_UNLOCKED_KEY) || "[]");
    return Array.isArray(arr) ? arr.filter((u) => u && typeof u.id === "string") : [];
  } catch {
    return [];
  }
}

export function getUnlockedAchievements(): UnlockedAchievement[] {
  return readUnlocked();
}

export function isUnlocked(id: string): boolean {
  return readUnlocked().some((u) => u.id === id);
}

export function totalPoints(): number {
  const defs = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
  return readUnlocked().reduce((sum, u) => sum + (defs.get(u.id)?.points ?? 0), 0);
}

/**
 * Unlock an achievement. Returns true if it was newly unlocked
 * (toast + sound fire); false if already unlocked or unknown id.
 */
export function unlockAchievement(id: string): boolean {
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def) return false;
  const unlocked = readUnlocked();
  if (unlocked.some((u) => u.id === id)) return false;
  unlocked.push({ id, at: Date.now() });
  try {
    localStorage.setItem(ACHIEVEMENTS_UNLOCKED_KEY, JSON.stringify(unlocked));
  } catch {
    /* ignore */
  }
  playAchievement();
  try {
    window.dispatchEvent(new CustomEvent("orbitx:achievement", { detail: def }));
  } catch {
    /* ignore */
  }
  // Meta-achievement: unlocking everything else crowns you.
  if (id !== "orbit-legend" && ACHIEVEMENTS.every((a) => a.id === "orbit-legend" || unlocked.some((u) => u.id === a.id))) {
    setTimeout(() => unlockAchievement("orbit-legend"), 1200);
  }
  return true;
}

/** Dev/QA helper — clear all unlocks. */
export function resetAchievements() {
  try {
    localStorage.removeItem(ACHIEVEMENTS_UNLOCKED_KEY);
  } catch {
    /* ignore */
  }
}
