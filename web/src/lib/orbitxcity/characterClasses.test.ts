import { describe, expect, it } from "vitest";
import {
  CHARACTER_CLASSES,
  appearanceFromClass,
  getCharacterClass,
  hasBuilderMissionPerk,
  hasCreatorPresencePerk,
  missionClaimCooldownMs,
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
    expect(a.outfit).toBe("suit");
    expect(a.hairStyle).toBe("short");
  });

  it("gives each class a distinct silhouette + palette", () => {
    const accents = new Set(CHARACTER_CLASSES.map((c) => c.accentColor));
    expect(accents.size).toBe(5);
    for (const cls of CHARACTER_CLASSES) {
      expect(cls.scale.y).toBeGreaterThan(0.9);
      const look = appearanceFromClass(cls);
      expect(look.classId).toBe(cls.id);
      expect(look.hairStyle).toBeTruthy();
      expect(look.outfit).toBeTruthy();
    }
    expect(appearanceFromClass(getCharacterClass("gamer")).hairStyle).toBe("mohawk");
    expect(appearanceFromClass(getCharacterClass("builder")).outfit).toBe("street");
  });

  it("ships builder / creator cooldown and presence perks", () => {
    expect(hasBuilderMissionPerk("builder")).toBe(true);
    expect(hasCreatorPresencePerk("creator")).toBe(true);
    expect(missionClaimCooldownMs("trader", false)).toBe(30_000);
    expect(missionClaimCooldownMs("builder", false)).toBe(8_000);
    expect(missionClaimCooldownMs("builder", true)).toBe(2_000);
  });
});
