/**
 * MEDIA MODULE — photo mode.
 *
 * Freeze-frame approach (v1, zero core changes required):
 *  1. Integrator freezes the world (adapter.setPaused(true)) and calls
 *     captureFrame() in the same rAF as the world render.
 *  2. The frozen frame becomes a 2D working canvas. All "camera" controls
 *     (pan / zoom / rotate) are applied to that frame — exactly how a real
 *     photo-mode reframing pass feels, without fighting the core camera.
 *  3. Filters are CSS filter strings applied to the preview AND baked into
 *     the JPEG export via canvas 2D compositing.
 *
 * Upgrade path (documented in MODULE.md §5): with a core cameraRef/render
 * hook, step 1 can capture from a free-orbit 3D photo camera instead.
 */
import type { GalleryShot, PhotoFilter, PhotoFilterId, PhotoView } from "./types";

export const EXPORT_MAX_W = 1280;

export const PHOTO_FILTERS: PhotoFilter[] = [
  { id: "none",     name: "Clean",    css: "none",                                              premium: false },
  { id: "noir",     name: "Noir",     css: "grayscale(1) contrast(1.25) brightness(0.95)",       premium: false },
  { id: "vice",     name: "Vice",     css: "saturate(1.6) contrast(1.1) hue-rotate(-18deg)",     premium: false },
  { id: "golden",   name: "Golden",   css: "sepia(0.45) saturate(1.3) contrast(1.05)",            premium: false },
  { id: "chrome",   name: "Chrome",   css: "saturate(0.35) contrast(1.35) brightness(1.08)",     premium: false },
  { id: "nightops", name: "Night Ops",css: "saturate(0.6) contrast(1.2) brightness(0.8) sepia(0.25) hue-rotate(60deg)", premium: true },
];

export function getFilter(id: PhotoFilterId): PhotoFilter {
  return PHOTO_FILTERS.find((f) => f.id === id) ?? PHOTO_FILTERS[0];
}

export const PREMIUM_FILTER_PACK = {
  id: "filter-pack-nightops",
  name: "Night Ops filter pack",
  price: 10, // whole ORBITX, burned
  reason: "city:media:filter-pack",
  filters: ["nightops"] as PhotoFilterId[],
};

/** Default framing view. */
export function defaultView(): PhotoView { return { x: 0, y: 0, zoom: 1, rot: 0 }; }

export function clampView(v: PhotoView): PhotoView {
  return {
    x: Math.max(-0.5, Math.min(0.5, v.x)),
    y: Math.max(-0.5, Math.min(0.5, v.y)),
    zoom: Math.max(1, Math.min(4, v.zoom)),
    rot: Math.max(-15, Math.min(15, v.rot)),
  };
}

/**
 * Bake the frozen frame + view transform + filter into an export JPEG.
 * Returns a data URL (max EXPORT_MAX_W wide).
 */
export function exportPhoto(
  frame: HTMLCanvasElement,
  view: PhotoView,
  filter: PhotoFilter,
): string {
  const scale = Math.min(1, EXPORT_MAX_W / frame.width);
  const out = document.createElement("canvas");
  out.width = Math.round(frame.width * scale);
  out.height = Math.round(frame.height * scale);
  const ctx = out.getContext("2d");
  if (!ctx) return frame.toDataURL("image/jpeg", 0.82);

  ctx.save();
  ctx.filter = filter.css === "none" ? "none" : filter.css;
  // camera-style transform: rotate, then zoom about the pan point
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((view.rot * Math.PI) / 180);
  ctx.scale(view.zoom, view.zoom);
  ctx.translate(-out.width / 2 - view.x * out.width, -out.height / 2 - view.y * out.height);
  ctx.drawImage(frame, 0, 0, out.width, out.height);
  ctx.restore();
  return out.toDataURL("image/jpeg", 0.85);
}

/** Downscale any image data URL to gallery size (<= EXPORT_MAX_W). */
export function downscaleImage(dataUrl: string, maxW = EXPORT_MAX_W): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxW / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      const ctx = c.getContext("2d");
      if (!ctx) { reject(new Error("no 2d context")); return; }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c);
    };
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = dataUrl;
  });
}

/** Draw the in-preview transform (mirrors exportPhoto math for the <img> overlay). */
export function viewToCssTransform(v: PhotoView): string {
  return `translate(${v.x * -100}%, ${v.y * -100}%) scale(${v.zoom}) rotate(${v.rot}deg)`;
}

/** Build the default caption for a shot. */
export function buildShotCaption(opts: { filter: PhotoFilter; isNight: boolean; speedKmh: number }): string {
  const bits = ["OrbitXCity"];
  if (opts.speedKmh > 40) bits.push(`${Math.round(opts.speedKmh)} km/h`);
  if (opts.isNight) bits.push("night drive");
  if (opts.filter.id !== "none") bits.push(opts.filter.name);
  return bits.join(" · ");
}

export function makeShot(dataUrl: string, w: number, h: number, filterId: PhotoFilterId, caption: string): GalleryShot {
  return {
    id: `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    dataUrl, width: w, height: h, filter: filterId, caption,
    createdAt: Date.now(),
  };
}
