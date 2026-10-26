/**
 * OrbitX OS — window manager. Pure reducer, no React, no DOM, so the
 * z-order / single-instance / minimize rules are unit-testable.
 *
 * Windows are single-instance per id: opening an already-open app focuses
 * it (and un-minimizes) instead of stacking a duplicate. Geometry (x, y, w,
 * h) is computed by the Desktop shell at open time — the reducer only
 * stores it — because centering needs the viewport size.
 */

export type OsWindowKind =
  | "app"
  | "settings"
  | "apps"
  | "pulse"
  | "widgets"
  | "widget-library"
  | "browser"
  | "store"
  | "themes"
  | "feed"
  | "notes"
  | "files";

export interface OsWindow {
  /** Built-ins use their kind as id; apps use `app:<key>`. */
  id: string;
  kind: OsWindowKind;
  appKey?: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  /** Pinned windows render above every normal window (mini-player). */
  pinned?: boolean;
  /** App windows opened to a specific URL (e.g. DEX with ?mint=…). */
  hrefOverride?: string;
  /** Virtual desktop this window lives on (undefined = all desktops). */
  desktopId?: string;
}

export interface OsWindowsState {
  windows: OsWindow[];
  zTop: number;
}

export const EMPTY_OS_WINDOWS: OsWindowsState = { windows: [], zTop: 0 };

export type OsWindowsAction =
  | { type: "open"; window: Omit<OsWindow, "z" | "minimized" | "maximized"> }
  | { type: "close"; id: string }
  | { type: "focus"; id: string }
  | { type: "minimize"; id: string }
  | { type: "restore"; id: string }
  | { type: "toggle-maximize"; id: string }
  | { type: "toggle-pin"; id: string }
  | { type: "move"; id: string; x: number; y: number }
  | { type: "resize"; id: string; w: number; h: number }
  | { type: "snap"; id: string; x: number; y: number; w: number; h: number };

export function osWindowsReducer(
  state: OsWindowsState,
  action: OsWindowsAction,
): OsWindowsState {
  switch (action.type) {
    case "open": {
      const existing = state.windows.find((w) => w.id === action.window.id);
      if (existing) {
        // Single instance: focus + un-minimize instead of duplicating.
        const zTop = state.zTop + 1;
        return {
          zTop,
          windows: state.windows.map((w) =>
            w.id === existing.id ? { ...w, z: zTop, minimized: false } : w,
          ),
        };
      }
      const zTop = state.zTop + 1;
      return {
        zTop,
        windows: [
          ...state.windows,
          { ...action.window, z: zTop, minimized: false, maximized: false },
        ],
      };
    }
    case "close":
      return { ...state, windows: state.windows.filter((w) => w.id !== action.id) };
    case "focus": {
      const zTop = state.zTop + 1;
      return {
        zTop,
        windows: state.windows.map((w) => (w.id === action.id ? { ...w, z: zTop } : w)),
      };
    }
    case "minimize":
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id ? { ...w, minimized: true } : w,
        ),
      };
    case "restore":
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id ? { ...w, minimized: false } : w,
        ),
      };
    case "toggle-maximize":
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id ? { ...w, maximized: !w.maximized } : w,
        ),
      };
    case "toggle-pin":
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id ? { ...w, pinned: !w.pinned } : w,
        ),
      };
    case "snap":
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id
            ? { ...w, x: action.x, y: action.y, w: action.w, h: action.h, maximized: false }
            : w,
        ),
      };
    case "move":
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id ? { ...w, x: action.x, y: action.y } : w,
        ),
      };
    case "resize":
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id
            ? { ...w, w: Math.max(320, action.w), h: Math.max(240, action.h) }
            : w,
          ),
      };
    default:
      return state;
  }
}

/** The window on top of the stack (ignoring minimized ones for focus). */
export function topWindow(state: OsWindowsState): OsWindow | null {
  const visible = state.windows.filter((w) => !w.minimized);
  if (!visible.length) return null;
  return visible.reduce((a, b) => (b.z > a.z ? b : a));
}
