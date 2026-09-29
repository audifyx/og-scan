import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Footprints,
  Hand,
  Music2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  addZoom,
  clearAxis,
  clearDrive,
  queueJump,
  resetVirtualInput,
  setAxis,
  setDrive,
  setSprint,
  subscribeDriveMode,
  virtualInput,
} from "@/lib/orbitxcity/input";
import { useCity } from "@/pages/orbitxcity/CityProvider";

const STICK_RADIUS = 44;

/**
 * Mobile touch controls.
 *
 * On foot: left virtual joystick + right action cluster (zoom, dance,
 * sprint, interact/E, jump). Writes into the shared input bus consumed by
 * the player controller.
 *
 * Driving: when the driving worker flips `setDrivingMode(true)` in
 * input.ts, the layout swaps to steering buttons (left) + gas/brake
 * pedals (right) + interact (E, exits the vehicle). Analog values go into
 * virtualInput.steer/throttle/brake, which the driving worker reads.
 */
export function TouchControls() {
  const { interact, activeZone, triggerEmote, panel } = useCity();
  const locked = panel !== "none";
  const [driving, setDriving] = useState(virtualInput.driving);

  useEffect(() => () => resetVirtualInput(), []);
  useEffect(() => {
    if (locked) resetVirtualInput();
  }, [locked]);
  useEffect(() => subscribeDriveMode(setDriving), []);

  if (locked) return null;

  return (
    <div className="oxc-touch" aria-label="Touch controls">
      {driving ? (
        <DriveControls
          activeZone={Boolean(activeZone)}
          onInteract={interact}
          onZoomIn={() => addZoom(-1.6)}
          onZoomOut={() => addZoom(1.6)}
        />
      ) : (
        <WalkControls
          activeZone={Boolean(activeZone)}
          onInteract={interact}
          onEmote={triggerEmote}
          onZoomIn={() => addZoom(-1.6)}
          onZoomOut={() => addZoom(1.6)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- walk */

function WalkControls({
  activeZone,
  onInteract,
  onEmote,
  onZoomIn,
  onZoomOut,
}: {
  activeZone: boolean;
  onInteract: () => void;
  onEmote: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
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

  return (
    <>
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
          <button type="button" className="oxc-touch-btn small" onPointerDown={onZoomIn} aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button type="button" className="oxc-touch-btn small" onPointerDown={onZoomOut} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button type="button" className="oxc-touch-btn small" onPointerDown={onEmote} aria-label="Dance">
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
            onPointerDown={onInteract}
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
    </>
  );
}

/* --------------------------------------------------------------- drive */

function DriveControls({
  activeZone,
  onInteract,
  onZoomIn,
  onZoomOut,
}: {
  activeZone: boolean;
  onInteract: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  const [steer, setSteerHeld] = useState<0 | -1 | 1>(0);
  const [gas, setGas] = useState(false);
  const [brake, setBrake] = useState(false);

  const writeDrive = useCallback((s: -1 | 0 | 1, g: boolean, b: boolean) => {
    setDrive(s, g ? 1 : 0, b ? 1 : 0);
  }, []);

  // Release everything if this view unmounts mid-hold.
  useEffect(() => () => clearDrive(), []);

  const pressSteer = (dir: -1 | 1) => (e: React.PointerEvent) => {
    e.preventDefault();
    setSteerHeld(dir);
    writeDrive(dir, gas, brake);
  };
  const releaseSteer = () => {
    setSteerHeld(0);
    writeDrive(0, gas, brake);
  };
  const pressGas = (e: React.PointerEvent) => {
    e.preventDefault();
    setGas(true);
    writeDrive(steer, true, brake);
  };
  const releaseGas = () => {
    setGas(false);
    writeDrive(steer, false, brake);
  };
  const pressBrake = (e: React.PointerEvent) => {
    e.preventDefault();
    setBrake(true);
    writeDrive(steer, gas, true);
  };
  const releaseBrake = () => {
    setBrake(false);
    writeDrive(steer, gas, false);
  };

  return (
    <>
      {/* Steering — bottom-left where the walk stick lives */}
      <div className="oxc-touch-actions" style={{ left: "1.1rem", right: "auto", bottom: "6.2rem" }}>
        <div className="oxc-touch-row" aria-label="Steering">
          <button
            type="button"
            className={`oxc-touch-btn ${steer === -1 ? "on" : ""}`}
            onPointerDown={pressSteer(-1)}
            onPointerUp={releaseSteer}
            onPointerCancel={releaseSteer}
            onPointerLeave={releaseSteer}
            aria-label="Steer left"
          >
            <ChevronLeft className="h-6 w-6" />
            <span>LEFT</span>
          </button>
          <button
            type="button"
            className={`oxc-touch-btn ${steer === 1 ? "on" : ""}`}
            onPointerDown={pressSteer(1)}
            onPointerUp={releaseSteer}
            onPointerCancel={releaseSteer}
            onPointerLeave={releaseSteer}
            aria-label="Steer right"
          >
            <ChevronRight className="h-6 w-6" />
            <span>RIGHT</span>
          </button>
        </div>
        <div className="oxc-touch-row">
          <button type="button" className="oxc-touch-btn small" onPointerDown={onZoomIn} aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button type="button" className="oxc-touch-btn small" onPointerDown={onZoomOut} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Pedals — bottom-right */}
      <div className="oxc-touch-actions" aria-label="Pedals">
        <div className="oxc-touch-row">
          <button
            type="button"
            className={`oxc-touch-btn ${gas ? "on" : ""}`}
            onPointerDown={pressGas}
            onPointerUp={releaseGas}
            onPointerCancel={releaseGas}
            onPointerLeave={releaseGas}
            aria-label="Gas pedal"
          >
            <ArrowUp className="h-6 w-6" />
            <span>GAS</span>
          </button>
          <button
            type="button"
            className="oxc-touch-btn"
            style={brake ? { borderColor: "#ff4d5e", color: "#ff4d5e" } : undefined}
            onPointerDown={pressBrake}
            onPointerUp={releaseBrake}
            onPointerCancel={releaseBrake}
            onPointerLeave={releaseBrake}
            aria-label="Brake pedal"
          >
            <ArrowDown className="h-6 w-6" />
            <span>BRK</span>
          </button>
        </div>
        <div className="oxc-touch-row">
          <button
            type="button"
            className={`oxc-touch-btn accent small ${activeZone ? "pulse" : ""}`}
            onPointerDown={onInteract}
            aria-label="Interact — exit vehicle"
          >
            <Hand className="h-4 w-4" />
            <span>E</span>
          </button>
        </div>
      </div>
    </>
  );
}
