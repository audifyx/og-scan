import { describe, expect, it } from "vitest";
import { interiorNpcSlots, resolveRoomTheme, type RoomTheme } from "./interiorLayout";
import type { BuildingDefinition } from "./types";

const themes: RoomTheme[] = ["trade", "lounge", "market", "club", "theater", "hq", "launch", "lobby"];

describe("interiorNpcSlots", () => {
  it("places a vendor with a panel for every theme", () => {
    for (const theme of themes) {
      const slots = interiorNpcSlots(theme, 10, 10);
      const vendor = slots.find((s) => s.role === "vendor");
      expect(vendor, `${theme} has vendor`).toBeTruthy();
      expect(vendor!.panel, `${theme} vendor panel`).toBeTruthy();
      expect(slots.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("marks club dancers as dancing", () => {
    const club = interiorNpcSlots("club", 10, 10);
    const dancers = club.filter((s) => s.dancing);
    expect(dancers.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps south doorway clear of NPC x near exit", () => {
    const slots = interiorNpcSlots("hq", 10, 10);
    for (const s of slots) {
      // Doorway corridor roughly |x| < 1.4 near +depth/2
      if (s.z > 10 / 2 - 1.6) {
        expect(Math.abs(s.x)).toBeGreaterThan(1.2);
      }
    }
  });
});

describe("resolveRoomTheme", () => {
  it("maps trading floor to trade", () => {
    const b = {
      id: "tf",
      kind: "trading_floor",
      interaction: "trading",
      name: "Trading Floor",
    } as BuildingDefinition;
    expect(resolveRoomTheme(b)).toBe("trade");
  });
});
