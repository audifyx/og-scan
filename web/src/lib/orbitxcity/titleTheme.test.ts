import { describe, expect, it } from "vitest";
import {
  TITLE_NAV,
  TITLE_THEMES,
  isArcadeLime,
  resolveTitleTheme,
  titleCssVars,
  titleThemeUsesArcadeLime,
} from "./titleTheme";

describe("titleTheme", () => {
  it("resolves known districts and falls back to NYC", () => {
    expect(resolveTitleTheme("la").id).toBe("la");
    expect(resolveTitleTheme("unknown").id).toBe("nyc");
    expect(resolveTitleTheme(undefined).id).toBe("nyc");
  });

  it("keeps every district off arcade lime", () => {
    for (const theme of Object.values(TITLE_THEMES)) {
      expect(titleThemeUsesArcadeLime(theme)).toBe(false);
      expect(isArcadeLime(theme.uiAccent)).toBe(false);
    }
  });

  it("exposes a five-item console nav with a single primary", () => {
    expect(TITLE_NAV.map((item) => item.id)).toEqual([
      "play",
      "multiplayer",
      "settings",
      "help",
      "quick",
    ]);
    expect(TITLE_NAV.filter((item) => item.primary)).toHaveLength(1);
  });

  it("maps theme tokens to CSS custom properties", () => {
    const vars = titleCssVars(TITLE_THEMES.boston);
    expect(vars["--title-accent"]).toBe(TITLE_THEMES.boston.uiAccent);
    expect(vars["--menu-accent"]).toBe(TITLE_THEMES.boston.uiAccent);
    expect(isArcadeLime(vars["--title-accent"] ?? "")).toBe(false);
  });
});
