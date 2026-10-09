/**
 * Provisional world coordinates for social venues.
 *
 * ASSUMPTION (documented in MODULE.md): these are best-guess positions on
 * the city grid (BLOCK=64m, PITCH≈76m). The core/districts team owns the
 * real 3D venue placements — when they land, replace these numbers. The
 * module only ever calls `world.teleport(x, z, heading)` (additive, no
 * control fights).
 */

export interface VenueCoord {
  x: number;
  z: number;
  heading?: number;
  note: string;
}

export const VENUE_COORDS: Record<string, VenueCoord> = {
  "rooftop-neon":   { x: 40,   z: -60,  heading: 2.6, note: "Downtown tower district (placeholder)" },
  "rooftop-helios": { x: -180, z: -220, heading: 0.4, note: "Uptown (placeholder)" },
  "beach-bonfire":  { x: 340,  z: 300,  heading: -2.2, note: "Boardwalk east edge (placeholder)" },
  "club-eclipse":    { x: 90,   z: 20,   heading: 1.5, note: "Downtown club row (placeholder)" },
  "club-basement":   { x: -90,  z: 160,  heading: -0.6, note: "Old Town (placeholder)" },
  "dock-east":       { x: -340, z: 180,  heading: 1.1, note: "Harbor east docks (placeholder)" },
  "camp-pines":      { x: -220, z: -360, heading: 2.9, note: "North Hills pines (placeholder)" },
  "camp-lake":       { x: -120, z: -420, heading: 0.2, note: "North Hills lake (placeholder)" },
  "comedy-gutter":   { x: -70,  z: 190,  heading: -1.2, note: "Old Town brick row (placeholder)" },
};

export function venueCoord(id: string): VenueCoord | null {
  return VENUE_COORDS[id] ?? null;
}
