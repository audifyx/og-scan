/**
 * Bubblemaps holder cluster map embed for /trade token pages.
 * Docs: https://docs.bubblemaps.io/iframe/quickstart
 */

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

const PARTNER =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_BUBBLEMAPS_PARTNER_ID) ||
  "demo";

const CHAIN_ALIAS: Record<string, string> = {
  solana: "solana",
  sol: "solana",
  eth: "eth",
  ethereum: "eth",
  bsc: "bsc",
  bnb: "bsc",
  base: "base",
  arbitrum: "arbitrum",
  polygon: "polygon",
  avalanche: "avalanche",
  tron: "tron",
};

export function bubblemapsUrl(address: string, chain = "solana"): string {
  const c = CHAIN_ALIAS[String(chain || "solana").toLowerCase()] || "solana";
  const params = new URLSearchParams({
    chain: c,
    address,
    partnerId: PARTNER,
  });
  return `https://iframe.bubblemaps.io/map?${params.toString()}`;
}

export function BubbleMap({
  address,
  chain = "solana",
  height = 420,
}: {
  address: string;
  chain?: string;
  height?: number;
}) {
  const [ready, setReady] = useState(false);
  const [mount, setMount] = useState(false);
  const src = useMemo(() => bubblemapsUrl(address, chain), [address, chain]);

  useEffect(() => {
    setReady(false);
    setMount(true);
  }, [src]);

  if (!address) {
    return <p className="py-8 text-center text-xs text-white/35">No token address for map</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[10px] uppercase tracking-wider text-white/35">
          Bubblemaps · {CHAIN_ALIAS[String(chain).toLowerCase()] || chain}
        </p>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-white/45 hover:text-white"
        >
          Open <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div
        className="relative overflow-hidden rounded-xl border border-white/10 bg-black"
        style={{ height }}
      >
        {(!mount || !ready) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
            <p className="text-[11px] text-white/30">Loading bubble map…</p>
          </div>
        )}
        {mount && (
          <iframe
            title="Bubblemaps"
            src={src}
            className="h-full w-full border-0"
            allow="clipboard-write"
            onLoad={() => setReady(true)}
          />
        )}
      </div>
      <p className="text-[10px] leading-relaxed text-white/30">
        Holder clusters and linked wallets via Bubblemaps. Production domains need a partner id (
        <code className="text-white/40">VITE_BUBBLEMAPS_PARTNER_ID</code>).
      </p>
    </div>
  );
}
