import { describe, expect, it } from "vitest";
import { collidesInInterior } from "./collision";
import type { BuildingDefinition } from "./types";

const tradingFloor: BuildingDefinition = {
  id: "test-trading-floor",
  districtId: "test",
  kind: "trading_floor",
  name: "Test Trading Floor",
  position: { x: 0, y: 0, z: 0 },
  size: { width: 12, height: 8, depth: 8 },
  color: "#102030",
  accent: "#3de7ff",
};

describe("interior collision", () => {
  it("keeps players within furnished interior walls", () => {
    expect(collidesInInterior(0, 0, 0.45, tradingFloor)).toBe(true);
    expect(collidesInInterior(0, 2, 0.45, tradingFloor)).toBe(false);
    expect(collidesInInterior(0, 4, 0.45, tradingFloor)).toBe(true);
  });

  it("makes trading desks solid while preserving the aisles", () => {
    expect(collidesInInterior(-1.8, -0.35, 0.45, tradingFloor)).toBe(true);
    expect(collidesInInterior(-0.9, 1.6, 0.45, tradingFloor)).toBe(false);
  });
});
