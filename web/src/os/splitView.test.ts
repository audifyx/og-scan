import { describe, expect, it } from "vitest";
import {
  SPLIT_MAX,
  clampSplitSlot,
  splitRect,
  splitSlotForPoint,
} from "./splitView";

describe("splitRect", () => {
  it("2 apps on desktop are left/right halves that tile the viewport", () => {
    const a = splitRect(2, 0, 1920, 1080, false);
    const b = splitRect(2, 1, 1920, 1080, false);
    expect(a).toEqual({ x: 0, y: 0, w: 960, h: 1080 });
    expect(b).toEqual({ x: 960, y: 0, w: 960, h: 1080 });
    expect(a.w * a.h + b.w * b.h).toBe(1920 * 1080);
  });

  it("1 app fills the half it was dropped on", () => {
    expect(splitRect(1, 0, 1920, 1080, false)).toEqual({ x: 0, y: 0, w: 960, h: 1080 });
    expect(splitRect(1, 1, 1920, 1080, false)).toEqual({ x: 960, y: 0, w: 960, h: 1080 });
    expect(splitRect(1, 0, 390, 844, true)).toEqual({ x: 0, y: 0, w: 390, h: 422 });
    expect(splitRect(1, 1, 390, 844, true)).toEqual({ x: 0, y: 422, w: 390, h: 422 });
  });

  it("3 apps on desktop are one large + two stacked on the side", () => {
    const a = splitRect(3, 0, 1920, 1080, false);
    const b = splitRect(3, 1, 1920, 1080, false);
    const c = splitRect(3, 2, 1920, 1080, false);
    expect(a).toEqual({ x: 0, y: 0, w: 960, h: 1080 });
    expect(b).toEqual({ x: 960, y: 0, w: 960, h: 540 });
    expect(c).toEqual({ x: 960, y: 540, w: 960, h: 540 });
    expect(a.w * a.h + b.w * b.h + c.w * c.h).toBe(1920 * 1080);
  });

  it("4 apps are a 2x2 grid", () => {
    expect(splitRect(4, 0, 1920, 1080, false)).toEqual({ x: 0, y: 0, w: 960, h: 540 });
    expect(splitRect(4, 1, 1920, 1080, false)).toEqual({ x: 960, y: 0, w: 960, h: 540 });
    expect(splitRect(4, 2, 1920, 1080, false)).toEqual({ x: 0, y: 540, w: 960, h: 540 });
    expect(splitRect(4, 3, 1920, 1080, false)).toEqual({ x: 960, y: 540, w: 960, h: 540 });
  });

  it("2 apps on a phone stack top/bottom", () => {
    expect(splitRect(2, 0, 390, 844, true)).toEqual({ x: 0, y: 0, w: 390, h: 422 });
    expect(splitRect(2, 1, 390, 844, true)).toEqual({ x: 0, y: 422, w: 390, h: 422 });
  });

  it("3 apps on a phone stack in thirds", () => {
    const a = splitRect(3, 0, 390, 844, true);
    const b = splitRect(3, 1, 390, 844, true);
    const c = splitRect(3, 2, 390, 844, true);
    expect(a.y).toBe(0);
    expect(b.y).toBe(281);
    expect(c.y).toBe(562);
    expect(a.h + b.h + c.h).toBe(844);
    expect(a.w).toBe(390);
  });

  it("4 apps on a phone are a 2x2 grid of usable panes", () => {
    expect(splitRect(4, 0, 390, 844, true)).toEqual({ x: 0, y: 0, w: 195, h: 422 });
    expect(splitRect(4, 3, 390, 844, true)).toEqual({ x: 195, y: 422, w: 195, h: 422 });
  });
});

describe("splitSlotForPoint", () => {
  it("maps points to the rect they land in", () => {
    expect(splitSlotForPoint(100, 500, 2, 1920, 1080, false)).toBe(0);
    expect(splitSlotForPoint(1800, 500, 2, 1920, 1080, false)).toBe(1);
    expect(splitSlotForPoint(1500, 100, 3, 1920, 1080, false)).toBe(1);
    expect(splitSlotForPoint(1500, 900, 3, 1920, 1080, false)).toBe(2);
    expect(splitSlotForPoint(100, 100, 4, 1920, 1080, false)).toBe(0);
    expect(splitSlotForPoint(1800, 900, 4, 1920, 1080, false)).toBe(3);
  });

  it("picks the half by drop side when only one window is split", () => {
    expect(splitSlotForPoint(100, 500, 1, 1920, 1080, false)).toBe(0);
    expect(splitSlotForPoint(1800, 500, 1, 1920, 1080, false)).toBe(1);
    expect(splitSlotForPoint(200, 100, 1, 390, 844, true)).toBe(0);
    expect(splitSlotForPoint(200, 700, 1, 390, 844, true)).toBe(1);
  });
});

describe("split limits", () => {
  it("maxes at 4 apps", () => {
    expect(SPLIT_MAX).toBe(4);
  });

  it("clamps slots into range", () => {
    expect(clampSplitSlot(-1, 2)).toBe(0);
    expect(clampSplitSlot(5, 2)).toBe(1);
    expect(clampSplitSlot(2, 4)).toBe(2);
  });
});
