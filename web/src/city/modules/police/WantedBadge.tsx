/**
 * OrbitXCity — Police module: wanted-level HUD chip.
 *
 * GTA-style flashing stars in the corner while wanted. Pure presentational —
 * the integrator places it over the canvas and feeds nothing.
 */

import { heatColor, starGlyph, tacticLabel } from "./ui";
import type { PursuitSnapshot, WantedStars } from "./types";
import "./police.css";

export interface WantedBadgeProps {
  stars: WantedStars;
  /** Live pursuit snapshot (optional — shows tactic + closest unit). */
  pursuit?: PursuitSnapshot | null;
  onOpen: () => void;
}

export function WantedBadge({ stars, pursuit, onOpen }: WantedBadgeProps) {
  if (stars === 0) return null;
  const color = heatColor(stars);
  return (
    <button
      type="button"
      className="ox-pol-badge"
      style={{ borderColor: color, boxShadow: `0 0 18px ${color}55` }}
      onClick={onOpen}
      aria-label={`${stars} star wanted level — open police options`}
    >
      <span className="ox-pol-badge-stars" style={{ color }}>
        {starGlyph(stars)}
      </span>
      {pursuit?.active && (
        <span className="ox-pol-badge-sub">
          {tacticLabel(pursuit.tactic)}
          {pursuit.closest !== Infinity && ` · ${Math.round(pursuit.closest)}m`}
        </span>
      )}
      <span className="ox-pol-badge-sub ox-pol-badge-hint">tap: bribe / surrender</span>
    </button>
  );
}
