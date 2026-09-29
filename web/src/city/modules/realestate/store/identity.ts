/**
 * Real estate module — stable per-device player identity.
 * Deeds, homes, auction bids and guests all key off this id.
 */
const STORAGE_KEY = "orbitxcity:player-id:v1";

function load(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return raw;
  } catch {
    /* ignore */
  }
  const id = `player-${crypto.randomUUID().slice(0, 8)}`;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}

/** Stable device player id (survives reloads). */
export const PLAYER_ID: string = typeof window !== "undefined" ? load() : "player-ssr";
