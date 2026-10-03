/**
 * OrbitX Device Theme Engine — registry.
 *
 * Device themes re-skin the ENTIRE platform (layout, chrome, typography,
 * iconography, motion) via `data-device-theme` on <html> + CSS custom
 * properties. Backgrounds (wallpapers) and accent colors are separate,
 * independently-selectable axes.
 *
 * Nothing here touches the product themes in hooks/useTheme.tsx — that
 * system stays as-is. This engine is purely additive.
 */

export type OsLayoutKind =
  | "orbit" // OrbitX native: apps orbit a live core
  | "grid" // iOS / Android: icon grid + dock
  | "xmb" // PS4: XMB cross-media bar
  | "blades" // Xbox 360: blade tabs
  | "channels" // Wii: channel tiles
  | "dual" // Nintendo 3DS: top screen + touch screen
  | "pixel" // Game Boy: monochrome pixel list
  | "taskbar" // Windows / Linux: desktop + taskbar
  | "menubar" // macOS: menu bar + dock
  | "terminal"; // Retro CRT: terminal list

export interface DeviceThemeDef {
  id: string;
  name: string;
  maker: string;
  blurb: string;
  layout: OsLayoutKind;
  /** Preview swatch for the picker (css gradient stops). */
  preview: { from: string; to: string; glyph: string };
  /** Glyph shown on the OS home for this theme family. */
  tagline: string;
}

export const DEVICE_THEMES: DeviceThemeDef[] = [
  {
    id: "orbitx",
    name: "OrbitX Native",
    maker: "OrbitX",
    blurb: "Neon cyberpunk command deck. Apps orbit a live core.",
    layout: "orbit",
    preview: { from: "#17ff4d", to: "#04140a", glyph: "◉" },
    tagline: "The mothership look",
  },
  {
    id: "xbox360",
    name: "Xbox 360",
    maker: "Homage",
    blurb: "Blades interface homage — angled tabs, glossy panels.",
    layout: "blades",
    preview: { from: "#9dce0a", to: "#1a2b12", glyph: "▸" },
    tagline: "Blades are back",
  },
  {
    id: "ps4",
    name: "PlayStation 4",
    maker: "Homage",
    blurb: "XMB cross-media bar homage — glide across categories.",
    layout: "xmb",
    preview: { from: "#0070d1", to: "#03101f", glyph: "✕" },
    tagline: "Cross-media bar",
  },
  {
    id: "wii",
    name: "Wii",
    maker: "Homage",
    blurb: "Channels grid homage — bubbly tiles and a big clock.",
    layout: "channels",
    preview: { from: "#8fd8f8", to: "#eef7fc", glyph: "◐" },
    tagline: "Pick a channel",
  },
  {
    id: "n3ds",
    name: "Nintendo 3DS",
    maker: "Homage",
    blurb: "Dual-screen homage — top screen showcase, touch grid below.",
    layout: "dual",
    preview: { from: "#e60012", to: "#1c0408", glyph: "▤" },
    tagline: "3D, no glasses needed",
  },
  {
    id: "gameboy",
    name: "Game Boy",
    maker: "Homage",
    blurb: "Pixel monochrome. Four shades of green, zero mercy.",
    layout: "pixel",
    preview: { from: "#9bbc0f", to: "#0f380f", glyph: "▓" },
    tagline: "Dot-matrix forever",
  },
  {
    id: "windows",
    name: "Windows PC",
    maker: "Homage",
    blurb: "Desktop, taskbar and Start menu. Recycle Bin not included.",
    layout: "taskbar",
    preview: { from: "#0078d4", to: "#0a1a2f", glyph: "▦" },
    tagline: "It's giving 2009",
  },
  {
    id: "ios",
    name: "iOS",
    maker: "Homage",
    blurb: "Squircles, springboard grid and a glass dock.",
    layout: "grid",
    preview: { from: "#0a84ff", to: "#0b1020", glyph: "◈" },
    tagline: "There's an app for that",
  },
  {
    id: "macos",
    name: "macOS",
    maker: "Homage",
    blurb: "Menu bar up top, magnifying dock down low.",
    layout: "menubar",
    preview: { from: "#b9c4d4", to: "#10141c", glyph: "●" },
    tagline: "It just works",
  },
  {
    id: "linux",
    name: "Linux",
    maker: "Homage",
    blurb: "GNOME-style top bar, Activities overview, orange soul.",
    layout: "taskbar",
    preview: { from: "#e95420", to: "#1c0f08", glyph: "⬢" },
    tagline: "I use Arch, btw",
  },
  {
    id: "android",
    name: "Android",
    maker: "Homage",
    blurb: "Material You — pills, blobs and dynamic color.",
    layout: "grid",
    preview: { from: "#3ddc84", to: "#08130d", glyph: "▲" },
    tagline: "Be together, not the same",
  },
  {
    id: "crt",
    name: "Retro CRT",
    maker: "OrbitX",
    blurb: "Phosphor terminal. Scanlines, glow, and a blinking cursor.",
    layout: "terminal",
    preview: { from: "#33ff66", to: "#020604", glyph: "▮" },
    tagline: "WARMING UP THE TUBE…",
  },
  {
    id: "seriesx",
    name: "Xbox Series X",
    maker: "Homage",
    blurb: "Carbon-black grid homage — sharp tiles, power-green glow.",
    layout: "grid",
    preview: { from: "#52c54b", to: "#0b0d0a", glyph: "◉" },
    tagline: "Power your dreams",
  },
  {
    id: "ps5",
    name: "PlayStation 5",
    maker: "Homage",
    blurb: "Next-gen XMB homage — deep ink, frosted rail, white glow.",
    layout: "xmb",
    preview: { from: "#7aa8ff", to: "#06070c", glyph: "△" },
    tagline: "Play has no limits",
  },
  {
    id: "switch",
    name: "Nintendo Switch",
    maker: "Homage",
    blurb: "Channel tiles homage — charcoal UI, red ring on hover.",
    layout: "channels",
    preview: { from: "#e60012", to: "#2b2d30", glyph: "◈" },
    tagline: "Switch and play",
  },
  {
    id: "wiiu",
    name: "Wii U",
    maker: "Homage",
    blurb: "Dual-screen homage — TV showcase above the gamepad grid.",
    layout: "dual",
    preview: { from: "#0a5abe", to: "#dfe7f0", glyph: "▦" },
    tagline: "Asymmetric play",
  },
];

export interface BackgroundThemeDef {
  id: string;
  name: string;
  blurb: string;
  /** CSS value applied to the wallpaper layer. */
  css: string;
  dark: boolean;
}

export const BACKGROUND_THEMES: BackgroundThemeDef[] = [
  {
    id: "nebula",
    name: "Nebula",
    blurb: "Deep-space lime nebula (default)",
    css: "radial-gradient(1100px 620px at 18% -8%, rgba(23,255,77,.16), transparent 55%), radial-gradient(900px 560px at 88% 4%, rgba(61,231,255,.12), transparent 52%), radial-gradient(760px 680px at 50% 118%, rgba(245,197,66,.07), transparent 55%), linear-gradient(180deg,#05080c 0%,#070b12 52%,#04070b 100%)",
    dark: true,
  },
  {
    id: "midnight",
    name: "Midnight",
    blurb: "Near-black with a blue hour glow",
    css: "radial-gradient(1000px 600px at 80% -10%, rgba(58,110,255,.22), transparent 55%), linear-gradient(180deg,#030509 0%,#060a13 100%)",
    dark: true,
  },
  {
    id: "aurora",
    name: "Aurora",
    blurb: "Slow-shifting polar lights",
    css: "linear-gradient(180deg,#040a08 0%,#05080c 100%)",
    dark: true,
  },
  {
    id: "sunset",
    name: "Sunset",
    blurb: "After-hours orange fade",
    css: "radial-gradient(900px 500px at 50% 110%, rgba(255,107,53,.35), transparent 60%), linear-gradient(180deg,#140a06 0%,#1e0f08 60%,#0a0503 100%)",
    dark: true,
  },
  {
    id: "ocean",
    name: "Ocean",
    blurb: "Deep cyan trench",
    css: "radial-gradient(1000px 620px at 15% 110%, rgba(61,231,255,.18), transparent 55%), linear-gradient(180deg,#031014 0%,#041a20 60%,#02090c 100%)",
    dark: true,
  },
  {
    id: "matrix",
    name: "Matrix Rain",
    blurb: "Falling code, pure green",
    css: "linear-gradient(180deg,#020604 0%,#031007 100%)",
    dark: true,
  },
  {
    id: "grid",
    name: "Cyber Grid",
    blurb: "Perspective grid over void",
    css: "linear-gradient(180deg,#04060a 0%,#05080c 100%)",
    dark: true,
  },
  {
    id: "bliss",
    name: "Bliss",
    blurb: "Rolling green hills energy",
    css: "linear-gradient(180deg,#2f8fd0 0%,#7cc4e8 55%,#5da24a 56%,#3d7a33 100%)",
    dark: false,
  },
  {
    id: "paper",
    name: "Paper",
    blurb: "Clean light mode",
    css: "linear-gradient(180deg,#f4f6fa 0%,#e8edf4 100%)",
    dark: false,
  },
  {
    id: "void",
    name: "Void",
    blurb: "Pure black. Nothing else.",
    css: "#000",
    dark: true,
  },
];

export interface AccentDef {
  id: string;
  name: string;
  value: string;
  onAccent: string;
}

export const ACCENTS: AccentDef[] = [
  { id: "lime", name: "Orbit Lime", value: "#17ff4d", onAccent: "#04140a" },
  { id: "cyan", name: "Ion Cyan", value: "#3de7ff", onAccent: "#06222a" },
  { id: "gold", name: "Degen Gold", value: "#f5c542", onAccent: "#241a04" },
  { id: "pink", name: "Neon Pink", value: "#ff4d9a", onAccent: "#2a0716" },
  { id: "violet", name: "Void Violet", value: "#a78bfa", onAccent: "#180f38" },
  { id: "orange", name: "Blaze Orange", value: "#ff6b35", onAccent: "#2b0e04" },
  { id: "blue", name: "Signal Blue", value: "#5b8cff", onAccent: "#0a1440" },
  { id: "red", name: "Alert Red", value: "#ff4d5e", onAccent: "#2b060a" },
];

export const DEVICE_THEME_KEY = "orbitx-device-theme";
export const BG_THEME_KEY = "orbitx-bg-theme";
export const ACCENT_KEY = "orbitx-accent";
export const OS_LAYOUT_KEY = "orbitx-os-layout-v2";

export const DEFAULT_DEVICE_THEME = "orbitx";
export const DEFAULT_BG_THEME = "nebula";
export const DEFAULT_ACCENT = "lime";

export function getDeviceTheme(id: string | null): DeviceThemeDef {
  return DEVICE_THEMES.find((t) => t.id === id) ?? DEVICE_THEMES[0];
}
export function getBackground(id: string | null): BackgroundThemeDef {
  return BACKGROUND_THEMES.find((t) => t.id === id) ?? BACKGROUND_THEMES[0];
}
export function getAccent(id: string | null): AccentDef {
  return ACCENTS.find((t) => t.id === id) ?? ACCENTS[0];
}

/* ==========================================================================
   Phase 2 — runtime registries (Theme SDK backing).
   Third-party / user-built themes, accents, and backgrounds can be
   registered at runtime. CSS for custom accents/backgrounds is injected
   as a <style> tag following the same data-attribute contract as base.css,
   so the provider needs no changes to apply them platform-wide.
   ========================================================================== */

const injectedStyleIds = new Set<string>();

function injectThemeCss(styleId: string, css: string) {
  if (typeof document === "undefined" || injectedStyleIds.has(styleId)) return;
  const el = document.createElement("style");
  el.id = styleId;
  el.textContent = css;
  document.head.appendChild(el);
  injectedStyleIds.add(styleId);
}

function validId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-_]{1,31}$/.test(id);
}

/**
 * Register a third-party device theme at runtime (Theme SDK).
 * The theme's CSS must be loaded separately (see themeScaffold.ts) — this
 * only adds the definition to the picker/provider registries.
 */
export function registerDeviceTheme(def: DeviceThemeDef): DeviceThemeDef {
  if (!validId(def.id)) throw new Error(`registerDeviceTheme: bad id "${def.id}"`);
  if (!DEVICE_THEMES.some((t) => t.id === def.id)) DEVICE_THEMES.push(def);
  return def;
}

/** Register a custom accent (e.g. from the palette builder) at runtime. */
export function registerAccent(def: AccentDef): AccentDef {
  if (!validId(def.id)) throw new Error(`registerAccent: bad id "${def.id}"`);
  if (!ACCENTS.some((a) => a.id === def.id)) ACCENTS.push(def);
  const soft = def.value + "22"; // ~13% alpha hex suffix
  injectThemeCss(
    `dt-accent-${def.id}`,
    `html[data-accent="${def.id}"]{--dt-accent:${def.value};--dt-on-accent:${def.onAccent};--dt-accent-soft:${soft};}`
  );
  return def;
}

/** Register a custom background (static CSS wallpaper) at runtime. */
export function registerBackground(def: BackgroundThemeDef): BackgroundThemeDef {
  if (!validId(def.id)) throw new Error(`registerBackground: bad id "${def.id}"`);
  if (!BACKGROUND_THEMES.some((b) => b.id === def.id)) BACKGROUND_THEMES.push(def);
  injectThemeCss(
    `dt-bg-${def.id}`,
    `html[data-bg-theme="${def.id}"]{--dt-wallpaper:${def.css};}`
  );
  return def;
}
