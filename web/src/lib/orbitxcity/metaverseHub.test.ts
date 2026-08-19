import { afterEach, describe, expect, it } from "vitest";
import { getWorldBlock } from "./worlds";
import {
  bodyTypeScale,
  deleteCharacterSlot,
  hubZonesForBlock,
  loadCharacterSlots,
  loadPartyIds,
  loadWishlist,
  saveCharacterSlot,
  shopRarity,
  sortScreener,
  togglePartyMember,
  toggleWishlist,
} from "./metaverseHub";
import type { AvatarAppearance } from "./types";

const look: AvatarAppearance = {
  name: "Tester",
  bodyColor: "#1a2438",
  accentColor: "#00ff9f",
  skinColor: "#e8d5c0",
  hairStyle: "short",
  hairColor: "#101014",
  outfit: "street",
  faceStyle: "cool",
  beardStyle: "stubble",
  bodyType: "strong",
};

afterEach(() => {
  localStorage.clear();
});

describe("metaverse hub Alpha data", () => {
  it("maps NYC OSM landmarks onto five hub districts", () => {
    const block = getWorldBlock("nyc");
    const zones = hubZonesForBlock(block);
    expect(zones.map((z) => z.id)).toEqual(["hub", "financial", "commercial", "creative", "residential"]);
    expect(zones[0]?.label).toBe("Main Plaza");
    expect(zones[0]?.x).toBe(block.spawn.x);
    expect(zones[0]?.z).toBe(block.spawn.z);
    expect(zones.every((z) => Number.isFinite(z.x) && Number.isFinite(z.z))).toBe(true);
  });

  it("tags shop prices by rarity band", () => {
    expect(shopRarity(3)).toBe("common");
    expect(shopRarity(12)).toBe("rare");
    expect(shopRarity(35)).toBe("epic");
    expect(shopRarity(80)).toBe("legendary");
  });

  it("sorts screener rows by name, price, and change", () => {
    const rows = [
      { symbol: "B", priceUsd: 1, change24h: 10 },
      { symbol: "A", priceUsd: 5, change24h: -1 },
    ];
    expect(sortScreener(rows, "name")[0]?.symbol).toBe("A");
    expect(sortScreener(rows, "price")[0]?.symbol).toBe("A");
    expect(sortScreener(rows, "change")[0]?.symbol).toBe("B");
  });

  it("scales slim and strong body types", () => {
    expect(bodyTypeScale("slim").x).toBeLessThan(1);
    expect(bodyTypeScale("strong").x).toBeGreaterThan(1);
    expect(bodyTypeScale("standard")).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("toggles a shop wishlist in localStorage", () => {
    expect(loadWishlist()).toEqual([]);
    expect(toggleWishlist("wear-hoodie")).toEqual(["wear-hoodie"]);
    expect(toggleWishlist("wear-hoodie")).toEqual([]);
  });

  it("saves and deletes character slots", () => {
    const saved = saveCharacterSlot(look);
    expect(saved).toHaveLength(1);
    expect(loadCharacterSlots()[0]?.appearance.bodyType).toBe("strong");
    expect(deleteCharacterSlot(saved[0]!.id)).toEqual([]);
  });

  it("caps a party at eight members", () => {
    for (let i = 0; i < 9; i += 1) togglePartyMember(`p${i}`);
    expect(loadPartyIds()).toHaveLength(8);
    expect(togglePartyMember("p0")).not.toContain("p0");
  });
});
