// OrbitX NFT Marketplace — lightweight per-browser watchlist for collections.
import { useCallback, useEffect, useState } from "react";

const KEY = "orbitx_nft_watchlist";

function read(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); }
}

export function useNftWatchlist() {
  const [ids, setIds] = useState<Set<string>>(() => read());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setIds(read()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { ids, toggle };
}
