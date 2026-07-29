/** Building visual kits — maps BuildingKind to OrbitX GLTF shell (Kenney fallback) + roof behavior. */
import type { BuildingKind } from "../types";
import { CITY_BUILDING_MODELS, resolveModelPath, type OrbitxModelId } from "./catalog";

export type BuildingKitId =
  | "hq-tower"
  | "trade-glass"
  | "launch-stage"
  | "retail-neon"
  | "lounge-glass"
  | "ad-spire"
  | "midrise-block";

export interface BuildingKit {
  id: BuildingKitId;
  /** Resolved load path (OrbitX if available, else Kenney). */
  gltfPath: string;
  modelId: OrbitxModelId;
  beacon: boolean;
  marqueeIntensity: number;
  facadeGrime: number;
  /** True when custom OrbitX shell is available. */
  isOrbitx: boolean;
}

const KIT_META: Record<
  BuildingKitId,
  Omit<BuildingKit, "gltfPath" | "isOrbitx"> & { kenneyFallback: string }
> = {
  "hq-tower": {
    id: "hq-tower",
    modelId: "building-hq-tower",
    kenneyFallback: CITY_BUILDING_MODELS.c,
    beacon: true,
    marqueeIntensity: 0.85,
    facadeGrime: 0.15,
  },
  "trade-glass": {
    id: "trade-glass",
    modelId: "building-trade-glass",
    kenneyFallback: CITY_BUILDING_MODELS.b,
    beacon: false,
    marqueeIntensity: 0.55,
    facadeGrime: 0.25,
  },
  "launch-stage": {
    id: "launch-stage",
    modelId: "building-launch-stage",
    kenneyFallback: CITY_BUILDING_MODELS.d,
    beacon: true,
    marqueeIntensity: 0.75,
    facadeGrime: 0.2,
  },
  "retail-neon": {
    id: "retail-neon",
    modelId: "building-retail-neon",
    kenneyFallback: CITY_BUILDING_MODELS.a,
    beacon: false,
    marqueeIntensity: 0.62,
    facadeGrime: 0.35,
  },
  "lounge-glass": {
    id: "lounge-glass",
    modelId: "building-lounge-glass",
    kenneyFallback: CITY_BUILDING_MODELS.b,
    beacon: false,
    marqueeIntensity: 0.45,
    facadeGrime: 0.3,
  },
  "ad-spire": {
    id: "ad-spire",
    modelId: "building-ad-spire",
    kenneyFallback: CITY_BUILDING_MODELS.d,
    beacon: true,
    marqueeIntensity: 0.7,
    facadeGrime: 0.18,
  },
  "midrise-block": {
    id: "midrise-block",
    modelId: "building-midrise",
    kenneyFallback: CITY_BUILDING_MODELS.a,
    beacon: false,
    marqueeIntensity: 0.4,
    facadeGrime: 0.4,
  },
};

const KIND_TO_KIT: Record<BuildingKind, BuildingKitId> = {
  hq: "hq-tower",
  trading_floor: "trade-glass",
  launch_arena: "launch-stage",
  market: "retail-neon",
  shop: "retail-neon",
  social_hub: "lounge-glass",
  ad_tower: "ad-spire",
  plaza: "midrise-block",
  generic: "midrise-block",
};

export function getBuildingKit(kind: BuildingKind): BuildingKit {
  const id = KIND_TO_KIT[kind] ?? "midrise-block";
  const meta = KIT_META[id];
  const resolved = resolveModelPath(meta.modelId);
  const gltfPath = resolved ?? meta.kenneyFallback;
  const isOrbitx = Boolean(resolved && resolved.includes("/orbitx/"));
  return {
    id: meta.id,
    modelId: meta.modelId,
    gltfPath,
    beacon: meta.beacon,
    marqueeIntensity: meta.marqueeIntensity,
    facadeGrime: meta.facadeGrime,
    isOrbitx,
  };
}

/** Pick GLTF shell — prefer OrbitX kit, else Kenney rotation by building id hash. */
export function gltfPathForBuilding(buildingId: string, kind: BuildingKind): string {
  const kit = getBuildingKit(kind);
  if (kit.isOrbitx) return kit.gltfPath;
  const paths = Object.values(CITY_BUILDING_MODELS);
  let h = 0;
  for (let i = 0; i < buildingId.length; i++) h = (h * 31 + buildingId.charCodeAt(i)) | 0;
  return paths[Math.abs(h) % paths.length] ?? kit.gltfPath;
}
