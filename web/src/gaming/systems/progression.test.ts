import { describe, expect, it } from "vitest";
import { levelFromXp, xpProgress, xpToReachLevel } from "@/gaming/systems/progression";
import { createNewProfile } from "@/gaming/state/GameProfileStore";
import { applyClass } from "@/gaming/systems/character";
import { buyWithShards } from "@/gaming/systems/economy";

describe("OrbitX gaming progression", () => {
  it("levels from XP curve", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(xpToReachLevel(5))).toBe(5);
    const p = xpProgress(xpToReachLevel(3) + 10);
    expect(p.level).toBe(3);
    expect(p.into).toBe(10);
  });

  it("applies class starter gear", () => {
    let profile = createNewProfile("Tester");
    profile = applyClass(profile, "striker");
    expect(profile.character.classId).toBe("striker");
    expect(profile.inventory.some((i) => i.itemId === "blade-spark")).toBe(true);
  });

  it("buys items with shards", () => {
    let profile = createNewProfile("Buyer");
    profile = { ...profile, progression: { ...profile.progression, shards: 500 } };
    const res = buyWithShards(profile, "boots-runner");
    expect(res.ok).toBe(true);
    expect(res.profile.progression.shards).toBeLessThan(500);
    expect(res.profile.inventory.some((i) => i.itemId === "boots-runner")).toBe(true);
  });
});
