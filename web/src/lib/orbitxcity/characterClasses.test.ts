import { describe, expect, it } from "vitest";
import {
  CHARACTER_CLASSES,
  appearanceFromClass,
  classPowerIndex,
  getCharacterClass,
  getRarityMeta,
  hasBuilderMissionPerk,
  hasCreatorPresencePerk,
  hasProtocolInspectPerk,
  hasTraderTerminalPerk,
  missionClaimCooldownMs,
  resolveClassId,
} from "./characterClasses";

describe("characterClasses", () => {
  it("exposes six crypto-native mascots", () => {
    expect(CHARACTER_CLASSES).toHaveLength(6);
    expect(CHARACTER_CLASSES.map((c) => c.id)).toEqual([
      "pepe",
      "wojak",
      "chad",
      "doge",
      "anon",
      "vitalik",
    ]);
  });

  it("gives every mascot rarity, movement and a build recipe", () => {
    for (const cls of CHARACTER_CLASSES) {
      expect(["common", "rare", "epic", "legendary"]).toContain(cls.rarity);
      expect(cls.movement.speed).toBeGreaterThan(0.5);
      expect(cls.movement.jump).toBeGreaterThan(0.5);
      expect(cls.build.head).toBeTruthy();
      expect(cls.build.torso).toBeTruthy();
      expect(cls.handle.startsWith("@")).toBe(true);
      expect(cls.stats.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("computes a sane power index", () => {
    for (const cls of CHARACTER_CLASSES) {
      const p = classPowerIndex(cls.id);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThanOrEqual(100);
    }
    expect(getRarityMeta("vitalik").label).toBe("Legendary");
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
  });

  it("gives each mascot a distinct silhouette + palette", () => {
    const accents = new Set(CHARACTER_CLASSES.map((c) => c.accentColor));
    expect(accents.size).toBe(6);
    for (const cls of CHARACTER_CLASSES) {
      expect(cls.scale.y).toBeGreaterThan(0.8);
      const look = appearanceFromClass(cls);
      expect(look.classId).toBe(cls.id);
      expect(look.outfit).toBeTruthy();
    }
    expect(appearanceFromClass(getCharacterClass("anon")).outfit).toBe("suit");
    expect(appearanceFromClass(getCharacterClass("doge")).faceStyle).toBe("smile");
  });

  it("maps perks through aliases", () => {
    expect(hasTraderTerminalPerk("pepe")).toBe(true);
    expect(hasTraderTerminalPerk("trader")).toBe(true);
    expect(hasBuilderMissionPerk("anon")).toBe(true);
    expect(hasBuilderMissionPerk("builder")).toBe(true);
    expect(hasCreatorPresencePerk("wojak")).toBe(true);
    expect(hasCreatorPresencePerk("creator")).toBe(true);
    expect(hasBuilderMissionPerk("vitalik")).toBe(true);
    expect(hasProtocolInspectPerk("vitalik")).toBe(true);
    expect(hasProtocolInspectPerk("anon")).toBe(false);
    expect(missionClaimCooldownMs("trader", false)).toBe(30_000);
    expect(missionClaimCooldownMs("builder", false)).toBe(8_000);
    expect(missionClaimCooldownMs("anon", true)).toBe(2_000);
  });
});
