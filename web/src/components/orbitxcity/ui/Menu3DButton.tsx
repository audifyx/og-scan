/**
 * Extruded metallic 3D title-screen buttons with pointer-follow tilt.
 */
import { useCallback, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

interface Menu3DButtonProps {
  label: string;
  hint: string;
  primary?: boolean;
  focused?: boolean;
  delayMs?: number;
  accent?: string;
  onClick: () => void;
  onFocus: () => void;
}

function setTilt(el: HTMLElement, xDeg: number, yDeg: number) {
  el.style.setProperty("--tilt-x", `${xDeg.toFixed(2)}deg`);
  el.style.setProperty("--tilt-y", `${yDeg.toFixed(2)}deg`);
}

export function Menu3DButton({
  label,
  hint,
  primary = false,
  focused = false,
  delayMs = 0,
  accent,
  onClick,
  onFocus,
}: Menu3DButtonProps) {
  const slabRef = useRef<HTMLSpanElement>(null);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const slab = slabRef.current;
    if (!slab) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
    const py = (event.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
    setTilt(slab, 20 - py * 12, -12 + px * 18);
  }, []);

  const onPointerLeave = useCallback(() => {
    const slab = slabRef.current;
    if (!slab) return;
    setTilt(slab, 22, -12);
  }, []);

  return (
    <button
      type="button"
      className={`oxc-btn3d ${primary ? "oxc-btn3d--primary" : ""} ${focused ? "is-focus" : ""}`}
      style={
        {
          animationDelay: `${delayMs}ms`,
          ["--btn3d-accent" as string]: accent,
        } as CSSProperties
      }
      onMouseEnter={onFocus}
      onFocus={onFocus}
      onClick={onClick}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <span className="oxc-btn3d-shadow" aria-hidden />
      <span ref={slabRef} className="oxc-btn3d-slab">
        <span className="oxc-btn3d-edge" aria-hidden />
        <span className="oxc-btn3d-side" aria-hidden />
        <span className="oxc-btn3d-top" aria-hidden />
        <span className="oxc-btn3d-face">
          <span className="oxc-btn3d-sheen" aria-hidden />
          <span className="oxc-btn3d-gem" aria-hidden />
          <span className="oxc-btn3d-copy">
            <span className="oxc-btn3d-label">{label}</span>
            <span className="oxc-btn3d-hint">{hint}</span>
          </span>
        </span>
      </span>
    </button>
  );
}

interface Menu3DChipProps {
  label: string;
  accent: string;
  active: boolean;
  onClick: () => void;
}

export function Menu3DChip({ label, accent, active, onClick }: Menu3DChipProps) {
  return (
    <button
      type="button"
      className={`oxc-chip3d ${active ? "is-on" : ""}`}
      style={{ ["--chip" as string]: accent }}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="oxc-chip3d-slab">
        <span className="oxc-chip3d-edge" aria-hidden />
        <span className="oxc-chip3d-face">{label}</span>
      </span>
    </button>
  );
}
