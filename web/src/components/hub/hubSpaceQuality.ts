/** Quality / capability flags for the /app 3D space background. */

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function canUseWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function isCompactSpaceViewport(width = typeof window === "undefined" ? 1280 : window.innerWidth): boolean {
  if (typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) return true;
  return width < 900;
}

export type SpaceQuality = {
  reduced: boolean;
  compact: boolean;
  starCount: number;
  dustCount: number;
  nebulaCount: number;
  dprMax: number;
};

export function resolveSpaceQuality(opts?: { width?: number; reduced?: boolean }): SpaceQuality {
  const reduced = opts?.reduced ?? prefersReducedMotion();
  const compact = isCompactSpaceViewport(opts?.width);
  return {
    reduced,
    compact,
    starCount: reduced ? 900 : compact ? 1800 : 4200,
    dustCount: reduced ? 80 : compact ? 220 : 560,
    nebulaCount: reduced ? 2 : compact ? 3 : 5,
    dprMax: compact ? 1.25 : 1.6,
  };
}
