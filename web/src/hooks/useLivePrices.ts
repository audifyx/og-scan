import { useState, useEffect, useRef, useCallback } from "react";

interface LivePrice {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  lastUpdated: number;
}

type LivePriceMap = Record<string, LivePrice>;

/**
 * Hook that polls DexScreener for live price updates on a set of token addresses.
 * Uses a fast polling interval to simulate real-time WebSocket behavior.
 */
export function useLivePrices(tokenAddresses: string[], intervalMs = 10000) {
  const [prices, setPrices] = useState<LivePriceMap>({});
  const [connected, setConnected] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const addressesRef = useRef<string[]>([]);

  // Keep ref in sync
  addressesRef.current = tokenAddresses;

  const fetchPrices = useCallback(async () => {
    const addrs = addressesRef.current;
    if (addrs.length === 0) return;

    // DexScreener supports up to 30 addresses per call
    const batchSize = 30;
    for (let i = 0; i < addrs.length; i += batchSize) {
      const batch = addrs.slice(i, i + batchSize);
      const joined = batch.join(",");
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${joined}`);
        if (!res.ok) continue;
        const data = await res.json();
        const pairs = data.pairs || [];

        const updates: LivePriceMap = {};
        for (const addr of batch) {
          // Find the best pair for this token (highest liquidity)
          const tokenPairs = pairs.filter(
            (p: any) => p.baseToken?.address?.toLowerCase() === addr.toLowerCase()
          );
          const best = tokenPairs.sort(
            (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
          )[0];

          if (best) {
            updates[addr] = {
              price: parseFloat(best.priceUsd || "0"),
              priceChange24h: best.priceChange?.h24 || 0,
              volume24h: best.volume?.h24 || 0,
              liquidity: best.liquidity?.usd || 0,
              marketCap: best.marketCap || best.fdv || 0,
              lastUpdated: Date.now(),
            };
          }
        }

        setPrices((prev) => ({ ...prev, ...updates }));
        setConnected(true);
      } catch (e) {
        console.error("Live price fetch error:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (tokenAddresses.length === 0) return;

    // Initial fetch
    fetchPrices();

    // Set up polling
    intervalRef.current = setInterval(fetchPrices, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tokenAddresses.join(","), intervalMs, fetchPrices]);

  return { prices, connected };
}
