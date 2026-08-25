import { describe, expect, it } from "vitest";
import { DEX_HUBS, MAJOR_MINTS, epsSeries, eventBreakdown } from "./orbitx-chain-districts.js";
import { ORBITX_MINT } from "./orbitx-chain-intel.js";

describe("orbitx-chain-districts", () => {
  it("keeps OrbitX and real DEX hubs in the city catalog", () => {
    expect(MAJOR_MINTS[0]).toBe(ORBITX_MINT);
    expect(DEX_HUBS.map((h) => h.id)).toEqual(["jupiter", "raydium", "pumpfun"]);
  });

  it("computes breakdown and eps only from supplied events", () => {
    const events = [
      { event_type: "BUY", orbitx_related: false, block_time: new Date().toISOString() },
      { event_type: "ORBITX_BUY", orbitx_related: true, block_time: new Date().toISOString() },
      { event_type: "TOKEN_BURN", orbitx_related: false, block_time: new Date().toISOString() },
    ];
    const br = eventBreakdown(events);
    expect(br.find((b) => b.kind === "BUY")?.count).toBe(1);
    expect(br.find((b) => b.kind === "ORBITX")?.count).toBe(1);
    expect(br.find((b) => b.kind === "BURN")?.count).toBe(1);
    expect(br.reduce((s, b) => s + b.count, 0)).toBe(3);
    const series = epsSeries(events, 120_000, 12);
    expect(series).toHaveLength(12);
    expect(series.reduce((s, p) => s + p.eps, 0)).toBeGreaterThan(0);
  });

  it("returns empty activity when there are no events", () => {
    expect(eventBreakdown([]).every((b) => b.count === 0 && b.pct === 0)).toBe(true);
    expect(epsSeries([], 120_000, 6).every((p) => p.eps === 0)).toBe(true);
  });
});
