import { describe, expect, it } from "vitest";
import {
  CHARACTER_CLASSES,
  appearanceFromClass,
  getCharacterClass,
  hasBuilderMissionPerk,
  hasCreatorPresencePerk,
  hasTraderTerminalPerk,
  missionClaimCooldownMs,
  resolveClassId,
} from "./characterClasses";

describe("characterClasses", () => {
  it("exposes five crypto-native mascots", () => {
    expect(CHARACTER_CLASSES).toHaveLength(5);
    expect(CHARACTER_CLASSES.map((c) => c.id)).toEqual(["pepe", "wojak", "chad", "doge", "anon"]);
  });

  it("aliases legacy class ids onto mascots", () => {
    expect(resolveClassId("trader")).toBe("pepe");
    expect(resolveClassId("builder")).toBe("anon");
    expect(resolveClassId("gamer")).toBe("chad");
    expect(resolveClassId("creator")).toBe("wojak");
    expect(resolveClassId("explorer")).toBe("doge");
    expect(getCharacterClass("trader").id).toBe("pepe");
  });

  it("maps mascot to in-world appearance", () => {
    const pepe = getCharacterClass("pepe");
    const a = appearanceFromClass(pepe, "Nova");
    expect(a.name).toBe("Nova");
    expect(a.classId).toBe("pepe");
    expect(a.accentColor).toBe(pepe.accentColor);
    expect(a.skinColor).toBe(pepe.skinColor);
    expect(pepe.skinColor.toLowerCase()).not.toBe("#5cb85c");
  });

  it("gives each mascot a distinct silhouette + palette", () => {
    const accents = new Set(CHARACTER_CLASSES.map((c) => c.accentColor));
    expect(accents.size).toBe(5);
    for (const cls of CHARACTER_CLASSES) {
      expect(cls.scale.y).toBeGreaterThan(0.8);
      const look = appearanceFromClass(cls);
      expect(look.classId).toBe(cls.id);
      expect(look.outfit).toBeTruthy();
    }
    expect(appearanceFromClass(getCharacterClass("anon")).outfit).toBe("suit");
    expect(appearanceFromClass(getCharacterClass("doge")).faceStyle).toBe("smile");
    expect(appearanceFromClass(getCharacterClass("wojak")).outfit).toBe("hoodie");
    expect(appearanceFromClass(getCharacterClass("chad")).beardStyle).toBe("full");
    expect(appearanceFromClass(getCharacterClass("pepe")).beardStyle).toBe("goatee");
    for (const cls of CHARACTER_CLASSES) {
      expect(cls.scale.y).toBeGreaterThanOrEqual(1);
    }
  });

  it("maps perks through aliases", () => {
    expect(hasTraderTerminalPerk("pepe")).toBe(true);
    expect(hasTraderTerminalPerk("trader")).toBe(true);
    expect(hasBuilderMissionPerk("anon")).toBe(true);
    expect(hasBuilderMissionPerk("builder")).toBe(true);
    expect(hasCreatorPresencePerk("wojak")).toBe(true);
    expect(hasCreatorPresencePerk("creator")).toBe(true);
    expect(missionClaimCooldownMs("trader", false)).toBe(30_000);
    expect(missionClaimCooldownMs("builder", false)).toBe(8_000);
    expect(missionClaimCooldownMs("anon", true)).toBe(2_000);
  });
});
