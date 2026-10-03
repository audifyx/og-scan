/** OrbitX City (rebuild) — tiny persistent state: trader style + CITY points. */

export type StyleId = "degen" | "sniper" | "fox" | "visor" | "bomber" | "suit";

export const STYLES: { id: StyleId; label: string }[] = [
  { id: "degen", label: "DEGEN" },
  { id: "sniper", label: "SNIPER" },
  { id: "fox", label: "FOX" },
  { id: "visor", label: "VISOR" },
  { id: "bomber", label: "BOMBER" },
  { id: "suit", label: "SUIT" },
];

const STYLE_KEY = "oxc-style";
const POINTS_KEY = "oxc-city-points";

export function getStyle(): StyleId {
  try {
    const v = localStorage.getItem(STYLE_KEY);
    if (v === "degen" || v === "sniper" || v === "fox" || v === "visor" || v === "bomber" || v === "suit") return v;
  } catch { /* noop */ }
  return "degen";
}

export function setStyle(id: StyleId): void {
  try { localStorage.setItem(STYLE_KEY, id); } catch { /* noop */ }
}

export function getCityPoints(): number {
  try {
    const v = Number(localStorage.getItem(POINTS_KEY));
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  } catch { return 0; }
}

/** Add points, persist, return the new total. */
export function addCityPoints(n: number): number {
  const total = getCityPoints() + Math.max(0, Math.floor(n));
  try { localStorage.setItem(POINTS_KEY, String(total)); } catch { /* noop */ }
  return total;
}

/** Spend points (never below 0), persist, return the new total. */
export function spendCityPoints(n: number): number {
  const total = Math.max(0, getCityPoints() - Math.max(0, Math.floor(n)));
  try { localStorage.setItem(POINTS_KEY, String(total)); } catch { /* noop */ }
  return total;
}
