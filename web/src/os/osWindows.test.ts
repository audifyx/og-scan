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
});
