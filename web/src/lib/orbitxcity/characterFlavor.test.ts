import { describe, expect, it } from "vitest";
import { CHARACTER_CLASSES } from "./characterClasses";
import { CHARACTER_FLAVOR } from "./characterFlavor";

describe("characterFlavor", () => {
  it("covers every mascot with a unique handle and kit", () => {
    const handles = new Set<string>();
    for (const cls of CHARACTER_CLASSES) {
      const flavor = CHARACTER_FLAVOR[cls.id];
      expect(flavor.handle).toMatch(/^@/);
      expect(flavor.perk.length).toBeGreaterThan(3);
      expect(flavor.kit).toHaveLength(3);
      expect(flavor.lore.length).toBeGreaterThan(20);
      handles.add(flavor.handle);
    }
    expect(handles.size).toBe(CHARACTER_CLASSES.length);
  });
});
