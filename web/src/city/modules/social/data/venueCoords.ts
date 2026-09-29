/**
 * Provisional world coordinates for social venues.
 *
 * ASSUMPTION (documented in MODULE.md): these are best-guess positions on
 * the city grid (BLOCK=64m, PITCH=78m, HALF=358). The core/districts team owns the
 * real 3D venue placements — when they land, replace these numbers. The
 * module only ever calls `world.teleport(x, z, heading)` (additive, no
 * control fights).
 *
 * Grounded on the expanded 9x9 world (2026-09-29): city x/z ∈ ±358,
 * beach band z 352–438, marina piers x 130–210 / z ~458 (southeast coast),
 * farm fields x -460..-260 / z -470 (north-west), north hills z -542..-678.
 */

export interface VenueCoord {
  x: number;
  z: number;
  heading?: number;
  note: string;
}

export const VENUE_COORDS: Record<string, VenueCoord> = {
  "rooftop-neon":   { x: 40,   z: -60,  heading: 2.6, note: "Downtown financial towers" },
  "rooftop-helios": { x: -180, z: -220, heading: 0.4, note: "Uptown north" },
  "beach-bonfire":  { x: 120,  z: 390,  heading: -2.2, note: "South beach band (z 352-438)" },
  "club-eclipse":    { x: 90,   z: 20,   heading: 1.5, note: "Downtown club row" },
  "club-basement":   { x: -90,  z: 160,  heading: -0.6, note: "Old Town" },
  "dock-east":       { x: 170,  z: 428,  heading: 1.1, note: "Marina piers, southeast coast" },
  "camp-pines":      { x: -260, z: -530, heading: 2.9, note: "North hills foothills" },
  "camp-lake":       { x: -430, z: -480, heading: 0.2, note: "North-west farm fields" },
  "comedy-gutter":   { x: -70,  z: 190,  heading: -1.2, note: "Old Town brick row" },
};

export function venueCoord(id: string): VenueCoord | null {
  return VENUE_COORDS[id] ?? null;
}
