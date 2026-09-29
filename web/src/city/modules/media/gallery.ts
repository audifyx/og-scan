/**
 * MEDIA MODULE — gallery storage.
 * localStorage gallery: JPEG data URLs, downscaled at save time, quota-safe.
 * Newest first. Hard cap so we never blow the 5MB localStorage budget.
 */
import type { GalleryShot } from "./types";

const GALLERY_KEY = "orbitxcity.media.gallery.v1";
const MAX_SHOTS = 60;
/** Rough per-shot budget (chars) so the whole key stays under ~4.5MB. */
const MAX_SHOT_CHARS = 320_000;

function load(): GalleryShot[] {
  try {
    const raw = localStorage.getItem(GALLERY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as GalleryShot[];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function save(shots: GalleryShot[]) {
  try { localStorage.setItem(GALLERY_KEY, JSON.stringify(shots)); }
  catch {
    // quota exceeded — drop oldest until it fits
    const trimmed = [...shots];
    while (trimmed.length > 1) {
      trimmed.pop();
      try { localStorage.setItem(GALLERY_KEY, JSON.stringify(trimmed)); return; }
      catch { /* keep trimming */ }
    }
    try { localStorage.removeItem(GALLERY_KEY); } catch { /* noop */ }
  }
}

export function listShots(): GalleryShot[] { return load(); }

export function getShot(id: string): GalleryShot | null {
  return load().find((s) => s.id === id) ?? null;
}

/** Add a shot (newest first). Oversized data URLs are truncated-safe: returns false if dropped. */
export function addShot(shot: GalleryShot): boolean {
  if (shot.dataUrl.length > MAX_SHOT_CHARS) return false;
  const shots = [shot, ...load()].slice(0, MAX_SHOTS);
  save(shots);
  return true;
}

export function removeShot(id: string) {
  save(load().filter((s) => s.id !== id));
}

export function clearGallery() {
  try { localStorage.removeItem(GALLERY_KEY); } catch { /* noop */ }
}

export function galleryCount(): number { return load().length; }

export { GALLERY_KEY, MAX_SHOTS };
