/**
 * OrbitX OS — split view layout math. Pure functions, no React, no DOM,
 * so zone geometry is unit-testable.
 *
 * A split layout is an ordered set of windows, each holding a slot
 * (0..3). The rect for a slot depends on how many windows are split:
 *  - 1: the single window fills the half it was dropped on
 *       (slot 0 = left/top, slot 1 = right/bottom)
 *  - 2: halves — left/right on desktop, top/bottom on phone
 *  - 3: one large + two stacked on the side (desktop) / stacked thirds (phone)
 *  - 4: 2x2 grid
 * A 5th window never joins split view — it opens as a normal floating
 * window on top.
 */

export const SPLIT_MAX = 4;

export interface SplitRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rect for `slot` in a layout of `count` split windows. */
export function splitRect(
  count: number,
  slot: number,
  vw: number,
  vh: number,
  isPhone: boolean,
): SplitRect {
  const halfW = Math.floor(vw / 2);
  const halfH = Math.floor(vh / 2);
  if (count <= 2) {
    // One or two windows: halves. Slot 0 = left/top, slot 1 = right/bottom.
    if (isPhone) {
      return slot >= 1
        ? { x: 0, y: halfH, w: vw, h: vh - halfH }
        : { x: 0, y: 0, w: vw, h: halfH };
    }
    return slot >= 1
      ? { x: halfW, y: 0, w: vw - halfW, h: vh }
      : { x: 0, y: 0, w: halfW, h: vh };
  }
  if (count === 3) {
    if (isPhone) {
      const third = Math.floor(vh / 3);
      if (slot === 0) return { x: 0, y: 0, w: vw, h: third };
      if (slot === 1) return { x: 0, y: third, w: vw, h: third };
      return { x: 0, y: third * 2, w: vw, h: vh - third * 2 };
    }
    if (slot === 0) return { x: 0, y: 0, w: halfW, h: vh };
    if (slot === 1) return { x: halfW, y: 0, w: vw - halfW, h: halfH };
    return { x: halfW, y: halfH, w: vw - halfW, h: vh - halfH };
  }
  // 4: 2x2 grid. Slot 0 = top-left, 1 = top-right, 2 = bottom-left, 3 = bottom-right.
  const col = slot % 2;
  const row = Math.floor(slot / 2);
  return {
    x: col === 0 ? 0 : halfW,
    y: row === 0 ? 0 : halfH,
    w: col === 0 ? halfW : vw - halfW,
    h: row === 0 ? halfH : vh - halfH,
  };
}

/**
 * Which slot a point (relative to the desktop root) maps to in a layout
 * of `count` split windows. Rects tile the whole area for count >= 2, so
 * a point always lands in one; for count 1 the drop side picks the half.
 */
export function splitSlotForPoint(
  px: number,
  py: number,
  count: number,
  vw: number,
  vh: number,
  isPhone: boolean,
): number {
  if (count <= 1) {
    return isPhone ? (py >= vh / 2 ? 1 : 0) : (px >= vw / 2 ? 1 : 0);
  }
  for (let slot = 0; slot < count; slot++) {
    const r = splitRect(count, slot, vw, vh, isPhone);
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return slot;
  }
  // Defensive fallback: nearest rect center.
  let best = 0;
  let bestD = Infinity;
  for (let slot = 0; slot < count; slot++) {
    const r = splitRect(count, slot, vw, vh, isPhone);
    const dx = px - (r.x + r.w / 2);
    const dy = py - (r.y + r.h / 2);
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = slot;
    }
  }
  return best;
}

/** Clamp a slot into range for a layout of `count` windows. */
export function clampSplitSlot(slot: number, count: number): number {
  return Math.max(0, Math.min(Math.max(0, count - 1), slot));
}
