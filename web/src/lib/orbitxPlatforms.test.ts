import { describe, expect, it } from "vitest";
import {
  HOME_DOCK,
  HOME_GRID_KEYS,
  PLATFORM_APPS,
  PLATFORM_MENU,
  PLATFORM_SECTIONS,
  matchPlatformPath,
  publicPlatformApps,
  visibleHomeGridKeys,
  visiblePlatformApps,
  visiblePlatformMenu,
  visiblePlatformSections,
} from "./orbitxPlatforms";

// Current intended layout (2026-10-25 overhaul):
// - City is admin-only (owner email); everyone else gets the app 404.
// - Bagwork is hidden from every menu (menu: false); its route stays live.
// - HQ was removed outright (it was just a copy of the Social app).
const PUBLIC_LIVE = ["dex", "trade", "shop", "supercomputer", "social", "nft", "education", "support"];
const OWNER_ONLY = ["city", "scanner", "vamp", "koltracker", "pnltracker", "gaming"];

describe("OrbitX platform catalog", () => {
  it("lists the live platforms on /app", () => {
    const keys = PLATFORM_APPS.map((a) => a.key);
    for (const key of PUBLIC_LIVE) expect(keys).toContain(key);
    expect(PLATFORM_APPS.find((a) => a.key === "shop")?.href).toBe("/shop");
    expect(PLATFORM_APPS.find((a) => a.key === "city")?.href).toBe("/Orbitxcity");
    expect(PLATFORM_APPS.find((a) => a.key === "city")?.visibility).toBe("admin");
    expect(PLATFORM_APPS.find((a) => a.key === "education")?.href).toBe("/education");
    expect(PLATFORM_APPS.find((a) => a.key === "support")?.href).toBe("/support");
  });

  it("has no HQ entry (removed — it was a copy of Social)", () => {
    expect(PLATFORM_APPS.some((a) => a.key === "hq")).toBe(false);
    expect(PLATFORM_SECTIONS.flatMap((s) => s.keys)).not.toContain("hq");
  });

  it("hides Bagwork from every menu while keeping its route", () => {
    const bagwork = PLATFORM_APPS.find((a) => a.key === "bagwork");
    expect(bagwork?.href).toBe("/bagwork");
    expect(bagwork?.menu).toBe(false);
    expect(HOME_GRID_KEYS).not.toContain("bagwork");
    expect(PLATFORM_MENU.some((a) => a.key === "bagwork")).toBe(false);
  });

  it("puts live platforms on the public home grid and mini menu", () => {
    for (const key of PUBLIC_LIVE) {
      expect(HOME_GRID_KEYS).toContain(key);
      expect(PLATFORM_MENU.some((a) => a.key === key)).toBe(true);
    }
    for (const key of OWNER_ONLY) {
      expect(HOME_GRID_KEYS).not.toContain(key);
      expect(PLATFORM_MENU.some((a) => a.key === key)).toBe(false);
    }
  });

  it("shows admin-only surfaces only to the owner", () => {
    const publicKeys = publicPlatformApps().map((a) => a.key);
    for (const key of OWNER_ONLY) {
      expect(publicKeys).not.toContain(key);
      expect(visiblePlatformApps(true).some((a) => a.key === key)).toBe(true);
    }
    expect(visibleHomeGridKeys(true)).toContain("city");
    expect(visiblePlatformMenu(true).some((a) => a.key === "supercomputer")).toBe(true);
    expect(visiblePlatformSections(false).every((s) => s.keys.every((k) => !OWNER_ONLY.includes(k)))).toBe(true);
  });

  it("pins DEX, Shop, Super Computer, City, and Education as command deck gates", () => {
    expect(HOME_DOCK.map((a) => a.key)).toEqual(["dex", "shop", "supercomputer", "city", "education"]);
  });

  it("covers every catalog key in a section", () => {
    const sectionKeys = new Set(PLATFORM_SECTIONS.flatMap((s) => s.keys));
    for (const app of PLATFORM_APPS) {
      expect(sectionKeys.has(app.key), app.key).toBe(true);
    }
  });

  it("matches platform path prefixes", () => {
    expect(matchPlatformPath("/os", "/os/dashboard")).toBe(true);
    expect(matchPlatformPath("/hq", "/hq/feed")).toBe(true);
    expect(matchPlatformPath("/Orbitxcity", "/orbitxcity")).toBe(true);
    expect(matchPlatformPath("/shop", "/agent")).toBe(false);
    expect(matchPlatformPath("/agentcalls", "/agentcalls")).toBe(true);
    expect(matchPlatformPath("/agentcalls", "/agent-calls")).toBe(true);
    expect(matchPlatformPath("/agentcalls", "/calls")).toBe(false);
  });
});
