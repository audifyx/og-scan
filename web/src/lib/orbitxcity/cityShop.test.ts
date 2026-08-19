import { describe, expect, it } from "vitest";
import {
  CITY_SHOP_ITEMS,
  CITY_SHOP_MINT,
  bannerTargetsBuilding,
  getShopItem,
  orbitxNeeded,
  ownsItem,
  purchasesToInventory,
  shopPriceOk,
  type ShopPurchase,
} from "./cityShop";

describe("city shop catalog", () => {
  it("keeps every item between $1 and $200", () => {
    expect(CITY_SHOP_ITEMS.length).toBeGreaterThan(10);
    for (const item of CITY_SHOP_ITEMS) {
      expect(shopPriceOk(item)).toBe(true);
    }
  });

  it("uses the official ORBITX mint", () => {
    expect(CITY_SHOP_MINT).toBe("13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9");
  });

  it("covers wear, characters, ads, listings, and perks", () => {
    const cats = new Set(CITY_SHOP_ITEMS.map((i) => i.category));
    expect(cats).toEqual(new Set(["wear", "character", "ads", "listing", "perk"]));
  });

  it("computes a 3% buffered ORBITX burn", () => {
    expect(orbitxNeeded(10, 0.1)).toBeCloseTo(103);
    expect(orbitxNeeded(1, 0)).toBe(0);
  });

  it("treats expired ads as not owned", () => {
    const rows: ShopPurchase[] = [
      {
        itemId: "ad-plaza-1d",
        wallet: "w",
        boughtAt: 1,
        expiresAt: 10,
        swapSig: "s",
        burnSig: "b",
        usd: 10,
        orbitxBurned: 1,
      },
    ];
    expect(ownsItem(rows, "ad-plaza-1d", 9)).toBe(true);
    expect(ownsItem(rows, "ad-plaza-1d", 11)).toBe(false);
  });

  it("maps purchases into inventory kinds", () => {
    const inv = purchasesToInventory([
      {
        itemId: "wear-hoodie",
        wallet: "w",
        boughtAt: 1,
        swapSig: "s",
        burnSig: "b",
        usd: 8,
        orbitxBurned: 2,
      },
    ]);
    expect(inv[0]?.kind).toBe("cosmetic");
    expect(inv[0]?.label).toBe(getShopItem("wear-hoodie")?.name);
  });

  it("matches ad banners onto HQ and walk-in faces", () => {
    expect(bannerTargetsBuilding("kind:hq", "osm-1", "hq", true)).toBe(true);
    expect(bannerTargetsBuilding("kind:walkin", "osm-2", "shop", true)).toBe(true);
    expect(bannerTargetsBuilding("kind:walkin", "osm-3", "generic", false)).toBe(false);
  });
});
