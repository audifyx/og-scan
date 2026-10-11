/**
 * OrbitX City — 3D asset manifest.
 *
 * All models are CC0 licensed from Kenney.nl (city-kit-commercial, car-kit).
 * Attribution: "Kenney" (kenney.nl) — not required but appreciated.
 *
 * Replacement workflow (phone-friendly):
 * 1. Download a .glb file on your phone (Kenney.nl, Poly.pizza, Sketchfab)
 * 2. Drop it into public/assets/city/<category>/
 * 3. Add an entry below with its path + footprint size
 * 4. The loader picks it up automatically with fallback to procedural
 */

export interface AssetEntry {
  /** path relative to public/, e.g. "assets/city/buildings/building-a.glb" */
  path: string;
  /** footprint in meters (x, z) for placement */
  footprint: [number, number];
  /** height in meters (for collider + LOD decisions) */
  height: number;
  /** category for placement logic */
  kind: "building" | "skyscraper" | "shop" | "car" | "prop";
}

const B = (name: string, footprint: [number, number], height: number, kind: AssetEntry["kind"] = "building"): AssetEntry => ({
  path: `assets/city/buildings/${name}`,
  footprint,
  height,
  kind,
});

const C = (name: string): AssetEntry => ({
  path: `assets/city/cars/${name}`,
  footprint: [2, 4.5],
  height: 1.5,
  kind: "car",
});

export const BUILDINGS: AssetEntry[] = [
  // Commercial kit — mid-rise (footprints ~10-14m, heights ~12-20m)
  B("building-a.glb", [12, 12], 16),
  B("building-b.glb", [12, 12], 18),
  B("building-c.glb", [14, 12], 14),
  B("building-d.glb", [12, 14], 20),
  B("building-e.glb", [10, 12], 15),
  B("building-f.glb", [12, 10], 17),
  B("building-g.glb", [14, 14], 13),
  B("building-h.glb", [12, 12], 19),
  B("building-i.glb", [10, 10], 14),
  B("building-j.glb", [12, 14], 16),
  B("building-k.glb", [14, 12], 18),
  B("building-l.glb", [12, 12], 15),
  B("building-m.glb", [10, 14], 17),
  B("building-n.glb", [12, 10], 13),
  // Skyscrapers — downtown core (footprints ~16-20m, heights ~35-50m)
  B("building-skyscraper-a.glb", [18, 18], 45, "skyscraper"),
  B("building-skyscraper-b.glb", [16, 18], 40, "skyscraper"),
  B("building-skyscraper-c.glb", [18, 16], 48, "skyscraper"),
  B("building-skyscraper-d.glb", [20, 18], 42, "skyscraper"),
  B("building-skyscraper-e.glb", [16, 16], 38, "skyscraper"),
  // Shops — street-level retail (footprints ~8-10m, heights ~6-8m)
  B("commercial/shop-a.glb", [9, 8], 7, "shop"),
  B("commercial/shop-b.glb", [8, 9], 6, "shop"),
  B("commercial/shop-c.glb", [9, 9], 7, "shop"),
  B("commercial/shop-d.glb", [8, 8], 6, "shop"),
  B("commercial/shop-e.glb", [10, 8], 7, "shop"),
  B("commercial/shop-f.glb", [8, 10], 6, "shop"),
  B("commercial/shop-g.glb", [9, 8], 7, "shop"),
  B("commercial/shop-h.glb", [8, 9], 6, "shop"),
  B("commercial/shop-n.glb", [9, 9], 7, "shop"),
  B("commercial/tower-a.glb", [14, 14], 30, "skyscraper"),
  B("commercial/tower-b.glb", [14, 16], 32, "skyscraper"),
];

export const CARS: AssetEntry[] = [
  C("sedan.glb"),
  C("suv.glb"),
  C("taxi.glb"),
  C("sports.glb"),
  C("truck.glb"),
  C("van.glb"),
  C("police.glb"),
  C("ambulance.glb"),
];

/** Filter helper: pick a random building suitable for a lot of given size */
export function pickBuilding(lotW: number, lotD: number, downtown: boolean): AssetEntry {
  const pool = BUILDINGS.filter(b => {
    if (downtown) return b.kind === "skyscraper" || b.kind === "building";
    return b.kind !== "skyscraper";
  });
  // Prefer models that fit the lot
  const fitting = pool.filter(b => b.footprint[0] <= lotW && b.footprint[1] <= lotD);
  const src = fitting.length > 0 ? fitting : pool;
  return src[Math.floor(Math.random() * src.length)];
}
