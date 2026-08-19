import { describe, expect, it } from "vitest";
import { bannerLocalPose, resolveBuildingBanners, type BuildingBanner } from "./banners";
import type { BuildingDefinition } from "./types";

function building(partial: Partial<BuildingDefinition>): BuildingDefinition {
  return {
    id: "b-hq",
    districtId: "midtown",
    kind: "hq",
    name: "OrbitX HQ",
    position: { x: 0, y: 0, z: 0 },
    size: { width: 10, height: 16, depth: 8 },
    color: "#1a2028",
    accent: "#00ff9f",
    interaction: "hq",
    ...partial,
  };
}

describe("building banners", () => {
  it("defaults a south-face HQ banner when none authored", () => {
    const list = resolveBuildingBanners(building({}));
    expect(list.length).toBe(1);
    expect(list[0]!.face).toBe("south");
    expect(list[0]!.title).toContain("ORBITX");
    expect(list[0]!.width).toBeGreaterThan(2);
  });

  it("prefers authored banners over defaults", () => {
    const custom: BuildingBanner = {
      id: "dev-1",
      buildingId: "b-hq",
      face: "east",
      u: 0.4,
      v: 0.7,
      width: 3,
      height: 1,
      title: "DEV AD",
      accent: "#c5a26f",
    };
    const list = resolveBuildingBanners(building({ banners: [custom] }));
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe("dev-1");
    expect(list[0]!.face).toBe("east");
  });

  it("skips disabled authored banners", () => {
    const list = resolveBuildingBanners(
      building({
        banners: [
          {
            id: "off",
            buildingId: "b-hq",
            face: "south",
            u: 0.5,
            v: 0.5,
            width: 2,
            height: 1,
            title: "OFF",
            accent: "#fff",
            enabled: false,
          },
        ],
      }),
    );
    expect(list.every((b) => b.id !== "off")).toBe(true);
  });

  it("places south banners in front of the doorway face", () => {
    const pose = bannerLocalPose(
      {
        id: "x",
        buildingId: "b-hq",
        face: "south",
        u: 0.5,
        v: 0.6,
        width: 3,
        height: 1,
        title: "A",
        accent: "#00ff9f",
      },
      { width: 10, height: 16, depth: 8 },
    );
    expect(pose.position[2]).toBeGreaterThan(4);
    expect(pose.rotationY).toBe(0);
  });

  it("leaves generic fill buildings without auto ads", () => {
    expect(resolveBuildingBanners(building({ kind: "generic", interaction: undefined }))).toEqual([]);
  });

  it("orients east banners on the +X face", () => {
    const pose = bannerLocalPose(
      {
        id: "e",
        buildingId: "b-hq",
        face: "east",
        u: 0.5,
        v: 0.5,
        width: 3,
        height: 1,
        title: "E",
        accent: "#c5a26f",
      },
      { width: 10, height: 16, depth: 8 },
    );
    expect(pose.position[0]).toBeGreaterThan(5);
    expect(pose.rotationY).toBeCloseTo(Math.PI / 2);
  });
});
