import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isOfficialOrbitxUsername, isOrbitxGoldGlobeProfile, officialUsernameKey } from "./orbitxOfficial";

const SRC = resolve(__dirname, "../components/profile-20x/UserProfile.tsx");

describe("OrbitX gold globe verification", () => {
  it("treats spaced and dotted OrbitX handles as the official account", () => {
    expect(officialUsernameKey("Orbitx world")).toBe("orbitxworld");
    expect(officialUsernameKey("@orbitx.world")).toBe("orbitxworld");
    expect(isOfficialOrbitxUsername("Orbitx world")).toBe(true);
    expect(isOfficialOrbitxUsername("orbitx.world")).toBe(true);
    expect(isOfficialOrbitxUsername("orbitx")).toBe(true);
    expect(isOfficialOrbitxUsername("alice")).toBe(false);
    expect(isOfficialOrbitxUsername("orbitxfan")).toBe(false);
  });

  it("shows the gold globe only on the official / owner OrbitX account", () => {
    expect(isOrbitxGoldGlobeProfile({ username: "Orbitx world", is_official_account: false })).toBe(true);
    expect(isOrbitxGoldGlobeProfile({ username: "alice", is_official_account: true })).toBe(true);
    expect(isOrbitxGoldGlobeProfile({ username: "alice", is_official_account: false })).toBe(false);
    expect(isOrbitxGoldGlobeProfile({ username: "alice", is_official_account: false }, true)).toBe(true);
    expect(isOrbitxGoldGlobeProfile(null)).toBe(false);
  });

  it("places the gold globe beside the profile display name", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toContain("OrbitxGoldGlobe");
    expect(src).toContain("isOrbitxGoldGlobeProfile");
    expect(src).toContain("isOwnerIdentity");
  });
});
