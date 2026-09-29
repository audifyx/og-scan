/**
 * OrbitX City — vehicle system store (WORKER 2).
 *
 * THE contract other systems use. Reactive slice (zustand) is only for
 * mode/active-car transitions; per-frame car bodies live in plain mutable
 * records so the 60Hz physics loop never triggers React re-renders.
 *
 * Positions are session state — nothing here is persisted.
 */
import { create } from "zustand";
import { setDrivingMode } from "./input";

export type VehicleMode = "foot" | "driving";

export type CarKind = "sedan" | "sports" | "suv" | "van";

export interface CarSpec {
  id: string;
  kind: CarKind;
  /** Display name, e.g. "Velocity GT". */
  label: string;
  body: string;
  glow: string;
  /** m/s at full throttle. */
  topSpeed: number;
  /** m/s^2 throttle acceleration. */
  accel: number;
  /** m/s^2 braking / reverse-throttle. */
  brake: number;
  /** rad/s steering authority at low speed. */
  turn: number;
  /** 0..1 lateral grip (higher = less slide). */
  grip: number;
  /** Visual scale tweaks per kind. */
  length: number;
  width: number;
  height: number;
  wheelRadius: number;
}

/**
 * Mutable per-frame body. NOT reactive — read it in useFrame via
 * useVehicleStore.getState().cars[id]. Mutating it does not re-render.
 */
export interface CarBody {
  pos: { x: number; z: number };
  /** Heading, radians. Forward = (sin(yaw), cos(yaw)) on XZ. */
  yaw: number;
  /** Signed m/s along heading. */
  speed: number;
  /** Visual front-wheel steer angle, radians. */
  steer: number;
}

interface VehicleState {
  mode: VehicleMode;
  /** Car currently driven (or being entered). */
  activeCarId: string | null;
  /** Set while the enter-car animation beat plays; PlayerAvatar drains it. */
  enteringCarId: string | null;
  /** All car specs (set once at spawn). */
  specs: Record<string, CarSpec>;
  /** Mutable per-frame bodies, keyed by car id. */
  cars: Record<string, CarBody>;

  /** Register the fleet (specs + initial bodies). Idempotent per id. */
  registerCars: (specs: CarSpec[], initial: Record<string, CarBody>) => void;
  /** Patch a car's mutable body (physics writes through this). */
  updateCar: (id: string, patch: Partial<CarBody>) => void;
  /**
   * Begin entering a car: runs the 0.45s character-to-door animation beat.
   * PlayerAvatar completes it by calling completeEnter().
   */
  enterCar: (id: string) => void;
  /** Called by PlayerAvatar when the enter animation finishes. */
  completeEnter: () => void;
  /** Cancel a pending enter (e.g. car moved). */
  cancelEnter: () => void;
  /** Exit the car — caller must also relocate the avatar (teleport). */
  exitCar: () => void;
  /** Full reset (block change): clears fleet + mode. */
  resetVehicles: () => void;
}

export const useVehicleStore = create<VehicleState>((set, get) => ({
  mode: "foot",
  activeCarId: null,
  enteringCarId: null,
  specs: {},
  cars: {},

  registerCars: (specs, initial) =>
    set((s) => {
      const nextSpecs = { ...s.specs };
      const nextCars = { ...s.cars };
      for (const spec of specs) {
        if (!nextSpecs[spec.id]) {
          nextSpecs[spec.id] = spec;
          const body = initial[spec.id];
          if (body) nextCars[spec.id] = { ...body, pos: { ...body.pos } };
        }
      }
      return { specs: nextSpecs, cars: nextCars };
    }),

  updateCar: (id, patch) => {
    const car = get().cars[id];
    if (!car) return;
    if (patch.pos) car.pos = { x: patch.pos.x, z: patch.pos.z };
    if (patch.yaw !== undefined) car.yaw = patch.yaw;
    if (patch.speed !== undefined) car.speed = patch.speed;
    if (patch.steer !== undefined) car.steer = patch.steer;
  },

  enterCar: (id) => {
    const s = get();
    if (s.mode !== "foot" || s.enteringCarId || !s.cars[id]) return;
    set({ enteringCarId: id, activeCarId: id });
  },

  completeEnter: () => {
    const s = get();
    if (!s.enteringCarId) return;
    set({ enteringCarId: null, mode: "driving" });
    // Notify the shared input bus so touch UI can swap to driving controls.
    setDrivingMode(true);
  },

  cancelEnter: () => set({ enteringCarId: null, activeCarId: null }),

  exitCar: () => {
    set({ mode: "foot", activeCarId: null, enteringCarId: null });
    setDrivingMode(false);
    window.__oxc_vehicle = { inCar: false, speed: 0 };
  },

  resetVehicles: () => {
    set({ mode: "foot", activeCarId: null, enteringCarId: null, specs: {}, cars: {} });
    setDrivingMode(false);
    window.__oxc_vehicle = { inCar: false, speed: 0 };
  },
}));

/** Non-reactive read helper for the 60Hz loop. */
export function getCarBody(id: string): CarBody | undefined {
  return useVehicleStore.getState().cars[id];
}

export function getCarSpec(id: string): CarSpec | undefined {
  return useVehicleStore.getState().specs[id];
}
