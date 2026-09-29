import { create } from "zustand";

/**
 * OrbitX City — gameplay vitals (Worker 3).
 *
 * Health / heat (wanted) / motion telemetry shared by HUD, NPCs, Traffic,
 * MissionMarkers and the mission director. Session state only (not persisted).
 *
 * Vehicle integration: the vehicle worker can publish live telemetry at
 * `window.__oxc_vehicle = { inCar: boolean, speed?: number }`. When absent,
 * motion is estimated from player-position deltas (works on foot).
 */

export interface CopCar {
  id: string;
  x: number;
  z: number;
}

export interface VehicleTelemetry {
  inCar: boolean;
  speed: number | null;
}

/** Declared on window by the vehicle system when the player is driving. */
declare global {
  interface Window {
    __oxc_vehicle?: { inCar?: boolean; speed?: number } | null;
  }
}

export function readVehicleTelemetry(): VehicleTelemetry {
  try {
    const v = window.__oxc_vehicle;
    if (v && typeof v === "object") {
      return {
        inCar: !!v.inCar,
        speed: typeof v.speed === "number" && Number.isFinite(v.speed) ? v.speed : null,
      };
    }
  } catch {
    /* ignore */
  }
  return { inCar: false, speed: null };
}

export const MAX_HEALTH = 100;
export const MAX_HEAT = 100;
/** Stars shown in HUD = ceil(heat / 20), 0..5. Cops deploy at 4+ stars. */
export const COP_STARS = 4;
/** Speed (m/s) above max on-foot sprint that counts as reckless near pedestrians. */
export const RECKLESS_SPEED = 12.6;

interface GameState {
  health: number;
  heat: number;
  /** m/s motion estimate, refreshed ~5Hz by the mission director. */
  speed: number;
  inCar: boolean;
  paused: boolean;
  gameOver: boolean;
  /** When the game-over state began (for deadline shifting on respawn). */
  gameOverAt: number;
  /** Active pursuing cop cars (positions driven by the director). */
  cops: CopCar[];
  lastDamageAt: number;
  lastHeatGainAt: number;

  damage: (n: number) => void;
  addHeat: (n: number) => void;
  setMotion: (speed: number, inCar: boolean) => void;
  setPaused: (v: boolean) => void;
  setCops: (c: CopCar[]) => void;
  /** Per-frame upkeep: heat decay + slow health regen when calm. */
  tick: (dt: number) => void;
  /** Clear vitals after respawn / busted (health restored, heat cleared). */
  respawn: () => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  health: MAX_HEALTH,
  heat: 0,
  speed: 0,
  inCar: false,
  paused: false,
  gameOver: false,
  gameOverAt: 0,
  cops: [],
  lastDamageAt: 0,
  lastHeatGainAt: 0,

  damage: (n: number) => {
    if (get().paused || get().gameOver) return;
    const health = Math.max(0, get().health - n);
    set({ health, lastDamageAt: Date.now() });
    if (health <= 0) set({ gameOver: true, gameOverAt: Date.now(), cops: [] });
  },

  addHeat: (n: number) => {
    if (get().paused) return;
    set((s) => ({ heat: Math.min(MAX_HEAT, Math.max(0, s.heat + n)), lastHeatGainAt: Date.now() }));
  },

  setMotion: (speed: number, inCar: boolean) => {
    const s = get();
    if (Math.abs(s.speed - speed) < 0.25 && s.inCar === inCar) return;
    set({ speed, inCar });
  },

  setPaused: (v: boolean) => set({ paused: v }),

  setCops: (c: CopCar[]) => set({ cops: c }),

  tick: (dt: number) => {
    const s = get();
    if (s.paused || s.gameOver) return;
    let { heat, health } = s;
    let changed = false;
    // Heat decays when no fresh trouble (~last 4s).
    if (heat > 0 && Date.now() - s.lastHeatGainAt > 4000) {
      heat = Math.max(0, heat - 5 * dt);
      changed = true;
    }
    // Slow regen when calm and unhurt for a while.
    if (health < MAX_HEALTH && heat < 20 && Date.now() - s.lastDamageAt > 8000) {
      health = Math.min(MAX_HEALTH, health + 2.5 * dt);
      changed = true;
    }
    if (changed) set({ heat, health });
  },

  respawn: () =>
    set({ health: MAX_HEALTH, heat: 0, gameOver: false, gameOverAt: 0, cops: [], speed: 0, inCar: false }),
}));

/** HUD helper: wanted stars 0..5. */
export function heatStars(heat: number): number {
  return Math.max(0, Math.min(5, Math.ceil(heat / 20)));
}
