/**
 * ORBITXCITY — Factions module: React binding.
 */
import { useEffect, useReducer } from "react";
import { getFactionsStore, type FactionsStore } from "./store";
import type { FactionsState } from "./types";

/**
 * Subscribe to the factions store. Returns [state, store].
 * The store is a singleton — every component shares one city.
 */
export function useFactions(): [FactionsState, FactionsStore] {
  const store = getFactionsStore();
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => store.subscribe(force), [store]);
  return [store.getState(), store];
}

/** Player-facing display label (integrator may override with the real handle). */
export function playerLabel(): string {
  try {
    const saved = localStorage.getItem("orbitx-city-factions-label");
    if (saved) return saved;
  } catch { /* ignore */ }
  return "You";
}

export function setPlayerLabel(label: string): void {
  try {
    localStorage.setItem("orbitx-city-factions-label", label.slice(0, 24));
  } catch { /* ignore */ }
}
