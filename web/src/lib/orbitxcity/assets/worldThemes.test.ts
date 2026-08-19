import { describe, expect, it } from "vitest";
import { getWorldTheme } from "./worldThemes";

describe("worldThemes night district", () => {
  it("keeps Midtown on a night sky, not daytime suburb", () => {
    const nyc = getWorldTheme("nyc");
    expect(nyc.background.startsWith("#0")).toBe(true);
    expect(nyc.fog.startsWith("#1")).toBe(true);
    expect(nyc.neon).toBe("#00ff9f");
    expect(nyc.warm).toBe("#c5a26f");
  });
});
