import { describe, expect, it } from "vitest";
import {
  ALL_GLTF_PATHS,
  CITY_PROP_RULES,
  FURNITURE_SETS,
  ORBITX_MODELS,
  isRealModelResponse,
  ORBITX_PREFERRED_PATHS,
  getFurnitureSet,
  getPropRules,
  landmarkModelId,
  resolveModelPath,
} from "./catalog";
import { getBuildingKit } from "./buildingKits";
import { getCharacterGltfPath, getCharacterKit } from "./characterKits";
import { getWorldTheme } from "./worldThemes";
import { furnitureSlots } from "../interiorLayout";

describe("orbitxcity assets catalog", () => {
  it("lists all Kenney GLTF paths under /orbitxcity/models", () => {
    expect(ALL_GLTF_PATHS.length).toBeGreaterThanOrEqual(30);
    for (const p of ALL_GLTF_PATHS) {
      expect(p.startsWith("/orbitxcity/models/")).toBe(true);
      expect(p.endsWith(".gltf") || p.endsWith(".glb")).toBe(true);
    }
  });

  it("registers OrbitX preferred custom paths", () => {
    expect(ORBITX_PREFERRED_PATHS.length).toBeGreaterThanOrEqual(20);
    for (const p of ORBITX_PREFERRED_PATHS) {
      expect(p.includes("/orbitxcity/models/orbitx/")).toBe(true);
      expect(p.endsWith(".glb")).toBe(true);
    }
    expect(ORBITX_MODELS["character-trader"].preferred).toContain("orbitx_character_trader");
  });

  it("rejects SPA HTML fallbacks as missing OrbitX art", () => {
    expect(isRealModelResponse({ ok: true, headers: { get: () => "text/html" } })).toBe(false);
    expect(isRealModelResponse({ ok: true, headers: { get: () => "model/gltf-binary" } })).toBe(true);
    expect(isRealModelResponse({ ok: true, headers: { get: () => "application/octet-stream" } })).toBe(true);
    expect(isRealModelResponse({ ok: false, headers: { get: () => "model/gltf-binary" } })).toBe(false);
  });

  it("resolves to fallback when OrbitX art is missing", () => {
    expect(resolveModelPath("character-trader")).toBeNull();
    expect(resolveModelPath("building-hq-tower")).toContain("building_C");
  });

  it("maps each city to prop rules", () => {
    for (const city of ["nyc", "miami", "la", "boston"] as const) {
      expect(getPropRules(city).length).toBeGreaterThan(0);
    }
  });

  it("miami includes palms and nyc includes hydrant", () => {
    expect(CITY_PROP_RULES.miami.some((r) => r.kind === "palm")).toBe(true);
    expect(CITY_PROP_RULES.nyc.some((r) => r.kind === "hydrant")).toBe(true);
  });

  it("covers interior furniture themes and slots", () => {
    for (const theme of Object.keys(FURNITURE_SETS)) {
      const set = getFurnitureSet(theme as keyof typeof FURNITURE_SETS);
      expect(set.length).toBeGreaterThan(0);
      expect(furnitureSlots(theme as keyof typeof FURNITURE_SETS, 10, 10, set).length).toBeGreaterThan(0);
    }
  });

  it("assigns character kits per mascot and alias", () => {
    expect(getCharacterKit("pepe").accessory).toBe("briefcase");
    expect(getCharacterKit("trader").classId).toBe("pepe");
    expect(getCharacterKit("chad").accessory).toBe("headset");
    expect(getCharacterGltfPath("pepe")).toBeNull();
  });

  it("assigns building kits by kind", () => {
    expect(getBuildingKit("hq").beacon).toBe(true);
    expect(getBuildingKit("shop").id).toBe("retail-neon");
    expect(getBuildingKit("hq").gltfPath).toContain("building");
  });

  it("world themes include neon accent", () => {
    expect(getWorldTheme("nyc").neon).toBe("#00ff9f");
  });

  it("maps landmark model ids per city", () => {
    expect(landmarkModelId("nyc")).toBe("landmark-nyc");
    expect(landmarkModelId("miami")).toBe("landmark-miami");
    expect(landmarkModelId("la")).toBe("landmark-la");
    expect(landmarkModelId("boston")).toBe("landmark-boston");
  });
});
