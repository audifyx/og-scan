import { describe, expect, it } from "vitest";
import {
  CHARACTER_CLASSES,
  appearanceFromClass,
  getCharacterClass,
} from "./characterClasses";

describe("characterClasses", () => {
  it("exposes five holographic pods", () => {
    expect(CHARACTER_CLASSES).toHaveLength(5);
    expect(CHARACTER_CLASSES.map((c) => c.id)).toEqual([
      "trader",
      "builder",
      "gamer",
      "creator",
      "explorer",
    ]);
  });

  it("maps class to avatar appearance", () => {
    const trader = getCharacterClass("trader");
    const a = appearanceFromClass(trader, "Nova");
    expect(a.name).toBe("Nova");
    expect(a.classId).toBe("trader");
    expect(a.accentColor).toBe(trader.accentColor);
  });
});
