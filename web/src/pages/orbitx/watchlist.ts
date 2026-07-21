// OrbitX Launchpad — client-side watchlist. Wallet-native app, but the watchlist
// is a lightweight per-device list kept in localStorage (no backend needed).
import { useCallback, useEffect, useState } from "react";

const KEY = "orbitx_watchlist";
const EVT = "orbitx-watchlist-change";

function read(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(list: string[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
}
export function isWatched(mint: string): boolean { return read().includes(mint); }
export function toggleWatch(mint: string): string[] {
  const list = read();
  const next = list.includes(mint) ? list.filter((m) => m !== mint) : [...list, mint];
  write(next);
  return next;
}
export function useWatchlist() {
  const [list, setList] = useState<string[]>(read);
  useEffect(() => {
    const on = () => setList(read());
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener(EVT, on); window.removeEventListener("storage", on); };
  }, []);
  const toggle = useCallback((mint: string) => setList(toggleWatch(mint)), []);
  return { list, toggle };
}
