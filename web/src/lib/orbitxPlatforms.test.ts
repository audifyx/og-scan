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

const REQUIRED = ["shop", "city", "os", "play", "intel", "predict", "agent", "dex", "telegram", "trade", "support"];
const OWNER_ONLY = ["terminal", "scanner", "vamp", "koltracker", "pnltracker", "xmcp", "hq", "gaming"];

describe("OrbitX platform catalog", () => {
  it("lists the live world / MCP / intel platforms on /app", () => {
    const keys = PLATFORM_APPS.map((a) => a.key);
    for (const key of REQUIRED) {
      expect(keys).toContain(key);
    }
    expect(PLATFORM_APPS.find((a) => a.key === "shop")?.href).toBe("/shop");
    expect(PLATFORM_APPS.find((a) => a.key === "city")?.href).toBe("/Orbitxcity");
    expect(PLATFORM_APPS.find((a) => a.key === "os")?.href).toBe("/os");
    expect(PLATFORM_APPS.find((a) => a.key === "play")?.href).toBe("/play");
    expect(PLATFORM_APPS.find((a) => a.key === "intel")?.href).toBe("/intel");
    expect(PLATFORM_APPS.find((a) => a.key === "hq")?.href).toBe("/hq");
    expect(PLATFORM_APPS.find((a) => a.key === "predict")?.href).toBe("/predictions");
    expect(PLATFORM_APPS.find((a) => a.key === "telegram")?.href).toBe("/telegram");
    expect(PLATFORM_APPS.find((a) => a.key === "support")?.href).toBe("/support");
  });

  it("puts live platforms on the public home grid and mini menu", () => {
    for (const key of REQUIRED) {
      expect(HOME_GRID_KEYS).toContain(key);
      expect(PLATFORM_MENU.some((a) => a.key === key)).toBe(true);
    }
    for (const key of OWNER_ONLY) {
      expect(HOME_GRID_KEYS).not.toContain(key);
      expect(PLATFORM_MENU.some((a) => a.key === key)).toBe(false);
    }
  });

  it("shows unfinished surfaces only to the owner", () => {
    const publicKeys = publicPlatformApps().map((a) => a.key);
    for (const key of OWNER_ONLY) {
      expect(publicKeys).not.toContain(key);
      expect(visiblePlatformApps(true).some((a) => a.key === key)).toBe(true);
    }
    expect(visibleHomeGridKeys(true)).toContain("terminal");
    expect(visiblePlatformMenu(true).some((a) => a.key === "xmcp")).toBe(true);
    expect(visiblePlatformSections(false).every((s) => s.keys.every((k) => !OWNER_ONLY.includes(k)))).toBe(true);
  });

  it("pins Shop, Agent, DEX, and City as command deck gates", () => {
    expect(HOME_DOCK.map((a) => a.key)).toEqual(["dex", "agent", "shop", "city"]);
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
  });
});
