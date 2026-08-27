export function detectLiteGpu(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  const narrow = window.innerWidth < 1024;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  return Boolean(coarse || narrow || reduce);
}
