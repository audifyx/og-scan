/**
 * Custom palette builder (idea 7) — design your own accent, save it,
 * share it with a link.
 *
 * Custom accents persist in localStorage and are registered into the
 * engine via registerAccent() (themes.ts), so they behave exactly like
 * built-ins: one data-accent value, platform-wide.
 *
 * Share format: #palette=<base64url(JSON {name,value,onAccent})>
 * Anyone opening the link gets an "import palette" prompt in the OS home.
 */

import { registerAccent, ACCENTS, type AccentDef } from "./themes";

export const CUSTOM_PALETTES_KEY = "orbitx-custom-palettes";

export interface CustomPalette extends AccentDef {
  /** epoch ms when created */
  createdAt: number;
}

function readCustom(): CustomPalette[] {
  try {
    const arr = JSON.parse(localStorage.getItem(CUSTOM_PALETTES_KEY) || "[]");
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (p) => p && typeof p.id === "string" && typeof p.value === "string"
    );
  } catch {
    return [];
  }
}

function writeCustom(list: CustomPalette[]) {
  try {
    localStorage.setItem(CUSTOM_PALETTES_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function slugify(name: string): string {
  return (
    "custom-" +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24)
  );
}

/** Contrast pick for text on the accent (simple luminance heuristic). */
export function autoOnAccent(hex: string): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.55 ? "#0b0e12" : "#f4f7fb";
}

/** Create + register + persist a custom accent. Returns the registered def. */
export function saveCustomPalette(name: string, value: string, onAccent?: string): CustomPalette {
  const clean = name.trim().slice(0, 28) || "Custom";
  let id = slugify(clean) || `custom-${Date.now().toString(36)}`;
  if (ACCENTS.some((a) => a.id === id)) id = `${id}-${Date.now().toString(36)}`;
  const def: CustomPalette = {
    id,
    name: clean,
    value,
    onAccent: onAccent || autoOnAccent(value),
    createdAt: Date.now(),
  };
  registerAccent(def);
  const list = readCustom();
  list.push(def);
  writeCustom(list);
  return def;
}

export function getCustomPalettes(): CustomPalette[] {
  return readCustom();
}

export function deleteCustomPalette(id: string) {
  writeCustom(readCustom().filter((p) => p.id !== id));
  window.dispatchEvent(new CustomEvent("orbitx:palettes"));
}

/** Re-register every saved custom palette (call once on boot). */
export function restoreCustomPalettes() {
  for (const p of readCustom()) {
    try {
      registerAccent(p);
    } catch {
      /* skip invalid */
    }
  }
}

/* ---------------- share / import ---------------- */

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

/** Build a shareable link for a palette (uses the current page URL). */
export function paletteShareUrl(p: Pick<CustomPalette, "name" | "value" | "onAccent">): string {
  const payload = b64urlEncode(JSON.stringify({ name: p.name, value: p.value, onAccent: p.onAccent }));
  const base = typeof location !== "undefined" ? location.origin + location.pathname : "";
  return `${base}#/palette=${payload}`;
}

/** Parse a #/palette= payload from a URL hash. Null if absent/invalid. */
export function parsePaletteFromHash(
  hash: string
): { name: string; value: string; onAccent: string } | null {
  const m = hash.match(/#\/palette=([A-Za-z0-9\-_]+)/);
  if (!m) return null;
  try {
    const obj = JSON.parse(b64urlDecode(m[1]));
    if (typeof obj?.name === "string" && typeof obj?.value === "string") {
      return {
        name: obj.name.slice(0, 28),
        value: obj.value,
        onAccent: typeof obj.onAccent === "string" ? obj.onAccent : autoOnAccent(obj.value),
      };
    }
  } catch {
    /* invalid payload */
  }
  return null;
}
