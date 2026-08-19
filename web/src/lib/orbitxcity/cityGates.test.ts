import { describe, expect, it } from "vitest";
import { CITY_GATES, GATE_COPY } from "./cityGates";

describe("cityGates", () => {
  it("lists every pre-world page plus world", () => {
    expect(CITY_GATES).toEqual([
      "menu",
      "characters",
      "lobbies",
      "settings",
      "help",
      "quick",
      "world",
    ]);
  });

  it("gives each page gate a unique title", () => {
    const titles = Object.values(GATE_COPY).map((copy) => copy.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(GATE_COPY.characters.title).toMatch(/mascot/i);
    expect(GATE_COPY.settings.title).toBe("Settings");
    expect(GATE_COPY.help.title).toBe("Controls");
  });
});
