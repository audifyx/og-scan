/**
 * OrbitX City — day/night cycle state.
 *
 * The SkyCycle component is the single writer: every frame it derives the
 * phase from the render clock and calls `updateDayNight`. Everything else
 * READS via `getDayNight()`.
 *
 * Two consumption patterns:
 *
 * 1. Continuous (preferred, zero React re-renders): inside a `useFrame`
 *    callback, read `getDayNight()` and mutate materials / light intensities
 *    directly, e.g.
 *
 *      useFrame(() => {
 *        const dn = getDayNight();
 *        litWindowMat.emissiveIntensity = 0.25 + dn.windowLevel * 1.5;
 *      });
 *
 *    `getDayNight()` returns the SAME mutable object every call — never store
 *    it in state or render output from it; read its fields inside useFrame.
 *
 * 2. Coarse (rare UI): `subscribeDayNight(cb)` fires only when the coarse
 *    band changes between "day" | "dusk" | "night" — safe for React state.
 *
 * Field semantics:
 * - phase:      0..1 progress through one full day (DAY_SECONDS long)
 * - daylight:   0..1, 1 = sun high, 0 = sun below horizon
 * - twilight:   0..1, peaks at sunrise/sunset (golden hour)
 * - night:      0..1, inverse of daylight
 * - sunAngle:   radians of the sun around the sky dome
 * - lampLevel:  0..1 streetlight / neon glow strength (1 at full night)
 * - windowLevel:0..1 lit-window emissive strength (1 at full night)
 */
export const DAY_SECONDS = 360;

export type DayNightBand = "day" | "dusk" | "night";

export interface DayNightState {
  phase: number;
  daylight: number;
  twilight: number;
  night: number;
  sunAngle: number;
  lampLevel: number;
  windowLevel: number;
}

const state: DayNightState = {
  phase: 0,
  daylight: 1,
  twilight: 0,
  night: 0,
  sunAngle: 0,
  lampLevel: 0,
  windowLevel: 0,
};

let band: DayNightBand = "day";
const listeners = new Set<(band: DayNightBand) => void>();

export function dayNightBandOf(s: DayNightState): DayNightBand {
  if (s.daylight > 0.45) return "day";
  if (s.daylight > 0.12) return "dusk";
  return "night";
}

/** Read the live day/night snapshot. Same mutable object every call. */
export function getDayNight(): DayNightState {
  return state;
}

/** True when it is meaningfully dark (streetlights should be on). */
export function isNight(): boolean {
  return state.night > 0.5;
}

/**
 * Writer — called by SkyCycle every frame. Mutates the shared snapshot in
 * place; listener notification only fires when the coarse band changes, so
 * per-frame calls stay allocation-free.
 */
export function updateDayNight(partial: Partial<DayNightState>): void {
  Object.assign(state, partial);
  const next = dayNightBandOf(state);
  if (next !== band) {
    band = next;
    listeners.forEach((fn) => {
      try {
        fn(band);
      } catch {
        /* listener errors must never break the frame loop */
      }
    });
  }
}

/** Subscribe to coarse band changes (day/dusk/night). Returns unsubscribe. */
export function subscribeDayNight(fn: (band: DayNightBand) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Current coarse band without subscribing. */
export function getDayNightBand(): DayNightBand {
  return band;
}
