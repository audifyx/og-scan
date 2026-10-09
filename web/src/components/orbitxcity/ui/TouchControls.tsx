import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Footprints, Hand, Music2, ZoomIn, ZoomOut } from "lucide-react";
import { addZoom, clearAxis, queueJump, resetVirtualInput, setAxis, setSprint } from "@/lib/orbitxcity/input";
import { useCity } from "@/pages/orbitxcity/CityProvider";

const STICK_RADIUS = 44;

/**
 * Mobile touch controls: left virtual joystick + right action cluster.
 * Writes into the shared input bus consumed by the player controller,
 * so it coexists with keyboard input on hybrid devices.
 */
export function TouchControls() {
  const { interact, activeZone, triggerEmote, panel } = useCity();
  const locked = panel !== "none";

  useEffect(() => () => resetVirtualInput(), []);
  useEffect(() => {
    if (locked) resetVirtualInput();
  }, [locked]);
  const baseRef = useRef<HTMLDivElement>(null);
  const [nub, setNub] = useState({ x: 0, y: 0, active: false });
  const [sprintOn, setSprintOn] = useState(false);
  const pointerId = useRef<number | null>(null);

  const updateFromPointer = useCallback((clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    setNub({ x: dx, y: dy, active: true });
    // Screen up = forward (-z), matching keyboard W
    setAxis(dx / STICK_RADIUS, dy / STICK_RADIUS);
  }, []);

  const onStickDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      pointerId.current = e.pointerId;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updateFromPointer(e.clientX, e.clientY);
    },
    [updateFromPointer],
  );

  const onStickMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pointerId.current !== e.pointerId) return;
      updateFromPointer(e.clientX, e.clientY);
    },
    [updateFromPointer],
  );

  const onStickUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    setNub({ x: 0, y: 0, active: false });
    clearAxis();
  }, []);

  const toggleSprint = useCallback(() => {
    setSprintOn((prev) => {
      const next = !prev;
      setSprint(next);
      return next;
    });
  }, []);

  if (locked) return null;

  return (
    <div className="oxc-touch" aria-label="Touch controls">
      {/* Virtual joystick */}
      <div
        ref={baseRef}
        className={`oxc-stick ${nub.active ? "active" : ""}`}
        onPointerDown={onStickDown}
        onPointerMove={onStickMove}
        onPointerUp={onStickUp}
        onPointerCancel={onStickUp}
      >
        <div className="oxc-stick-ring" />
        <div
          className="oxc-stick-nub"
          style={{ transform: `translate(calc(-50% + ${nub.x}px), calc(-50% + ${nub.y}px))` }}
        />
        <span className="oxc-stick-label">MOVE</span>
      </div>

      {/* Action cluster */}
      <div className="oxc-touch-actions">
        <div className="oxc-touch-row">
          <button type="button" className="oxc-touch-btn small" onPointerDown={() => addZoom(-1.6)} aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button type="button" className="oxc-touch-btn small" onPointerDown={() => addZoom(1.6)} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button type="button" className="oxc-touch-btn small" onPointerDown={() => triggerEmote()} aria-label="Dance">
            <Music2 className="h-4 w-4" />
          </button>
        </div>
        <div className="oxc-touch-row">
          <button
            type="button"
            className={`oxc-touch-btn ${sprintOn ? "on" : ""}`}
            onPointerDown={toggleSprint}
            aria-label="Toggle sprint"
            aria-pressed={sprintOn}
          >
            <Footprints className="h-5 w-5" />
            <span>{sprintOn ? "SPRINT" : "WALK"}</span>
          </button>
          <button
            type="button"
            className={`oxc-touch-btn accent ${activeZone ? "pulse" : ""}`}
            onPointerDown={() => interact()}
            aria-label="Interact"
          >
            <Hand className="h-5 w-5" />
            <span>E</span>
          </button>
          <button type="button" className="oxc-touch-btn jump" onPointerDown={() => queueJump()} aria-label="Jump">
            <ArrowUp className="h-5 w-5" />
            <span>JUMP</span>
          </button>
        </div>
      </div>
    </div>
  );
}
