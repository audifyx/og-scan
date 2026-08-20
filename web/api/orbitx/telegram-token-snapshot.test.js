import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ORBITX_MINT,
  assembleTelegramSnapshot,
  clearTelegramSnapshotCache,
  fetchTelegramTokenSnapshot,
  hasMarketSnapshot,
  jupListFromRaw,
} from "./telegram-token-snapshot.js";

afterEach(() => {
  clearTelegramSnapshotCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("telegram token snapshot quotes", () => {
  it("treats an empty Jupiter search array as missing so price v3 can fill", () => {
    expect(jupListFromRaw([], ORBITX_MINT)).toBeNull();
  });

  it("overlays Jupiter price v3 when search has identity but no usdPrice", () => {
    const merged = assembleTelegramSnapshot(ORBITX_MINT, {
      jupSearch: [{ id: ORBITX_MINT, name: "ORBITX", symbol: "ORBITX" }],
      jupPriceLite: { [ORBITX_MINT]: { usdPrice: 0.00007512, liquidity: 9411 } },
    });
    expect(hasMarketSnapshot(merged.token)).toBe(true);
    expect(merged.token.priceUsd).toBeCloseTo(0.00007512);
    expect(merged.token.liquidity).toBeCloseTo(9411);
    expect(merged.token.name).toBe("ORBITX");
  });

  it("fetches Jupiter price v3 in parallel even when search returns a token", async () => {
    const urls = [];
    vi.stubGlobal("fetch", async (url) => {
      urls.push(String(url));
      const href = String(url);
      if (href.includes("tokens/v2/search")) {
        return {
          ok: true,
          json: async () => [{ id: ORBITX_MINT, name: "ORBITX", symbol: "ORBITX" }],
        };
      }
      if (href.includes("price/v3")) {
        return {
          ok: true,
          json: async () => ({ [ORBITX_MINT]: { usdPrice: 0.000081, liquidity: 8000 } }),
        };
      }
      return { ok: false, status: 503, json: async () => ({}) };
    });
    const snap = await fetchTelegramTokenSnapshot(ORBITX_MINT);
    expect(urls.some((u) => u.includes("price/v3"))).toBe(true);
    expect(urls.some((u) => u.includes("latest/dex/tokens"))).toBe(true);
    expect(urls.some((u) => u.includes("token-pairs/v1"))).toBe(true);
    expect(hasMarketSnapshot(snap.token)).toBe(true);
    expect(snap.token.priceUsd).toBeCloseTo(0.000081);
  });
});
