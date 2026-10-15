import { useState, useEffect, useCallback } from "react";
import { Crosshair, RefreshCw, ExternalLink, ShieldCheck, ShieldAlert, ShieldX, Clock, Droplets, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface SnipeToken {
  mint: string;
  name: string;
  symbol: string;
  icon?: string;
  priceUsd: number;
  mcap: number;
  liquidity: number;
  volume24h: number;
  change24h: number;
  pairCreatedAt?: number;
  url?: string;
  // Safety scan results
  safety?: {
    verdict: string;
    tone: "good" | "warn" | "bad";
    canBuy: boolean;
    canSell: boolean;
    mintRenounced: boolean;
    freezeRenounced: boolean;
    topHoldersPct?: number;
  } | null;
  safetyLoading?: boolean;
}

const MIN_LIQUIDITY = 1000; // $1k min to filter dust
const MIN_MCAP = 5000; // $5k min

async function fetchScreener(): Promise<any[]> {
  const res = await fetch(`/api/ogdex/screener?type=newpairs&limit=30&chain=solana`);
  if (!res.ok) throw new Error("Screener failed");
  const json = await res.json();
  return json.data || json.tokens || [];
}

async function fetchSafety(mint: string): Promise<SnipeToken["safety"]> {
  try {
    const res = await fetch(`/api/ogdex/safety?mint=${mint}`);
    if (!res.ok) return null;
    const j = await res.json();
    const s = j.safety || j;
    return {
      verdict: s.verdict || s.note || "Unknown",
      tone: s.tone || (s.canSell === false ? "bad" : "warn"),
      canBuy: s.canBuy !== false,
      canSell: s.canSell !== false,
      mintRenounced: s.mintRenounced ?? s.mintAuthorityRenounced ?? false,
      freezeRenounced: s.freezeRenounced ?? s.freezeAuthorityRenounced ?? false,
      topHoldersPct: s.topHoldersPct ?? s.top10Pct,
    };
  } catch {
    return null;
  }
}

function SafetyBadge({ safety }: { safety: NonNullable<SnipeToken["safety"]> }) {
  if (safety.tone === "good") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
        <ShieldCheck className="h-3 w-3 mr-1" /> {safety.verdict || "Safe"}
      </Badge>
    );
  }
  if (safety.tone === "bad") {
    return (
      <Badge className="bg-red-500/15 text-red-300 border-red-500/30 text-[10px]">
        <ShieldX className="h-3 w-3 mr-1" /> {safety.verdict || "Risky"}
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px]">
      <ShieldAlert className="h-3 w-3 mr-1" /> {safety.verdict || "Caution"}
    </Badge>
  );
}

export const TokenSniper = () => {
  const [tokens, setTokens] = useState<SnipeToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setScanning(false);
    try {
      const raw = await fetchScreener();
      // Filter garbage: need mint, min liquidity, min mcap
      const filtered = raw
        .filter((t: any) => {
          const mint = t.mint || t.baseToken?.address;
          const liq = Number(t.liquidity || t.liquidityUsd || 0);
          const mc = Number(t.mcap || t.marketCap || t.fdv || 0);
          return mint && liq >= MIN_LIQUIDITY && mc >= MIN_MCAP;
        })
        .slice(0, 20)
        .map((t: any) => ({
          mint: t.mint || t.baseToken.address,
          name: t.name || t.baseToken?.name || "Unknown",
          symbol: t.symbol || t.baseToken?.symbol || "???",
          icon: t.icon || t.info?.imageUrl,
          priceUsd: Number(t.priceUsd || 0),
          mcap: Number(t.mcap || t.marketCap || t.fdv || 0),
          liquidity: Number(t.liquidity || t.liquidityUsd || 0),
          volume24h: Number(t.volume || t.volume24h || t.volume?.h24 || 0),
          change24h: Number(t.change24h || t.priceChange?.h24 || 0),
          pairCreatedAt: t.pairCreatedAt,
          url: t.url || `https://dexscreener.com/solana/${t.mint || t.baseToken?.address}`,
          safety: null,
          safetyLoading: true,
        }));

      setTokens(filtered);
      setLoading(false);

      // Run safety scans in background
      if (filtered.length > 0) {
        setScanning(true);
        const withSafety = await Promise.all(
          filtered.map(async (tok) => {
            const safety = await fetchSafety(tok.mint);
            return { ...tok, safety, safetyLoading: false };
          })
        );
        // Sort: safe first, then by liquidity
        withSafety.sort((a, b) => {
          const toneRank = (t: SnipeToken["safety"]) =>
            !t ? 2 : t.tone === "good" ? 0 : t.tone === "warn" ? 1 : 3;
          const ra = toneRank(a.safety);
          const rb = toneRank(b.safety);
          if (ra !== rb) return ra - rb;
          return b.liquidity - a.liquidity;
        });
        setTokens(withSafety);
        setScanning(false);
      }
    } catch (e) {
      console.error("TokenSniper load error:", e);
      toast.error("Failed to load new launches");
      setLoading(false);
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fmt = (n: number) => {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  return (
    <Card className="og-glass-card h-full border-white/20 bg-black/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white">
            <Crosshair className="h-5 w-5 text-white" />
            Token Sniper
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="border-white/20 text-white hover:bg-white/10"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="text-sm text-white/70">
          Latest Solana launches, safety-scanned
          {scanning && <span className="ml-2 text-white/50">· scanning…</span>}
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[420px] pr-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-white/60" />
              <p className="text-sm text-white/60">Loading new launches…</p>
            </div>
          ) : tokens.length > 0 ? (
            <div className="space-y-3">
              {tokens.map((tok) => (
                <div
                  key={tok.mint}
                  className="p-3 rounded-xl bg-white/[0.06] border border-white/15 hover:border-white/30 hover:bg-white/[0.09] transition-colors cursor-pointer"
                  onClick={() => window.open(tok.url, "_blank")}
                >
                  <div className="flex items-start gap-3">
                    {tok.icon ? (
                      <img
                        src={tok.icon}
                        alt={tok.symbol}
                        className="h-10 w-10 rounded-full object-cover bg-white/10"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-sm font-bold">
                        {tok.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white truncate">{tok.symbol}</span>
                        {tok.change24h !== 0 && (
                          <Badge
                            variant={tok.change24h >= 0 ? "default" : "destructive"}
                            className="text-[10px]"
                          >
                            {tok.change24h >= 0 ? "+" : ""}{tok.change24h.toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-white/60 truncate mt-0.5">{tok.name}</p>
                      {/* Safety badge */}
                      <div className="mt-1.5">
                        {tok.safetyLoading ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-white/50">
                            <RefreshCw className="h-3 w-3 animate-spin" /> Scanning…
                          </span>
                        ) : tok.safety ? (
                          <SafetyBadge safety={tok.safety} />
                        ) : (
                          <span className="text-[10px] text-white/40">Scan unavailable</span>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-white/40 shrink-0" />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div className="rounded-lg bg-black/40 border border-white/10 p-2">
                      <div className="text-white/50 text-[10px] uppercase">Price</div>
                      <div className="font-bold text-white mt-0.5">
                        ${tok.priceUsd > 0 ? tok.priceUsd.toFixed(6) : "—"}
                      </div>
                    </div>
                    <div className="rounded-lg bg-black/40 border border-white/10 p-2">
                      <div className="text-white/50 text-[10px] uppercase flex items-center gap-1">
                        <Droplets className="h-3 w-3" /> Liq
                      </div>
                      <div className="font-bold text-white mt-0.5">{fmt(tok.liquidity)}</div>
                    </div>
                    <div className="rounded-lg bg-black/40 border border-white/10 p-2">
                      <div className="text-white/50 text-[10px] uppercase flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> MCap
                      </div>
                      <div className="font-bold text-white mt-0.5">{fmt(tok.mcap)}</div>
                    </div>
                  </div>

                  {/* Safety details */}
                  {tok.safety && (
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-white/60">
                      <span className={tok.safety.mintRenounced ? "text-emerald-300" : "text-red-300"}>
                        {tok.safety.mintRenounced ? "✓" : "✗"} Mint
                      </span>
                      <span className={tok.safety.freezeRenounced ? "text-emerald-300" : "text-red-300"}>
                        {tok.safety.freezeRenounced ? "✓" : "✗"} Freeze
                      </span>
                      {!tok.safety.canSell && (
                        <span className="text-red-300 font-bold">⚠ Cannot sell</span>
                      )}
                      {tok.pairCreatedAt && (
                        <span className="ml-auto flex items-center gap-1 text-white/50">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(tok.pairCreatedAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Crosshair className="h-8 w-8 mx-auto text-white/30 mb-3" />
              <p className="text-white/60 text-sm">No launches passing filters right now</p>
              <p className="text-white/40 text-xs mt-1">Try refreshing in a bit</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
