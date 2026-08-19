import { describe, expect, it } from "vitest";
import {
  ORBITX_SHOP_CATEGORIES,
  ORBITX_SHOP_SKUS,
  formatShopTeamMessage,
  getShopSku,
  shopMemo,
  snapShopUsd,
  usdToShopSol,
} from "@/lib/orbitx/desk-shop-catalog";

describe("OrbitX desk shop catalog", () => {
  it("ports the Solana-betting shop SKU count and hero items", () => {
    expect(ORBITX_SHOP_SKUS).toHaveLength(421);
    expect(new Set(ORBITX_SHOP_SKUS.map((s) => s.sku)).size).toBe(421);
    expect(getShopSku("list-token")?.usd).toBe(25);
    expect(getShopSku("spotlight-24h")?.usd).toBe(49);
    expect(getShopSku("featured-7d")?.usd).toBe(99);
    expect(getShopSku("year-stack")?.usd).toBe(200);
    expect(ORBITX_SHOP_CATEGORIES.map((c) => c.id)).toEqual([
      "board",
      "intel",
      "access",
      "desk",
      "social",
      "tools",
      "creator",
    ]);
  });

  it("snaps USD to the live ladder and converts SOL from a live quote", () => {
    expect(snapShopUsd(11.2)).toBe(12);
    expect(usdToShopSol(25, 150)).toBeCloseTo(0.166667, 5);
  });

  it("builds the team copy-paste burn note", () => {
    const note = formatShopTeamMessage({
      usd: 25,
      sol: 0.166667,
      orbitxBurned: 1234.56,
      itemName: "List a token",
      sku: "list-token",
      signature: "5".repeat(64),
      mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
      name: "OrbitX",
      ticker: "ORBITX",
      wallet: "4xT5QZnwtdZKAW5ZcRziEakTwNdnfKMgp1cEVaJmewxd",
      details: "Launching tonight",
    });
    expect(note).toContain("I have burned (1234.56 $ORBITX ($25 · 0.166667 SOL)) for this shop item (List a token)");
    expect(note).toContain("here is solscan (https://solscan.io/tx/");
    expect(note).toContain("here is my projects detailed below 👇");
    expect(note).toContain("Launching tonight");
    expect(note).toContain("t.me/orbitxwrld");
    expect(shopMemo("list-token", "4xT5QZnwtdZKAW5ZcRziEakTwNdnfKMgp1cEVaJmewxd")).toMatch(/^ox shop list-token /);
  });
});
