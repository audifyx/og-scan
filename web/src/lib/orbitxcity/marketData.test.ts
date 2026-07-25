import { describe, expect, it } from "vitest";
import { fmtPct, fmtUsd, normalizeScreenerRows, shortMint } from "./marketData";

describe("orbitxcity marketData", () => {
  it("normalizes screener rows from { rows }", () => {
    const rows = normalizeScreenerRows({
      rows: [{ symbol: "OBX", name: "OrbitX", mint: "Abc123Mint", priceUsd: 1.25, change24h: 4.5 }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe("OBX");
    expect(rows[0].priceUsd).toBe(1.25);
  });

  it("formats helpers", () => {
    expect(shortMint("ABCDEFGHijklmnop", 4)).toBe("ABCD…mnop");
    expect(fmtUsd(1500)).toBe("$1.5K");
    expect(fmtPct(2.5)).toBe("+2.50%");
  });
});
