import { describe, expect, it } from "vitest";
import { normalizeScreenerRows, normalizeTokenPayload } from "./client";

describe("crypto API DTO normalization", () => {
  it("maps screener rows from { rows }", () => {
    const out = normalizeScreenerRows({
      rows: [{ mint: "Abc", symbol: "TEST", volume24h: 100, priceChange24h: 12 }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].symbol).toBe("TEST");
    expect(out[0].priceChange24h).toBe(12);
  });

  it("maps screener tokens/data aliases", () => {
    expect(normalizeScreenerRows({ tokens: [{ symbol: "A" }] })[0].symbol).toBe("A");
    expect(normalizeScreenerRows({ data: [{ symbol: "B" }] })[0].symbol).toBe("B");
  });

  it("unwraps nested /api/ogdex/token payload", () => {
    const t = normalizeTokenPayload({
      mint: "Mint1",
      token: { symbol: "OBX", name: "OrbitX", priceUsd: 1.5, liquidity: 9000 },
      meta: { image: "https://x/i.png" },
      intel: { holders: [{ owner: "w1", pct: 10 }] },
    });
    expect(t?.symbol).toBe("OBX");
    expect(t?.priceUsd).toBe(1.5);
    expect(t?.liquidityUsd).toBe(9000);
    expect(t?.holders?.[0]?.pct).toBe(10);
    expect(t?.image).toBe("https://x/i.png");
  });
});
