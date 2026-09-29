/**
 * Icon pack system — reskin every app tile platform-wide.
 * Packs are CSS-driven (via html[data-icon-pack]) plus an optional per-app
 * lucide icon override map for packs that restyle glyphs too.
 */
import {
  AppWindow,
  Boxes,
  Command,
  type LucideIcon,
} from "lucide-react";

export interface IconPackDef {
  id: string;
  name: string;
  blurb: string;
  /** glyph shown in the picker */
  glyph: string;
  /** optional per-app icon overrides (app id → icon) */
  overrides?: Record<string, LucideIcon>;
}

export const ICON_PACKS: IconPackDef[] = [
  {
    id: "native",
    name: "Native",
    blurb: "Each theme's own tile style (default)",
    glyph: "◈",
  },
  {
    id: "neon",
    name: "Neon Outline",
    blurb: "Glowing outline tiles, dark glass centers",
    glyph: "⬡",
  },
  {
    id: "pixel",
    name: "Pixel",
    blurb: "Chunky 8-bit squares, hard edges",
    glyph: "▦",
  },
  {
    id: "mono",
    name: "Mono Ink",
    blurb: "Single-ink glyphs, minimal tiles",
    glyph: "◌",
    overrides: {
      // A couple of signature remaps showing the override mechanism;
      // unlisted apps keep their catalog icon.
      dex: Command,
      city: Boxes,
      games: AppWindow,
    },
  },
];

export const ICON_PACK_KEY = "orbitx-icon-pack";
export const DEFAULT_ICON_PACK = "native";

export function getIconPack(id: string | null): IconPackDef {
  return ICON_PACKS.find((p) => p.id === id) ?? ICON_PACKS[0];
}

/** Resolve the effective icon for an app under a pack (override or catalog). */
export function packIcon(pack: IconPackDef, appId: string, fallback: LucideIcon): LucideIcon {
  return pack.overrides?.[appId] ?? fallback;
}

/* ---------------- persistence + platform-wide apply ---------------- */

export function getIconPackId(): string {
  try {
    const v = localStorage.getItem(ICON_PACK_KEY) || DEFAULT_ICON_PACK;
    return ICON_PACKS.some((p) => p.id === v) ? v : DEFAULT_ICON_PACK;
  } catch {
    return DEFAULT_ICON_PACK;
  }
}

/** Apply the active icon pack as data-icon-pack on <html> (boot + change). */
export function applyIconPack(id: string = getIconPackId()) {
  const ok = ICON_PACKS.some((p) => p.id === id) ? id : DEFAULT_ICON_PACK;
  try {
    localStorage.setItem(ICON_PACK_KEY, ok);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.dataset.iconPack = ok;
    try {
      window.dispatchEvent(new CustomEvent("orbitx:iconpack", { detail: ok }));
    } catch {
      /* ignore */
    }
  }
}
