import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crosshair, RefreshCw, ExternalLink, Copy, Check, Droplets, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const LiquiditySniper = () => {
  const [loading, setLoading] = useState(false);
  const [pairs, setPairs] = useState<any[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchNewPairs = async () => {
    setLoading(true);
    try {
      const res = await fetch("https://api.dexscreener.com/token-profiles/latest/v1");
      const profiles = await res.json();
      const solanaProfiles = profiles.filter((p: any) => p.chainId === "solana").slice(0, 15);
      const pairResults: any[] = [];
      for (const profile of solanaProfiles) {
        try {
          const pairRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${profile.tokenAddress}`);
          const pairData = await pairRes.json();
          const pair = pairData.pairs?.[0];
          if (pair && (pair.liquidity?.usd || 0) > 100) {
            pairResults.push({
              address: profile.tokenAddress,
              name: pair.baseToken?.name || "Unknown",
              symbol: pair.baseToken?.symbol || "???",
              price: pair.priceUsd || "0",
              liquidity: pair.liquidity?.usd || 0,
              volume24h: pair.volume?.h24 || 0,
              priceChange: pair.priceChange?.h24 || 0,
              dexUrl: pair.url || `https://dexscreener.com/solana/${profile.tokenAddress}`,
              imageUrl: profile.icon,
            });
          }
        } catch { /* skip */ }
      }
      pairResults.sort((a, b) => b.liquidity - a.liquidity);
      setPairs(pairResults.slice(0, 10));
      toast({ title: `Found ${pairResults.length} pairs with liquidity` });
    } catch {
      toast({ title: "Error fetching pairs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Address copied" });
  };

  const fmt = (n: number) =>
    n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`;

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
          <Droplets className="h-5 w-5 text-green-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">Liquidity Sniper</h3>
          <p className="text-xs text-white/40">Find tokens with new liquidity pools on Solana</p>
        </div>
      </div>

      <Button onClick={fetchNewPairs} disabled={loading} className="w-full btn-3d rounded-xl gap-2">
        {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
        {loading ? "Scanning..." : "Scan Liquidity Pools"}
      </Button>

      {pairs.length > 0 && (
        <div className="space-y-2">
          {pairs.map((pair, i) => (
            <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-green-500/20 transition-colors">
              <div className="flex items-center gap-3">
                {pair.imageUrl ? (
                  <img src={pair.imageUrl} alt={pair.symbol} className="h-9 w-9 rounded-xl object-cover shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />
                ) : (
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {pair.symbol.slice(0, 2)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white truncate">{pair.name}</span>
                    <Badge className="bg-white/[0.05] text-white/40 border-white/[0.08] text-[9px]">{pair.symbol}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-white/30">${pair.price}</span>
                    <span className="text-[10px] text-white/30">LQ: {fmt(pair.liquidity)}</span>
                    <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${pair.priceChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {pair.priceChange >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {pair.priceChange >= 0 ? "+" : ""}{pair.priceChange.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-white/20 hover:text-white/60" onClick={() => copyAddress(pair.address)}>
                    {copied === pair.address ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-white/20 hover:text-white/60" asChild>
                    <a href={pair.dexUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && pairs.length === 0 && (
        <div className="text-center py-8">
          <Droplets className="h-10 w-10 mx-auto mb-2 text-white/10" />
          <p className="text-sm text-white/30">Click scan to find new liquidity pools</p>
          <p className="text-xs text-white/20 mt-1">Powered by DexScreener</p>
        </div>
      )}
    </div>
  );
};
