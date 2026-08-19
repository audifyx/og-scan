import { describe, expect, it } from "vitest";
import { getWorldTheme } from "./worldThemes";

describe("worldThemes daylight hub", () => {
  it("keeps Midtown on a bright Roblox-like sky", () => {
    const nyc = getWorldTheme("nyc");
    expect(nyc.background.startsWith("#7")).toBe(true);
    expect(nyc.neon).toBe("#00ff9f");
    expect(nyc.warm).toBe("#c5a26f");
  });
});
