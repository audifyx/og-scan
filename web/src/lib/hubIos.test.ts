import { describe, expect, it } from "vitest";
import { groupAppsByLetter } from "./hubIos";
import { PLATFORM_APPS, PLATFORM_SECTIONS } from "./orbitxPlatforms";

describe("iOS Apps library helpers", () => {
  it("groups catalog apps A–Z for the App Library list", () => {
    const buckets = groupAppsByLetter(PLATFORM_APPS);
    expect(buckets.length).toBeGreaterThan(3);
    expect(buckets.every((b) => b.letter.length === 1)).toBe(true);
    expect(buckets.flatMap((b) => b.apps)).toHaveLength(PLATFORM_APPS.length);
    const names = buckets.flatMap((b) => b.apps.map((a) => a.name));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("gives every section enough apps to fill an iOS folder", () => {
    for (const section of PLATFORM_SECTIONS) {
      expect(section.keys.length).toBeGreaterThan(0);
    }
  });
});
