import { useCallback, useEffect, useRef } from "react";

export type FlightStick = { x: number; y: number; z: number; boost: boolean };

const IDLE: FlightStick = { x: 0, y: 0, z: 0, boost: false };

function clampStick(x: number, y: number, z: number, boost: boolean): FlightStick {
  const mag = Math.hypot(x, y);
  const scale = mag > 1 ? 1 / mag : 1;
  const nx = mag < 0.08 ? 0 : x * scale;
  const ny = mag < 0.08 ? 0 : y * scale;
  const nz = Math.abs(z) < 0.08 ? 0 : Math.max(-1, Math.min(1, z));
  return { x: nx, y: ny, z: nz, boost };
}

export function WorldJoystick({
  value,
  onChange,
}: {
  value: FlightStick;
  onChange: (stick: FlightStick) => void;
}) {
  const pad = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const keys = useRef(new Set<string>());
  const pointer = useRef({ x: 0, y: 0 });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const emitCombined = useCallback(() => {
    let x = pointer.current.x;
    let y = pointer.current.y;
    let z = 0;
    const k = keys.current;
    if (k.has("ArrowLeft") || k.has("a") || k.has("A")) x -= 1;
    if (k.has("ArrowRight") || k.has("d") || k.has("D")) x += 1;
    if (k.has("ArrowUp") || k.has("w") || k.has("W")) y -= 1;
    if (k.has("ArrowDown") || k.has("s") || k.has("S")) y += 1;
    if (k.has("q") || k.has("Q") || k.has(" ")) z += 1;
    if (k.has("e") || k.has("E") || k.has("c") || k.has("C")) z -= 1;
    const boost = k.has("Shift") || k.has("ShiftLeft") || k.has("ShiftRight");
    const pads = typeof navigator !== "undefined" ? navigator.getGamepads?.() || [] : [];
    for (const pad of pads) {
      if (!pad) continue;
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      const az = -(pad.axes[3] || 0);
      if (Math.hypot(ax, ay) < 0.22 && Math.abs(az) < 0.22 && !pad.buttons[0]?.pressed && !pad.buttons[7]?.pressed) {
        continue;
      }
      x += ax;
      y += ay;
      z += az;
      if (pad.buttons[0]?.pressed || pad.buttons[7]?.pressed) {
        onChangeRef.current(clampStick(x, y, z, true));
        return;
      }
    }
    onChangeRef.current(clampStick(x, y, z, boost));
  }, []);

  const fromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = pad.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const dx = (clientX - (box.left + box.width / 2)) / (box.width / 2);
      const dy = (clientY - (box.top + box.height / 2)) / (box.height / 2);
      pointer.current = {
        x: Math.max(-1, Math.min(1, dx)),
        y: Math.max(-1, Math.min(1, dy)),
      };
      emitCombined();
    },
    [emitCombined],
  );

  useEffect(() => {
    const up = () => {
      active.current = false;
      pointer.current = { x: 0, y: 0 };
      emitCombined();
    };
    const move = (e: PointerEvent) => {
      if (!active.current) return;
      fromPointer(e.clientX, e.clientY);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("pointermove", move);
    };
  }, [emitCombined, fromPointer]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      keys.current.add(e.key);
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "w",
          "a",
          "s",
          "d",
          "W",
          "A",
          "S",
          "D",
          "q",
          "Q",
          "e",
          "E",
          "c",
          "C",
          " ",
          "Shift",
        ].includes(e.key)
      ) {
        e.preventDefault();
        emitCombined();
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.key);
      emitCombined();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [emitCombined]);

  useEffect(() => {
    let raf = 0;
    let running = false;
    const loop = () => {
      const pads = typeof navigator !== "undefined" ? navigator.getGamepads?.() || [] : [];
      const live = pads.some(
        (p) =>
          p &&
          (Math.hypot(p.axes[0] || 0, p.axes[1] || 0) > 0.22 ||
            Math.abs(p.axes[3] || 0) > 0.22 ||
            p.buttons[0]?.pressed ||
            p.buttons[7]?.pressed),
      );
      if (live) emitCombined();
      if (running) raf = window.requestAnimationFrame(loop);
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = window.requestAnimationFrame(loop);
    };
    if ([...(typeof navigator !== "undefined" ? navigator.getGamepads?.() || [] : [])].some(Boolean)) start();
    window.addEventListener("gamepadconnected", start);
    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("gamepadconnected", start);
    };
  }, [emitCombined]);

  const knobX = value.x * 34;
  const knobY = value.y * 34;
  const flying = Math.abs(value.x) > 0.04 || Math.abs(value.y) > 0.04 || Math.abs(value.z) > 0.04;

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-20 select-none">
      <div
        ref={pad}
        className="relative size-28 rounded-full border border-line bg-bg-sunken/80 shadow-[0_12px_40px_rgb(0_0_0_/_0.45)] backdrop-blur-sm"
        onPointerDown={(e) => {
          active.current = true;
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          fromPointer(e.clientX, e.clientY);
        }}
      >
        <span className="absolute inset-6 rounded-full border border-line/70" />
        <span
          className="absolute left-1/2 top-1/2 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-2/80 shadow-[0_0_18px_rgb(139_92_246_/_0.45)]"
          style={{ transform: `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))` }}
        />
      </div>
      <p className="mt-1 text-center text-2xs tracking-[0.16em] text-dim">
        WASD / STICK{value.boost ? " · BOOST" : flying ? " · FLY" : ""}
      </p>
      <p className="text-center text-[9px] tracking-[0.12em] text-dim/80">Q/E UP·DOWN · SHIFT BOOST</p>
    </div>
  );
}

export const IDLE_STICK = IDLE;
