/** GTA-style weapon wheel geometry for the OrbitX apps orb. 0° is up, clockwise. */

export const WHEEL_INNER_KEYS = ["hub", "dex", "city", "agents", "shop", "trade", "play", "intel"] as const;

export function wheelAngleDeg(dx: number, dy: number): number {
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function sliceIndex(angleDeg: number, count: number): number {
  if (count <= 0) return 0;
  const slice = 360 / count;
  return Math.floor(((angleDeg + slice / 2) % 360) / slice) % count;
}

export type WheelHit =
  | { ring: "hub"; index: -1 }
  | { ring: "inner"; index: number }
  | { ring: "outer"; index: number }
  | { ring: "none"; index: -1 };

/** Distances are normalized to the disc radius (0 at center, 1 at the rim). */
export function hitTestWheel(
  dx: number,
  dy: number,
  radius: number,
  innerCount: number,
  outerCount: number,
): WheelHit {
  if (radius <= 0) return { ring: "none", index: -1 };
  const d = Math.hypot(dx, dy) / radius;
  if (d < 0.3) return { ring: "hub", index: -1 };
  const angle = wheelAngleDeg(dx, dy);
  if (d < 0.66) {
    if (innerCount <= 0) return { ring: "hub", index: -1 };
    return { ring: "inner", index: sliceIndex(angle, innerCount) };
  }
  if (d < 1.02) {
    if (outerCount <= 0) return { ring: "inner", index: sliceIndex(angle, Math.max(innerCount, 1)) };
    return { ring: "outer", index: sliceIndex(angle, outerCount) };
  }
  return { ring: "none", index: -1 };
}

export function splitWheelApps<T extends { key: string }>(apps: T[]): { inner: T[]; outer: T[] } {
  const byKey = new Map(apps.map((a) => [a.key, a]));
  const inner = WHEEL_INNER_KEYS.map((key) => byKey.get(key)).filter((a): a is T => Boolean(a));
  const innerSet = new Set(inner.map((a) => a.key));
  const outer = apps.filter((a) => !innerSet.has(a.key));
  return { inner, outer };
}

export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

export function annularPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const sweep = ((a1 - a0) % 360 + 360) % 360;
  const large = sweep > 180 ? 1 : 0;
  const [x0, y0] = polar(cx, cy, r1, a0);
  const [x1, y1] = polar(cx, cy, r1, a1);
  const [x2, y2] = polar(cx, cy, r0, a1);
  const [x3, y3] = polar(cx, cy, r0, a0);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r1} ${r1} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)} A ${r0} ${r0} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`;
}

export function slicePath(count: number, index: number, cx: number, cy: number, r0: number, r1: number, gap = 1.6): string {
  const slice = 360 / Math.max(count, 1);
  const mid = index * slice;
  const a0 = mid - slice / 2 + gap;
  const a1 = mid + slice / 2 - gap;
  return annularPath(cx, cy, r0, r1, a0, a1);
}

export function sliceMidDeg(count: number, index: number): number {
  return (index * 360) / Math.max(count, 1);
}
