import { useEffect, useState } from "react";
import { getChart } from "../lib/api";
import { Loader2, CandlestickChart, ExternalLink } from "lucide-react";

// DexScreener embedded chart (richer than a custom renderer): resolves the token's
// top pool, then embeds the DexScreener pro chart for it.
export default function PriceChart({ mint, chain = "solana", symbol }: { mint: string; chain?: string; symbol?: string }) {
  const [pool, setPool] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true; setLoading(true); setPool(null);
    getChart(mint, "1h", 1, chain).then((d) => { if (on) { setPool(d.pool || null); setLoading(false); } }).catch(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [mint, chain]);

  const ref = pool || mint;
  const src = `https://dexscreener.com/${chain}/${ref}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=1&chartType=usd&interval=15`;

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-sm font-semibold flex items-center gap-2"><CandlestickChart className="w-4 h-4 text-accent" /> {symbol || "Price"} Chart</div>
        <a href={`https://dexscreener.com/${chain}/${ref}`} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-accent inline-flex items-center gap-1">DexScreener <ExternalLink className="w-3 h-3" /></a>
      </div>
      <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ height: 460 }}>
        {loading && <div className="absolute inset-0 grid place-items-center text-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>}
        {!loading && (
          <iframe title="DexScreener chart" src={src} className="absolute inset-0 w-full h-full border-0" style={{ colorScheme: "dark" }} allow="clipboard-write" loading="lazy" />
        )}
      </div>
    </div>
  );
}
