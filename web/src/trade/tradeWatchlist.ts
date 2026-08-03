const KEY = "orbitx.trade.watchWallets";
const ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type WatchedWallet = { address: string; label?: string; addedAt: number };

export function isSolAddr(v: string): boolean {
  return ADDR_RE.test(v.trim());
}

export function getWatchlist(): WatchedWallet[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => x && typeof x.address === "string" && isSolAddr(x.address));
  } catch {
    return [];
  }
}

export function addWatchWallet(address: string, label?: string) {
  const a = address.trim();
  if (!isSolAddr(a)) return;
  const next = [
    { address: a, label: label?.trim() || undefined, addedAt: Date.now() },
    ...getWatchlist().filter((w) => w.address !== a),
  ].slice(0, 40);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function removeWatchWallet(address: string) {
  localStorage.setItem(KEY, JSON.stringify(getWatchlist().filter((w) => w.address !== address)));
}

export function renameWatchWallet(address: string, label: string) {
  const next = getWatchlist().map((w) =>
    w.address === address ? { ...w, label: label.trim() || undefined } : w,
  );
  localStorage.setItem(KEY, JSON.stringify(next));
}
