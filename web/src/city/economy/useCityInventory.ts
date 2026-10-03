/**
 * OrbitX City — owned-items inventory.
 *
 * Persisted in localStorage, namespaced per wallet address (the game already
 * uses localStorage for settings; this matches the existing pattern).
 */
import { useCallback, useEffect, useState } from "react";

const KEY = "orbitxcity:inventory:v1";

function loadAll(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(KEY);
    const d = raw ? JSON.parse(raw) : {};
    return d && typeof d === "object" ? d : {};
  } catch {
    return {};
  }
}

export function useCityInventory(address: string | null) {
  const [owned, setOwned] = useState<string[]>(() =>
    address ? loadAll()[address] ?? [] : [],
  );

  useEffect(() => {
    setOwned(address ? loadAll()[address] ?? [] : []);
  }, [address]);

  const add = useCallback(
    (id: string) => {
      if (!address) return;
      setOwned((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        try {
          const all = loadAll();
          all[address] = next;
          localStorage.setItem(KEY, JSON.stringify(all));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [address],
  );

  const has = useCallback((id: string) => owned.includes(id), [owned]);

  return { owned, has, add };
}
