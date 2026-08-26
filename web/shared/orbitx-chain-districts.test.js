import { describe, expect, it } from "vitest";
import {
  DEX_HUBS,
  MAJOR_MINTS,
  TRENDING_LIMIT,
  epsSeries,
  eventBreakdown,
  looksLikeMint,
  matchTokenQuery,
  rankTrending,
  tokenDisplayName,
  tokenLabel,
  tokenTicker,
  dexTokenImage,
  cleanTokenFields,
  mergeDistrict,
} from "./orbitx-chain-districts.js";
import { ORBITX_MINT } from "./orbitx-chain-intel.js";

describe("orbitx-chain-districts", () => {
  it("keeps OrbitX and real DEX hubs in the city catalog", () => {
    expect(MAJOR_MINTS[0]).toBe(ORBITX_MINT);
    expect(DEX_HUBS.map((h) => h.id)).toEqual(["jupiter", "raydium", "pumpfun"]);
    expect(TRENDING_LIMIT).toBe(250);
  });

  it("never uses a mint as the display name", () => {
    const mint = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
    expect(looksLikeMint(mint)).toBe(true);
    expect(tokenDisplayName({ mint, name: mint, symbol: mint })).toBeNull();
    expect(tokenLabel({ mint, name: mint })).toBe("Unnamed token");
    expect(tokenDisplayName({ mint, name: "OrbitX", symbol: "ORBITX" })).toBe("OrbitX");
    expect(tokenTicker({ mint, symbol: "ORBITX" })).toBe("ORBITX");
    expect(tokenTicker({ mint, symbol: mint })).toBeNull();
    expect(dexTokenImage(mint)).toBe(`https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`);
    expect(cleanTokenFields({ mint, name: mint, symbol: mint, image: null }).name).toBeNull();
    expect(cleanTokenFields({ mint, name: mint, symbol: mint, image: null }).image).toBe(dexTokenImage(mint));
  });

  it("ranks the day's high-volume coins and leaves OrbitX out of the 250", () => {
    const rows = [
      { mint: ORBITX_MINT, name: "OrbitX", symbol: "ORBITX", volume_24h: 9e9 },
      { mint: "Aaa1111111111111111111111111111111111111111", name: "Alpha", symbol: "ALPHA", volume_24h: 80_000 },
      { mint: "Bbb1111111111111111111111111111111111111111", name: "Beta", symbol: "BETA", volume_24h: 12_000 },
      { mint: "Ccc1111111111111111111111111111111111111111", name: "Dust", symbol: "DUST", volume_24h: 10 },
    ];
    const ranked = rankTrending(rows, 2);
    expect(ranked.map((t) => t.symbol)).toEqual(["ALPHA", "BETA"]);
    expect(rankTrending(rows, 250).map((t) => t.symbol)).toEqual(["ALPHA", "BETA", "DUST"]);
    expect(ranked.every((t) => t.mint !== ORBITX_MINT)).toBe(true);
    expect(matchTokenQuery(ranked[0], "alp")).toBe(true);
    expect(matchTokenQuery(ranked[0], "$alpha")).toBe(true);
    expect(matchTokenQuery(ranked[0], "zzz")).toBe(false);
  });

  it("computes breakdown and eps only from supplied events", () => {
    const events = [
      { event_type: "BUY", orbitx_related: false, block_time: new Date().toISOString() },
      { event_type: "ORBITX_BUY", orbitx_related: true, block_time: new Date().toISOString() },
      { event_type: "TOKEN_BURN", orbitx_related: false, block_time: new Date().toISOString() },
    ];
    const br = eventBreakdown(events);
    expect(br.find((b) => b.kind === "BUY")?.count).toBe(2);
    expect(br.find((b) => b.kind === "ORBITX")).toBeUndefined();
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

  it("keeps Jupiter 24h buy/sell counts when merging districts", () => {
    const mint = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
    const merged = mergeDistrict(
      { mint, name: "OrbitX", symbol: "ORBITX", source: "dexscreener" },
      { mint, buys_24h: 44, sells_24h: 44, traders_24h: 59, holder_count: 205, source: "jupiter" },
    );
    expect(merged.buys_24h).toBe(44);
    expect(merged.sells_24h).toBe(44);
    expect(merged.traders_24h).toBe(59);
    expect(merged.holder_count).toBe(205);
    expect(cleanTokenFields({ mint, holders: 205 }).holder_count).toBe(205);
  });
});
