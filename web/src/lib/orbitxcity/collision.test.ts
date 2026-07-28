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
    expect(collidesInInterior(0, 0, 0.45, tradingFloor)).toBe(true);
    expect(collidesInInterior(0, 2, 0.45, tradingFloor)).toBe(false);
    expect(collidesInInterior(0, 4, 0.45, tradingFloor)).toBe(true);
  });

  it("makes trading desks solid while preserving the aisles", () => {
    // Front trading desk sits at (~-1.95, -2.9); the mid-floor aisle is clear.
    expect(collidesInInterior(-1.95, -2.6, 0.45, tradingFloor)).toBe(true);
    expect(collidesInInterior(0, 1.8, 0.45, tradingFloor)).toBe(false);
  });
});

describe("exterior doorway collision gap", () => {
  it("classifies venue buildings as walk-in and props as not", () => {
    expect(isWalkInBuilding(market)).toBe(true);
    expect(isWalkInBuilding(smallProp)).toBe(false);
  });

  it("lets the player pass through the centred south doorway", () => {
    // Just inside the south face, aligned with the door → passable.
    expect(collidesAt(0, 3.9, 0.3, block)).toBe(false);
  });

  it("keeps the surrounding facade solid off the door", () => {
    // Same depth but off to the side (a wall, not the door) → solid.
    expect(collidesAt(3.6, 3.9, 0.3, block)).toBe(true);
    // Deep inside the footprint away from the door slot → solid.
    expect(collidesAt(0, 0, 0.3, block)).toBe(true);
  });
});

describe("doorway threshold crossing", () => {
  it("fires entry when walking inward through the door", () => {
    // South face is at z = +4; walking from z=4.5 → z=3.9 at the door centre.
    expect(crossedEntryDoorway(4.5, 3.9, 0, market)).toBe(true);
  });

  it("does not fire entry off-centre, wrong direction, or on props", () => {
    expect(crossedEntryDoorway(4.5, 3.9, 3.2, market)).toBe(false); // off the door
    expect(crossedEntryDoorway(3.9, 4.5, 0, market)).toBe(false); // walking out
    expect(crossedEntryDoorway(4.5, 3.9, 0, smallProp)).toBe(false); // not walk-in (prop at x=20 anyway)
  });

  it("fires exit when walking back out through the interior doorway", () => {
    // Interior depth = clamp(8-0.8)=7.2 → interior south wall at z=+3.6.
    expect(crossedExitDoorway(3.4, 3.8, 0, market)).toBe(true);
    expect(crossedExitDoorway(3.4, 3.8, 3.0, market)).toBe(false);
  });
});
