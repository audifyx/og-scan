/**
 * OrbitX City asset catalog — single registry for GLTF paths, furniture sets, and prop rules.
 * Binary inventory mirror: /orbitxcity/models/manifest.json
 * Custom OrbitX GLBs live under /orbitxcity/models/orbitx/ (see docs/orbitxcity/GLTF_EXPORT_SPEC.md).
 */
import type { CityId } from "../types";
import type { RoomTheme } from "../interiorLayout";

const BASE = "/orbitxcity/models";
const OX = `${BASE}/orbitx`;

export const CITY_BUILDING_MODELS = {
  a: `${BASE}/citybits/building_A.gltf`,
  b: `${BASE}/citybits/building_B.gltf`,
  c: `${BASE}/citybits/building_C.gltf`,
  d: `${BASE}/citybits/building_D.gltf`,
} as const;

export const CITY_STREET_MODELS = {
  bench: `${BASE}/citybits/bench.gltf`,
  carSedan: `${BASE}/citybits/car_sedan.gltf`,
} as const;

export const FURNITURE_MODELS = {
  armchair: `${BASE}/furniture/armchair.gltf`,
  armchairPillows: `${BASE}/furniture/armchair_pillows.gltf`,
  chairA: `${BASE}/furniture/chair_A.gltf`,
  chairB: `${BASE}/furniture/chair_B.gltf`,
  chairStool: `${BASE}/furniture/chair_stool.gltf`,
  couch: `${BASE}/furniture/couch.gltf`,
  couchPillows: `${BASE}/furniture/couch_pillows.gltf`,
  tableSmall: `${BASE}/furniture/table_small.gltf`,
  tableMedium: `${BASE}/furniture/table_medium.gltf`,
  tableMediumLong: `${BASE}/furniture/table_medium_long.gltf`,
  tableLow: `${BASE}/furniture/table_low.gltf`,
  cabinetSmall: `${BASE}/furniture/cabinet_small.gltf`,
  cabinetMedium: `${BASE}/furniture/cabinet_medium.gltf`,
  cabinetMediumDecorated: `${BASE}/furniture/cabinet_medium_decorated.gltf`,
  shelfLarge: `${BASE}/furniture/shelf_B_large.gltf`,
  shelfLargeDecorated: `${BASE}/furniture/shelf_B_large_decorated.gltf`,
  lampStanding: `${BASE}/furniture/lamp_standing.gltf`,
  lampTable: `${BASE}/furniture/lamp_table.gltf`,
  rugRectangle: `${BASE}/furniture/rug_rectangle_A.gltf`,
  rugStripes: `${BASE}/furniture/rug_rectangle_stripes_A.gltf`,
  pictureframeLarge: `${BASE}/furniture/pictureframe_large_A.gltf`,
  pictureframeMedium: `${BASE}/furniture/pictureframe_medium.gltf`,
  bookSet: `${BASE}/furniture/book_set.gltf`,
  cactusSmall: `${BASE}/furniture/cactus_small_A.gltf`,
} as const;

/** Preferred OrbitX custom GLB paths + Kenney/procedural fallbacks. */
export const ORBITX_MODELS = {
  // Characters
  "character-trader": { preferred: `${OX}/characters/orbitx_character_trader.glb`, fallback: null },
  "character-builder": { preferred: `${OX}/characters/orbitx_character_builder.glb`, fallback: null },
  "character-gamer": { preferred: `${OX}/characters/orbitx_character_gamer.glb`, fallback: null },
  "character-creator": { preferred: `${OX}/characters/orbitx_character_creator.glb`, fallback: null },
  "character-explorer": { preferred: `${OX}/characters/orbitx_character_explorer.glb`, fallback: null },
  // Buildings
  "building-hq-tower": { preferred: `${OX}/buildings/orbitx_building_hq_tower.glb`, fallback: CITY_BUILDING_MODELS.c },
  "building-trade-glass": { preferred: `${OX}/buildings/orbitx_building_trade_glass.glb`, fallback: CITY_BUILDING_MODELS.b },
  "building-launch-stage": { preferred: `${OX}/buildings/orbitx_building_launch_stage.glb`, fallback: CITY_BUILDING_MODELS.d },
  "building-retail-neon": { preferred: `${OX}/buildings/orbitx_building_retail_neon.glb`, fallback: CITY_BUILDING_MODELS.a },
  "building-lounge-glass": { preferred: `${OX}/buildings/orbitx_building_lounge_glass.glb`, fallback: CITY_BUILDING_MODELS.b },
  "building-ad-spire": { preferred: `${OX}/buildings/orbitx_building_ad_spire.glb`, fallback: CITY_BUILDING_MODELS.d },
  "building-midrise": { preferred: `${OX}/buildings/orbitx_building_midrise.glb`, fallback: CITY_BUILDING_MODELS.a },
  // Landmarks
  "landmark-nyc": { preferred: `${OX}/landmarks/orbitx_landmark_midtown_screen.glb`, fallback: null },
  "landmark-miami": { preferred: `${OX}/landmarks/orbitx_landmark_boardwalk.glb`, fallback: null },
  "landmark-la": { preferred: `${OX}/landmarks/orbitx_landmark_creator_stage.glb`, fallback: null },
  "landmark-boston": { preferred: `${OX}/landmarks/orbitx_landmark_lab_dome.glb`, fallback: null },
  // Street props
  "prop-neon-blade": { preferred: `${OX}/props/orbitx_prop_neon_blade.glb`, fallback: null },
  "prop-hydrant": { preferred: `${OX}/props/orbitx_prop_hydrant.glb`, fallback: null },
  "prop-news-kiosk": { preferred: `${OX}/props/orbitx_prop_news_kiosk.glb`, fallback: null },
  "prop-palm-cluster": { preferred: `${OX}/props/orbitx_prop_palm_cluster.glb`, fallback: null },
  "prop-lifeguard": { preferred: `${OX}/props/orbitx_prop_lifeguard.glb`, fallback: null },
  "prop-stage-truss": { preferred: `${OX}/props/orbitx_prop_stage_truss.glb`, fallback: null },
  "prop-lab-pylon": { preferred: `${OX}/props/orbitx_prop_lab_pylon.glb`, fallback: null },
  "prop-antenna": { preferred: `${OX}/props/orbitx_prop_antenna.glb`, fallback: null },
  // Interiors
  "interior-terminal-desk": { preferred: `${OX}/interiors/orbitx_interior_terminal_desk.glb`, fallback: FURNITURE_MODELS.tableMediumLong },
  "interior-command-table": { preferred: `${OX}/interiors/orbitx_interior_command_table.glb`, fallback: FURNITURE_MODELS.tableMedium },
  "interior-hologram-pillar": { preferred: `${OX}/interiors/orbitx_interior_hologram_pillar.glb`, fallback: null },
  "interior-stage-riser": { preferred: `${OX}/interiors/orbitx_interior_stage_riser.glb`, fallback: null },
  "interior-countdown": { preferred: `${OX}/interiors/orbitx_interior_countdown.glb`, fallback: null },
  "interior-neon-bar": { preferred: `${OX}/interiors/orbitx_interior_neon_bar.glb`, fallback: FURNITURE_MODELS.tableMediumLong },
  "interior-dj-booth": { preferred: `${OX}/interiors/orbitx_interior_dj_booth.glb`, fallback: FURNITURE_MODELS.cabinetMedium },
  "interior-retail-counter": { preferred: `${OX}/interiors/orbitx_interior_retail_counter.glb`, fallback: FURNITURE_MODELS.cabinetSmall },
} as const;

export type OrbitxModelId = keyof typeof ORBITX_MODELS;

/** Paths confirmed present via HEAD probe during preload. */
const availablePreferred = new Set<string>();
let probeStarted = false;

export function markModelAvailable(path: string): void {
  availablePreferred.add(path);
}

export function isPreferredAvailable(path: string): boolean {
  return availablePreferred.has(path);
}

export function getPreferredAvailable(): readonly string[] {
  return [...availablePreferred];
}

/**
 * Resolve a catalog model id to a loadable path.
 * Returns OrbitX preferred path when probed available, else Kenney fallback, else null (procedural).
 */
export function resolveModelPath(id: OrbitxModelId | string): string | null {
  const entry = ORBITX_MODELS[id as OrbitxModelId];
  if (!entry) return null;
  if (availablePreferred.has(entry.preferred)) return entry.preferred;
  return entry.fallback;
}

/** All Kenney + confirmed OrbitX preferred paths for preload. */
export const ALL_GLTF_PATHS: readonly string[] = [
  ...Object.values(CITY_BUILDING_MODELS),
  ...Object.values(CITY_STREET_MODELS),
  ...Object.values(FURNITURE_MODELS),
];

/** Preferred OrbitX paths (may 404 until art drops). */
export const ORBITX_PREFERRED_PATHS: readonly string[] = Object.values(ORBITX_MODELS).map((e) => e.preferred);

/** Probe OrbitX preferred paths with HEAD; mark available ones for resolveModelPath. */
export async function probeOrbitxModels(): Promise<string[]> {
  if (typeof window === "undefined") return [];
  if (probeStarted) return [...availablePreferred];
  probeStarted = true;
  const found: string[] = [];
  await Promise.all(
    ORBITX_PREFERRED_PATHS.map(async (path) => {
      try {
        const res = await fetch(path, { method: "HEAD", cache: "force-cache" });
        if (res.ok) {
          availablePreferred.add(path);
          found.push(path);
        }
      } catch {
        /* missing art — use fallback */
      }
    }),
  );
  return found;
}

/** Interior furniture sets per room theme (Kenney until OrbitX interiors land). */
export const FURNITURE_SETS: Record<RoomTheme, readonly string[]> = {
  trade: [FURNITURE_MODELS.tableMediumLong, FURNITURE_MODELS.chairA, FURNITURE_MODELS.lampTable, FURNITURE_MODELS.cabinetMedium],
  lounge: [FURNITURE_MODELS.couchPillows, FURNITURE_MODELS.tableLow, FURNITURE_MODELS.lampStanding, FURNITURE_MODELS.rugRectangle],
  market: [FURNITURE_MODELS.shelfLarge, FURNITURE_MODELS.cabinetSmall, FURNITURE_MODELS.tableSmall],
  club: [FURNITURE_MODELS.chairStool, FURNITURE_MODELS.couch, FURNITURE_MODELS.lampStanding],
  theater: [FURNITURE_MODELS.couch, FURNITURE_MODELS.shelfLargeDecorated, FURNITURE_MODELS.pictureframeLarge],
  hq: [FURNITURE_MODELS.couchPillows, FURNITURE_MODELS.cabinetMediumDecorated, FURNITURE_MODELS.bookSet, FURNITURE_MODELS.lampTable],
  launch: [FURNITURE_MODELS.tableMedium, FURNITURE_MODELS.chairB, FURNITURE_MODELS.rugStripes],
  lobby: [FURNITURE_MODELS.armchair, FURNITURE_MODELS.tableSmall, FURNITURE_MODELS.cactusSmall],
};

export type PropKind =
  | "palm"
  | "neon-sign"
  | "lab-pylon"
  | "stage-light"
  | "parked-car"
  | "neon-blade"
  | "hydrant"
  | "news-kiosk"
  | "palm-cluster"
  | "lifeguard"
  | "stage-truss"
  | "antenna";

export interface PropRule {
  kind: PropKind;
  /** Relative density 0–1 along street segments */
  density: number;
  accent?: string;
}

/** City-specific procedural prop scatter rules. */
export const CITY_PROP_RULES: Record<CityId, PropRule[]> = {
  nyc: [
    { kind: "neon-sign", density: 0.28 },
    { kind: "neon-blade", density: 0.18 },
    { kind: "hydrant", density: 0.12 },
    { kind: "news-kiosk", density: 0.1 },
    { kind: "parked-car", density: 0.2 },
  ],
  boston: [
    { kind: "lab-pylon", density: 0.28 },
    { kind: "antenna", density: 0.16 },
    { kind: "neon-sign", density: 0.22 },
  ],
  miami: [
    { kind: "palm", density: 0.35 },
    { kind: "palm-cluster", density: 0.2 },
    { kind: "lifeguard", density: 0.08 },
    { kind: "neon-sign", density: 0.25 },
    { kind: "parked-car", density: 0.15 },
  ],
  la: [
    { kind: "stage-light", density: 0.3 },
    { kind: "stage-truss", density: 0.14 },
    { kind: "neon-sign", density: 0.3 },
    { kind: "parked-car", density: 0.18 },
  ],
};

export function getFurnitureSet(theme: RoomTheme): readonly string[] {
  return FURNITURE_SETS[theme] ?? FURNITURE_SETS.lobby;
}

export function getPropRules(cityId: CityId): PropRule[] {
  return CITY_PROP_RULES[cityId] ?? CITY_PROP_RULES.nyc;
}

/** Landmark model id for a city. */
export function landmarkModelId(cityId: CityId): OrbitxModelId {
  switch (cityId) {
    case "miami":
      return "landmark-miami";
    case "la":
      return "landmark-la";
    case "boston":
      return "landmark-boston";
    case "nyc":
    default:
      return "landmark-nyc";
  }
}
