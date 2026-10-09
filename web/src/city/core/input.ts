/** Unified keyboard + touch input for the open world. */

/** Mutable input state shared between React HUD and the Three.js loop. */
export interface InputState {
  /** Move vector -1..1 (x = strafe/right, y = forward). Keyboard + joystick write here. */
  moveX: number;
  moveY: number;
  sprint: boolean;
  jump: boolean;
  /** Edge-triggered action (enter/exit car). Consumed by the world. */
  action: boolean;
  handbrake: boolean;
}

export function createInput(): InputState {
  return { moveX: 0, moveY: 0, sprint: false, jump: false, action: false, handbrake: false };
}

const KEYMAP: Record<string, "up" | "down" | "left" | "right"> = {
  KeyW: "up", ArrowUp: "up",
  KeyS: "down", ArrowDown: "down",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right",
};

export class KeyboardInput {
  private keys = new Set<string>();
  private input: InputState;
  private onAction: () => void;
  private onPause: () => void;
  private disposed = false;

  constructor(input: InputState, onAction: () => void, onPause: () => void) {
    this.input = input;
    this.onAction = onAction;
    this.onPause = onPause;
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.clear);
  }

  private recompute = () => {
    const k = this.keys;
    const y = (k.has("up") ? 1 : 0) - (k.has("down") ? 1 : 0);
    const x = (k.has("right") ? 1 : 0) - (k.has("left") ? 1 : 0);
    // Keyboard overrides touch axes when active
    if (x !== 0 || y !== 0) {
      this.input.moveX = x;
      this.input.moveY = y;
    } else if (!touchActive) {
      this.input.moveX = 0;
      this.input.moveY = 0;
    }
    this.input.sprint = k.has("sprint") || touchSprint;
    this.input.handbrake = k.has("handbrake");
  };

  private down = (e: KeyboardEvent) => {
    if (this.disposed) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.code === "KeyE") { this.onAction(); return; }
    if (e.code === "Escape" || e.code === "KeyP") { this.onPause(); return; }
    if (e.code === "Space") { this.input.jump = true; e.preventDefault(); return; }
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") { this.keys.add("sprint"); this.recompute(); return; }
    const dir = KEYMAP[e.code];
    if (dir) { this.keys.add(dir); this.recompute(); e.preventDefault(); }
  };

  private up = (e: KeyboardEvent) => {
    if (e.code === "Space") { this.input.jump = false; return; }
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") { this.keys.delete("sprint"); this.recompute(); return; }
    const dir = KEYMAP[e.code];
    if (dir) { this.keys.delete(dir); this.recompute(); }
  };

  private clear = () => {
    this.keys.clear();
    this.input.jump = false;
    this.recompute();
  };

  dispose() {
    this.disposed = true;
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.clear);
  }
}

/** Touch layer writes these; keyboard recompute respects them. */
let touchActive = false;
let touchSprint = false;

export function setTouchMove(x: number, y: number) {
  touchActive = x !== 0 || y !== 0;
}

export function setTouchSprint(v: boolean) {
  touchSprint = v;
}

/** Camera orbit drag (pointer) — the world reads the accumulated deltas. */
export class OrbitDrag {
  dx = 0;
  dy = 0;
  private lastX = 0;
  private lastY = 0;
  private dragging = false;
  private el: HTMLElement;
  private onDown: (x: number, y: number) => boolean;

  /** onDown returns true if the pointer gesture should orbit (not a UI tap). */
  constructor(el: HTMLElement, onDown: (x: number, y: number) => boolean) {
    this.el = el;
    this.onDown = onDown;
    el.addEventListener("pointerdown", this.down);
    window.addEventListener("pointermove", this.move);
    window.addEventListener("pointerup", this.up);
  }

  private down = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
    if (!this.onDown(e.clientX, e.clientY)) return;
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private move = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.dx += e.clientX - this.lastX;
    this.dy += e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private up = () => {
    this.dragging = false;
  };

  consume(): { dx: number; dy: number } {
    const r = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return r;
  }

  dispose() {
    this.el.removeEventListener("pointerdown", this.down);
    window.removeEventListener("pointermove", this.move);
    window.removeEventListener("pointerup", this.up);
  }
}
