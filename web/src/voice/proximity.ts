/**
 * Proximity math for OrbitX City voice.
 *
 * Volume fades with distance: full volume up close, cosine falloff to
 * silence at PROXIMITY_MAX_RANGE. Tune PROXIMITY_MAX_RANGE to taste —
 * larger = more map-wide, smaller = more intimate.
 */

export const PROXIMITY_MAX_RANGE = 120; // world units
export const PROXIMITY_FULL_VOLUME_RANGE = 0.15; // fraction of max range at full volume
export const PROXIMITY_PUBLISH_MS = 300; // position publish interval
export const PROXIMITY_HEARTBEAT_MS = 2000; // re-publish even when still

export interface Vec2 {
  x: number;
  z: number;
}

export function dist2D(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** 0..1 gain for a given distance. 0 beyond max range. */
export function gainForDistance(
  dist: number,
  maxRange: number = PROXIMITY_MAX_RANGE
): number {
  if (dist <= 0) return 1;
  if (dist >= maxRange) return 0;
  const t = dist / maxRange;
  if (t < PROXIMITY_FULL_VOLUME_RANGE) return 1;
  const f = (t - PROXIMITY_FULL_VOLUME_RANGE) / (1 - PROXIMITY_FULL_VOLUME_RANGE);
  return Math.max(0, Math.cos(f * (Math.PI / 2)));
}
