import { describe, expect, it } from "vitest";
import {
  EMPTY_OS_WINDOWS,
  osWindowsReducer,
  topWindow,
  type OsWindow,
} from "./osWindows";

const win = (id: string, title: string): Omit<OsWindow, "z" | "minimized" | "maximized"> => ({
  id,
  kind: "app",
  appKey: id,
  title,
  x: 100,
  y: 80,
  w: 800,
  h: 520,
});

describe("osWindowsReducer", () => {
  it("opens windows with rising z-order", () => {
    const s1 = osWindowsReducer(EMPTY_OS_WINDOWS, { type: "open", window: win("a", "A") });
    const s2 = osWindowsReducer(s1, { type: "open", window: win("b", "B") });
    expect(s2.windows).toHaveLength(2);
    expect(s2.windows[1].z).toBeGreaterThan(s2.windows[0].z);
    expect(topWindow(s2)?.id).toBe("b");
  });

  it("opening the same app twice focuses instead of duplicating", () => {
    const s1 = osWindowsReducer(EMPTY_OS_WINDOWS, { type: "open", window: win("a", "A") });
    const s2 = osWindowsReducer(s1, { type: "open", window: win("b", "B") });
    const s3 = osWindowsReducer(s2, { type: "open", window: win("a", "A") });
    expect(s3.windows).toHaveLength(2);
    expect(topWindow(s3)?.id).toBe("a");
  });

  it("minimize hides from top, restore brings it back", () => {
    const s1 = osWindowsReducer(EMPTY_OS_WINDOWS, { type: "open", window: win("a", "A") });
    const s2 = osWindowsReducer(s1, { type: "minimize", id: "a" });
    expect(topWindow(s2)).toBeNull();
    const s3 = osWindowsReducer(s2, { type: "restore", id: "a" });
    expect(topWindow(s3)?.id).toBe("a");
  });

  it("close removes, maximize toggles, move/resize clamp size", () => {
    let s = osWindowsReducer(EMPTY_OS_WINDOWS, { type: "open", window: win("a", "A") });
    s = osWindowsReducer(s, { type: "toggle-maximize", id: "a" });
    expect(s.windows[0].maximized).toBe(true);
    s = osWindowsReducer(s, { type: "toggle-maximize", id: "a" });
    expect(s.windows[0].maximized).toBe(false);
    s = osWindowsReducer(s, { type: "move", id: "a", x: 40, y: 30 });
    expect(s.windows[0].x).toBe(40);
    s = osWindowsReducer(s, { type: "resize", id: "a", w: 10, h: 10 });
    expect(s.windows[0].w).toBe(320);
    expect(s.windows[0].h).toBe(240);
    s = osWindowsReducer(s, { type: "close", id: "a" });
    expect(s.windows).toHaveLength(0);
  });

  it("toggle-pin flips the pinned flag, snap tiles and un-maximizes", () => {
    let s = osWindowsReducer(EMPTY_OS_WINDOWS, { type: "open", window: win("a", "A") });
    s = osWindowsReducer(s, { type: "toggle-pin", id: "a" });
    expect(s.windows[0].pinned).toBe(true);
    s = osWindowsReducer(s, { type: "toggle-pin", id: "a" });
    expect(s.windows[0].pinned).toBe(false);
    s = osWindowsReducer(s, { type: "toggle-maximize", id: "a" });
    s = osWindowsReducer(s, { type: "snap", id: "a", x: 0, y: 0, w: 640, h: 800 });
    expect(s.windows[0].maximized).toBe(false);
    expect(s.windows[0].w).toBe(640);
    expect(s.windows[0].h).toBe(800);
  });

  it("accent, opacity, tabgroup, and desktop actions update one window", () => {
    let s = osWindowsReducer(EMPTY_OS_WINDOWS, {
      type: "open",
      window: win("notes", "Notes"),
    });
    s = osWindowsReducer(s, { type: "accent", id: "notes", accent: "#c084fc" });
    expect(s.windows[0].accent).toBe("#c084fc");
    s = osWindowsReducer(s, { type: "opacity", id: "notes", opacity: 0.6 });
    expect(s.windows[0].opacity).toBe(0.6);
    s = osWindowsReducer(s, { type: "opacity", id: "notes", opacity: 5 });
    expect(s.windows[0].opacity).toBe(1);
    s = osWindowsReducer(s, { type: "tabgroup", id: "notes", tabGroupId: "tab-1" });
    expect(s.windows[0].tabGroupId).toBe("tab-1");
    s = osWindowsReducer(s, { type: "desktop", id: "notes", desktopId: "desk-2" });
    expect(s.windows[0].desktopId).toBe("desk-2");
  });

  it("open keeps hrefOverride and pinned on the window", () => {
    const s = osWindowsReducer(EMPTY_OS_WINDOWS, {
      type: "open",
      window: { ...win("app:dex", "DEX"), hrefOverride: "/ORBITX_DEX?mint=abc", pinned: true },
    });
    expect(s.windows[0].hrefOverride).toBe("/ORBITX_DEX?mint=abc");
    expect(s.windows[0].pinned).toBe(true);
  });
});
