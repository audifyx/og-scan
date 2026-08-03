const BUY_KEY = "orbitx.trade.buyPresets";
const SELL_KEY = "orbitx.trade.sellPresets";

const DEFAULT_BUY = [0.1, 0.25, 0.5, 1];
const DEFAULT_SELL = [25, 50, 75, 100];

function readNums(key: string, fallback: number[], min: number, max: number): number[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [...fallback];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [...fallback];
    const nums = arr
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n >= min && n <= max)
      .slice(0, 6);
    return nums.length >= 2 ? nums : [...fallback];
  } catch {
    return [...fallback];
  }
}

export function getBuyPresets(): number[] {
  return readNums(BUY_KEY, DEFAULT_BUY, 0.001, 10_000);
}

export function getSellPresets(): number[] {
  return readNums(SELL_KEY, DEFAULT_SELL, 1, 100);
}

export function saveBuyPresets(presets: number[]) {
  const clean = presets
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 6);
  if (clean.length < 2) return;
  localStorage.setItem(BUY_KEY, JSON.stringify(clean));
}

export function saveSellPresets(presets: number[]) {
  const clean = presets
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 100)
    .slice(0, 6);
  if (clean.length < 2) return;
  localStorage.setItem(SELL_KEY, JSON.stringify(clean));
}
