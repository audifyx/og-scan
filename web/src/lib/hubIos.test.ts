import { describe, expect, it } from "vitest";
import { groupAppsByLetter, islandQuickAccess } from "./hubIos";
import { PLATFORM_SECTIONS, publicPlatformApps, visiblePlatformApps } from "./orbitxPlatforms";

describe("iOS Apps library helpers", () => {
  it("groups catalog apps A–Z for the App Library list", () => {
    const catalog = publicPlatformApps();
    const buckets = groupAppsByLetter(catalog);
    expect(buckets.length).toBeGreaterThan(3);
    expect(buckets.every((b) => b.letter.length === 1)).toBe(true);
    expect(buckets.flatMap((b) => b.apps)).toHaveLength(catalog.length);
    const names = buckets.flatMap((b) => b.apps.map((a) => a.name));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("puts every public catalog app in the island quick-access grid", () => {
    const catalog = publicPlatformApps();
    const apps = islandQuickAccess(catalog);
    expect(apps.map((a) => a.key)).toEqual(catalog.map((a) => a.key));
    expect(apps.length).toBeGreaterThanOrEqual(12);
    expect(apps.some((a) => a.key === "terminal")).toBe(false);
    expect(visiblePlatformApps(true).some((a) => a.key === "terminal")).toBe(true);
  });

  it("gives every section enough apps to fill an iOS folder", () => {
    for (const section of PLATFORM_SECTIONS) {
      expect(section.keys.length).toBeGreaterThan(0);
    }
  });
});
