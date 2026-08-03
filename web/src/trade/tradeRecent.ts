const KEY = "orbitx.trade.recentWallets";
const MAX = 12;

const ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isSolAddr(v: string): boolean {
  return ADDR_RE.test(v.trim());
}

export function getRecentWallets(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((a) => typeof a === "string" && isSolAddr(a)) : [];
  } catch {
    return [];
  }
}

export function pushRecentWallet(address: string) {
  if (!isSolAddr(address)) return;
  const next = [address, ...getRecentWallets().filter((a) => a !== address)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearRecentWallets() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
