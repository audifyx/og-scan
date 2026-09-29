/**
 * Gadgets module unit tests — pure logic only (catalog + inventory reducers).
 * Run: pnpm vitest run src/city/modules/gadgets
 */
import { describe, expect, it } from "vitest";
import {
  catalogBurnTotal,
  GADGET_CATALOG,
  getGadget,
  SCAN_MINTS,
  SCAN_SYMBOLS,
} from "./catalog";
import { applyEquip, applyPurchase } from "./store";
import type { GadgetBurnRecord, GadgetInventoryState } from "./types";

const EMPTY: GadgetInventoryState = { owned: [], equipped: null, burns: [] };

function burn(id: "grappling-hook" | "token-scanner", amount: number): GadgetBurnRecord {
  return {
    at: 1_700_000_000_000,
    gadgetId: id,
    gadgetLabel: id,
    amount,
    signature: "sig-test",
    ref: "ref-test",
  };
}

describe("gadget catalog", () => {
  it("lists the two approved gadgets with positive ORBITX burn prices", () => {
    expect(GADGET_CATALOG.map((g) => g.id).sort()).toEqual([
      "grappling-hook",
      "token-scanner",
    ]);
    for (const g of GADGET_CATALOG) {
      expect(g.priceOrbitx).toBeGreaterThan(0);
      expect(Number.isInteger(g.priceOrbitx)).toBe(true);
    }
  });

  it("catalogBurnTotal equals the sum of prices", () => {
    const sum = GADGET_CATALOG.reduce((s, g) => s + g.priceOrbitx, 0);
    expect(catalogBurnTotal()).toBe(sum);
  });

  it("getGadget resolves known ids and throws on unknown", () => {
    expect(getGadget("grappling-hook").label).toBe("Grapple Hook");
    expect(() => getGadget("jetpack" as never)).toThrow();
  });

  it("every scan mint has a symbol", () => {
    for (const mint of SCAN_MINTS) {
      expect(SCAN_SYMBOLS[mint as string]).toBeTruthy();
    }
  });
});

describe("inventory reducers", () => {
  it("applyPurchase adds ownership + burn receipt, and is idempotent", () => {
    const s1 = applyPurchase(EMPTY, "grappling-hook", burn("grappling-hook", 25));
    expect(s1.owned).toEqual(["grappling-hook"]);
    expect(s1.burns).toHaveLength(1);
    expect(s1.burns[0]?.amount).toBe(25);
    // buying again changes nothing
    expect(applyPurchase(s1, "grappling-hook", burn("grappling-hook", 25))).toBe(s1);
  });

  it("applyEquip only equips owned gadgets", () => {
    expect(applyEquip(EMPTY, "grappling-hook").equipped).toBeNull();
    const s1 = applyPurchase(EMPTY, "token-scanner", burn("token-scanner", 15));
    expect(applyEquip(s1, "token-scanner").equipped).toBe("token-scanner");
    expect(applyEquip(s1, null).equipped).toBeNull();
  });
});
