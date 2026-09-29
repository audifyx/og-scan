/**
 * Animated wallpaper engine (idea 9).
 *
 * Canvas-rendered animated wallpapers, independent of the static
 * background axis. Active wallpaper is stored in localStorage and
 * applied as data-awallpaper on <html>; WallpaperCanvas (oshome)
 * renders the scene. "none" = fall back to the static CSS wallpaper.
 *
 * Scenes are lightweight rAF loops (capped DPR, pause when tab hidden,
 * disabled under prefers-reduced-motion).
 */

export type WallpaperScene =
  | "starfield"
  | "aurora"
  | "matrix"
  | "nebula"
  | "cityflyover";

export interface AnimatedWallpaperDef {
  id: string;
  scene: WallpaperScene;
  name: string;
  blurb: string;
}

export const ANIMATED_WALLPAPERS: AnimatedWallpaperDef[] = [
  { id: "none", scene: "starfield", name: "Off", blurb: "Static CSS wallpaper only" },
  { id: "starfield", scene: "starfield", name: "Starfield", blurb: "Drifting star parallax" },
  { id: "aurora", scene: "aurora", name: "Aurora", blurb: "Slow polar ribbons" },
  { id: "matrix", scene: "matrix", name: "Code Rain", blurb: "Falling glyph streams" },
  { id: "nebula", scene: "nebula", name: "Nebula Drift", blurb: "Breathing gas clouds" },
  { id: "cityflyover", scene: "cityflyover", name: "City Flyover", blurb: "Neon skyline drift" },
];

export const AWALLPAPER_KEY = "orbitx-animated-wallpaper";
export const DEFAULT_AWALLPAPER = "none";

export function getAnimatedWallpaper(): string {
  try {
    const v = localStorage.getItem(AWALLPAPER_KEY) || DEFAULT_AWALLPAPER;
    return ANIMATED_WALLPAPERS.some((w) => w.id === v) ? v : DEFAULT_AWALLPAPER;
  } catch {
    return DEFAULT_AWALLPAPER;
  }
}

export function setAnimatedWallpaper(id: string) {
  const ok = ANIMATED_WALLPAPERS.some((w) => w.id === id) ? id : DEFAULT_AWALLPAPER;
  try {
    localStorage.setItem(AWALLPAPER_KEY, ok);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.dataset.awallpaper = ok;
    try {
      window.dispatchEvent(new CustomEvent("orbitx:awallpaper", { detail: ok }));
    } catch {
      /* ignore */
    }
  }
}

/** Apply the stored wallpaper on boot. */
export function applyAnimatedWallpaper() {
  setAnimatedWallpaper(getAnimatedWallpaper());
}

export function sceneFor(id: string): WallpaperScene {
  return ANIMATED_WALLPAPERS.find((w) => w.id === id)?.scene ?? "starfield";
}
