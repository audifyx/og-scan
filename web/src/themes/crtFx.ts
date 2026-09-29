/**
 * CRT shader controls (ideas 24 + 25) — platform-wide CRT filter toggle
 * plus scanline & pixelation intensity sliders.
 *
 * Writes to <html>:
 *   data-crt-fx="on"            — global scanline/phosphor overlay (any theme)
 *   --dt-scanline: 0..1         — scanline opacity
 *   --dt-phosphor: 0..1         — phosphor glow strength
 *   --dt-pixel: px              — pixelation cell size (0 = off)
 *
 * The "Retro CRT" device theme keeps its own full look (css/crt.css);
 * this is the *filter* you can layer over any other theme.
 */

export const CRT_FX_KEY = "orbitx-crt-fx";
export const CRT_SCANLINE_KEY = "orbitx-crt-scanline";
export const CRT_PHOSPHOR_KEY = "orbitx-crt-phosphor";
export const CRT_PIXEL_KEY = "orbitx-crt-pixel";

export interface CrtFxSettings {
  enabled: boolean;
  /** 0..1 */
  scanline: number;
  /** 0..1 */
  phosphor: number;
  /** pixel cell size in px, 0 = off */
  pixel: number;
}

export const DEFAULT_CRT_FX: CrtFxSettings = {
  enabled: false,
  scanline: 0.28,
  phosphor: 0.5,
  pixel: 0,
};

function num(key: string, fb: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : fb;
  } catch {
    return fb;
  }
}

export function getCrtFx(): CrtFxSettings {
  try {
    return {
      enabled: localStorage.getItem(CRT_FX_KEY) === "1",
      scanline: num(CRT_SCANLINE_KEY, DEFAULT_CRT_FX.scanline),
      phosphor: num(CRT_PHOSPHOR_KEY, DEFAULT_CRT_FX.phosphor),
      pixel: num(CRT_PIXEL_KEY, DEFAULT_CRT_FX.pixel),
    };
  } catch {
    return { ...DEFAULT_CRT_FX };
  }
}

function set(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* storage may be unavailable */
  }
}

/** Apply the current settings to <html> (call on boot + on change). */
export function applyCrtFx(s: CrtFxSettings = getCrtFx()) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (s.enabled) el.dataset.crtFx = "on";
  else delete el.dataset.crtFx;
  el.style.setProperty("--dt-scanline", String(Math.min(1, Math.max(0, s.scanline))));
  el.style.setProperty("--dt-phosphor", String(Math.min(1, Math.max(0, s.phosphor))));
  el.style.setProperty("--dt-pixel", `${Math.max(0, Math.round(s.pixel))}px`);
  // Pixelation mosaic lives on the wallpaper layer (see crt.css).
  const wp = document.querySelector(".osh-wallpaper");
  if (wp) {
    if (s.enabled && s.pixel > 0) wp.setAttribute("data-pixelated", "1");
    else wp.removeAttribute("data-pixelated");
  }
  try {
    window.dispatchEvent(new CustomEvent("orbitx:crtfx", { detail: s }));
  } catch {
    /* ignore */
  }
}

export function setCrtFxEnabled(v: boolean) {
  set(CRT_FX_KEY, v ? "1" : "0");
  applyCrtFx();
}

export function setCrtScanline(v: number) {
  set(CRT_SCANLINE_KEY, String(v));
  applyCrtFx();
}

export function setCrtPhosphor(v: number) {
  set(CRT_PHOSPHOR_KEY, String(v));
  applyCrtFx();
}

export function setCrtPixel(px: number) {
  set(CRT_PIXEL_KEY, String(px));
  applyCrtFx();
}
