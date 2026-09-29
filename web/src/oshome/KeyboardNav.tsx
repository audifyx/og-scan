import { useEffect } from "react";
import { X } from "lucide-react";
import "./oshome.css";

/**
 * Keyboard-first navigation (idea 39).
 *
 *  useOsShortcuts  — global single-key + chord shortcuts (guarded: never
 *                    fires while typing in an input/textarea/select).
 *  useGridArrowNav — arrow keys hop between app tiles (.osh-icon) in a
 *                    grid-aware way; Enter/Space opens the focused tile
 *                    (native button behavior).
 *  ShortcutHelp    — the "?" cheat-sheet overlay.
 */

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.isContentEditable
  );
}

export interface OsShortcuts {
  onPalette: () => void;
  onHelp: () => void;
  onThemes: () => void;
  onDice: () => void;
  onScreenshot: () => void;
}

export function useOsShortcuts(s: OsShortcuts) {
  const ref = { current: s };
  ref.current = s;
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current.onPalette();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping()) return;
      switch (e.key) {
        case "?":
          ref.current.onHelp();
          break;
        case "t":
          ref.current.onThemes();
          break;
        case "d":
          ref.current.onDice();
          break;
        case "s":
          ref.current.onScreenshot();
          break;
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
}

/** Grid-aware arrow navigation across .osh-icon tiles. */
export function useGridArrowNav(rootRef: { current: HTMLElement | null }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
      if (isTyping()) return;
      const root = rootRef.current;
      if (!root) return;
      const active = document.activeElement as HTMLElement | null;
      const onTile = active?.closest?.(".osh-icon");
      // Only hijack arrows when focus is on a tile or on the body itself.
      if (!onTile && active !== document.body) return;
      const tiles = Array.from(root.querySelectorAll<HTMLElement>(".osh-icon"));
      if (tiles.length === 0) return;
      e.preventDefault();
      const from = onTile ?? tiles[0];
      const fr = from.getBoundingClientRect();
      const fx = fr.left + fr.width / 2;
      const fy = fr.top + fr.height / 2;
      let best: HTMLElement | null = null;
      let bestScore = Infinity;
      for (const t of tiles) {
        if (t === from) continue;
        const r = t.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const dx = x - fx;
        const dy = y - fy;
        let primary = 0;
        let secondary = 0;
        if (e.key === "ArrowRight" && dx > 4) { primary = dx; secondary = Math.abs(dy); }
        else if (e.key === "ArrowLeft" && dx < -4) { primary = -dx; secondary = Math.abs(dy); }
        else if (e.key === "ArrowDown" && dy > 4) { primary = dy; secondary = Math.abs(dx); }
        else if (e.key === "ArrowUp" && dy < -4) { primary = -dy; secondary = Math.abs(dx); }
        else continue;
        const score = primary + secondary * 2.5;
        if (score < bestScore) {
          bestScore = score;
          best = t;
        }
      }
      (best ?? (from as HTMLElement)).focus();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [rootRef]);
}

const ROWS: [string, string][] = [
  ["Ctrl/⌘ K", "Command palette — apps + actions"],
  ["?", "This shortcut cheat sheet"],
  ["T", "Open theme settings"],
  ["D", "Surprise-me dice roll"],
  ["S", "Screenshot → X"],
  ["↑ ↓ ← →", "Move between app tiles"],
  ["Enter", "Open the focused tile"],
  ["Esc", "Close any overlay"],
];

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="osh-launcher" onClick={onClose} role="dialog" aria-label="Keyboard shortcuts">
      <div className="osh-launcher-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="osh-settings-head" style={{ padding: "18px 18px 0" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Keyboard shortcuts</h2>
          <button className="osh-x-btn" onClick={onClose} aria-label="Close shortcuts">
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>
        <div style={{ padding: "8px 18px 22px" }}>
          {ROWS.map(([k, desc]) => (
            <div key={k} className="osh-kb-row">
              <kbd className="osh-palette-hint">{k}</kbd>
              <span style={{ fontSize: 13.5 }}>{desc}</span>
            </div>
          ))}
          <p style={{ fontSize: 12, color: "var(--dt-muted)", margin: "12px 0 0" }}>
            Single-key shortcuts never fire while you're typing. Arrow navigation
            works whenever a tile (or nothing) has focus.
          </p>
        </div>
      </div>
    </div>
  );
}
