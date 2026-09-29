/**
 * OrbitX City — shared input bus.
 * Keyboard writes directly into PlayerAvatar; touch controls (and any future
 * gamepad support) write here. The player controller merges both every frame,
 * so desktop and mobile inputs coexist without coupling UI to the 3D loop.
 */
export const virtualInput = {
  /** Normalized movement axis from the on-screen joystick. -1..1 */
  axisX: 0,
  axisZ: 0,
  /** Sprint toggle held by the touch UI. */
  sprint: false,
  /** One-shot jump request (buffered until the player is grounded). */
  jumpQueued: false,
  /** One-shot interact request (E key equivalent for touch / vehicle entry). */
  interactQueued: false,
  /** Accumulated camera zoom delta from +/- buttons or pinch. */
  zoomDelta: 0,
  /** True while the player is inside a vehicle — the driving worker sets this. */
  driving: false,
  /** Steering input while driving. -1..1 (left..right). */
  steer: 0,
  /** Throttle input while driving. 0..1. */
  throttle: 0,
  /** Brake input while driving. 0..1. */
  brake: 0,
};

function clamp1(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function setAxis(x: number, z: number): void {
  virtualInput.axisX = clamp1(x);
  virtualInput.axisZ = clamp1(z);
}

/** Listeners notified when driving mode flips (touch UI swaps layouts). */
const driveModeListeners = new Set<(driving: boolean) => void>();

export function subscribeDriveMode(cb: (driving: boolean) => void): () => void {
  driveModeListeners.add(cb);
  return () => {
    driveModeListeners.delete(cb);
  };
}

/**
 * Called by the driving worker when the player enters/exits a vehicle.
 * Exiting clears all analog drive inputs.
 */
export function setDrivingMode(on: boolean): void {
  if (virtualInput.driving === on) return;
  virtualInput.driving = on;
  if (!on) clearDrive();
  for (const cb of driveModeListeners) cb(on);
}

/** Write analog driving inputs (called by touch pedals / steering). */
export function setDrive(steer: number, throttle: number, brake: number): void {
  virtualInput.steer = clamp1(steer);
  virtualInput.throttle = clamp01(throttle);
  virtualInput.brake = clamp01(brake);
}

/** Drop all analog drive inputs (release of pedals / steering). */
export function clearDrive(): void {
  virtualInput.steer = 0;
  virtualInput.throttle = 0;
  virtualInput.brake = 0;
}

export function clearAxis(): void {
  virtualInput.axisX = 0;
  virtualInput.axisZ = 0;
}

export function queueJump(): void {
  virtualInput.jumpQueued = true;
}

/** Queue an interact press (E equivalent) — drained by the vehicle system. */
export function queueInteract(): void {
  virtualInput.interactQueued = true;
}

export function setSprint(on: boolean): void {
  virtualInput.sprint = on;
}

export function addZoom(delta: number): void {
  virtualInput.zoomDelta += delta;
}

/** Drop analog stick / sprint / drive inputs so menu or HUD never leaves the player moving. */
export function resetVirtualInput(): void {
  virtualInput.axisX = 0;
  virtualInput.axisZ = 0;
  virtualInput.sprint = false;
  virtualInput.jumpQueued = false;
  virtualInput.interactQueued = false;
  virtualInput.zoomDelta = 0;
  virtualInput.steer = 0;
  virtualInput.throttle = 0;
  virtualInput.brake = 0;
}

/** Drain the pending zoom delta (called once per frame by the camera). */
export function consumeZoom(): number {
  const z = virtualInput.zoomDelta;
  virtualInput.zoomDelta = 0;
  return z;
}
