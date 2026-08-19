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
  /** Accumulated camera zoom delta from +/- buttons or pinch. */
  zoomDelta: 0,
};

export function setAxis(x: number, z: number): void {
  virtualInput.axisX = Math.max(-1, Math.min(1, x));
  virtualInput.axisZ = Math.max(-1, Math.min(1, z));
}

export function clearAxis(): void {
  virtualInput.axisX = 0;
  virtualInput.axisZ = 0;
}

export function queueJump(): void {
  virtualInput.jumpQueued = true;
}

export function setSprint(on: boolean): void {
  virtualInput.sprint = on;
}

export function addZoom(delta: number): void {
  virtualInput.zoomDelta += delta;
}

/** Drop analog stick / sprint so menu or HUD never leaves the player walking. */
export function resetVirtualInput(): void {
  virtualInput.axisX = 0;
  virtualInput.axisZ = 0;
  virtualInput.sprint = false;
  virtualInput.jumpQueued = false;
  virtualInput.zoomDelta = 0;
}

/** Drain the pending zoom delta (called once per frame by the camera). */
export function consumeZoom(): number {
  const z = virtualInput.zoomDelta;
  virtualInput.zoomDelta = 0;
  return z;
}
