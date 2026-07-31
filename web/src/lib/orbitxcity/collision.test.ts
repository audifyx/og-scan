import { describe, expect, it } from "vitest";
import {
  collidesAt,
  collidesInInterior,
  crossedEntryDoorway,
  crossedExitDoorway,
  isWalkInBuilding,
} from "./collision";
import type { BuildingDefinition, WorldBlockConfig } from "./types";

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

const market: BuildingDefinition = {
  id: "test-market",
  districtId: "test",
  kind: "market",
  name: "Test Market",
  position: { x: 0, y: 0, z: 0 },
  size: { width: 10, height: 6, depth: 8 },
  color: "#141018",
  accent: "#ff4d9a",
  interaction: "marketplace",
};

const smallProp: BuildingDefinition = {
  id: "test-kiosk",
  districtId: "test",
  kind: "generic",
  name: "Kiosk",
  position: { x: 20, y: 0, z: 0 },
  size: { width: 2, height: 3, depth: 2 },
  color: "#222",
  accent: "#fff",
};

const block: WorldBlockConfig = {
  cityId: "nyc",
  name: "test",
  spawn: { x: 0, y: 0, z: 12 },
  bounds: { minX: -60, maxX: 60, minZ: -60, maxZ: 60 },
  districts: [],
  buildings: [market, smallProp],
  billboards: [],
  zones: [],
};

describe("interior collision", () => {
  it("keeps players within furnished interior walls", () => {
    // North wall / desk band
    expect(collidesInInterior(0, -3.2, 0.45, tradingFloor)).toBe(true);
    // Open center aisle between desks
    expect(collidesInInterior(0, 1.2, 0.45, tradingFloor)).toBe(false);
    // South wall outside the doorway gap
    expect(collidesInInterior(0, 4, 0.45, tradingFloor)).toBe(true);
  });

  it("makes trading desks solid while preserving the aisles", () => {
    expect(collidesInInterior(-1.95, -2.6, 0.45, tradingFloor)).toBe(true);
    expect(collidesInInterior(0, 1.8, 0.45, tradingFloor)).toBe(false);
  });

  it("allows exit through the south doorway gap", () => {
    const { depth } = { depth: Math.max(5.2, Math.min(14, tradingFloor.size.depth - 0.8)) };
    const faceZ = tradingFloor.position.z + depth / 2;
    expect(collidesInInterior(0, faceZ - 0.1, 0.3, tradingFloor)).toBe(false);
  });
});

describe("exterior doorway collision gap", () => {
  it("classifies venue buildings as walk-in and props as not", () => {
    expect(isWalkInBuilding(market)).toBe(true);
    expect(isWalkInBuilding(smallProp)).toBe(false);
  });

  it("lets the player pass through the centred south doorway", () => {
    expect(collidesAt(0, 3.9, 0.3, block)).toBe(false);
  });

  it("keeps the surrounding facade solid off the door", () => {
    expect(collidesAt(3.6, 3.9, 0.3, block)).toBe(true);
    expect(collidesAt(0, 0, 0.3, block)).toBe(true);
  });
});

describe("doorway threshold crossing", () => {
  it("detects walking inward through the south face", () => {
    expect(crossedEntryDoorway(4.2, 3.9, 0, market)).toBe(true);
    expect(crossedEntryDoorway(3.9, 4.2, 0, market)).toBe(false);
    expect(crossedEntryDoorway(4.2, 3.9, 3.5, market)).toBe(false);
  });

  it("detects walking out of an interior", () => {
    expect(crossedExitDoorway(3.5, 3.9, 0, tradingFloor)).toBe(true);
    expect(crossedExitDoorway(3.9, 3.5, 0, tradingFloor)).toBe(false);
  });
});
