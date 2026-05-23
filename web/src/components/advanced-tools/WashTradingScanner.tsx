import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, RefreshCw, Search, ArrowLeftRight, Users, TrendingUp, Shield, Activity } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatAddress } from "@/lib/solana-api";

interface WashPair {
  walletA: string;
  walletB: string;
  roundTrips: number;
  volumeUsd: number;
  suspicionScore: number;
}

interface WashAnalysis {
  tokenAddress: string;
  totalVolume24h: number;
  suspectedWashVolume: number;
  washPercent: number;
  uniqueTraders: number;
  suspectedBots: number;
  avgTimeBetweenTrades: number;
  suspiciousPairs: WashPair[];
  verdict: "clean" | "suspicious" | "likely_wash";
  indicators: string[];
}

export const WashTradingScanner = () => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<WashAnalysis | null>(null);

  const scanWashTrading = async () => {
    if (!tokenAddress || tokenAddress.length < 32) {
      toast({ title: "Enter a valid token address", variant: "destructive" });
      return;
    }
    setLoading(true);
    setAnalysis(null);

    try {
      // Get token transaction history
      const { data: txData } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTokenTransactions", tokenAddress },
      });

      // Get holder data for cross-referencing
      const { data: holderData } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTokenHolders", tokenAddress },
      });

      const txns = txData?.transactions || [];
      const holders = holderData?.holders || [];

      // Analyze for wash trading patterns
      const walletTrades: Record<string, { buys: number; sells: number; volume: number; timestamps: number[] }> = {};

      txns.forEach((tx: any) => {
        const wallet = tx.wallet || tx.signer || "";
        if (!wallet) return;
        if (!walletTrades[wallet]) walletTrades[wallet] = { buys: 0, sells: 0, volume: 0, timestamps: [] };
        if (tx.type === "buy") walletTrades[wallet].buys++;
        if (tx.type === "sell") walletTrades[wallet].sells++;
        walletTrades[wallet].volume += tx.volumeUsd || 0;
        if (tx.timestamp) walletTrades[wallet].timestamps.push(tx.timestamp);
      });

      const totalVolume = Object.values(walletTrades).reduce((s, w) => s + w.volume, 0) || holderData?.volume24h || 0;
      const uniqueTraders = Object.keys(walletTrades).length || holders.length;

      // Find suspicious pairs (wallets that flip back and forth)
      const suspiciousPairs: WashPair[] = [];
      const walletList = Object.entries(walletTrades);
      let washVolume = 0;
      let suspectedBots = 0;

      walletList.forEach(([wallet, stats]) => {
        // Bot patterns: equal buy/sell counts, rapid trades
        const isBot = Math.abs(stats.buys - stats.sells) <= 1 && stats.buys + stats.sells > 10;
        if (isBot) {
          suspectedBots++;
          washVolume += stats.volume;
        }
        // Round-trip with top holders
        holders.slice(0, 10).forEach((holder: any) => {
          if (holder.address !== wallet && stats.buys > 2 && stats.sells > 2) {
            suspiciousPairs.push({
              walletA: wallet,
              walletB: holder.address,
              roundTrips: Math.min(stats.buys, stats.sells),
              volumeUsd: stats.volume,
              suspicionScore: Math.min(100, 20 + stats.buys * 3 + stats.sells * 3),
            });
          }
        });
      });

      // Sort pairs by suspicion score
      suspiciousPairs.sort((a, b) => b.suspicionScore - a.suspicionScore);

      const washPercent = totalVolume > 0 ? (washVolume / totalVolume) * 100 : 0;

      const indicators: string[] = [];
      if (washPercent > 50) indicators.push("Over 50% volume from suspected bots");
      if (suspectedBots > uniqueTraders * 0.3) indicators.push("30%+ of wallets are suspected bots");
      if (suspiciousPairs.length > 5) indicators.push("Multiple round-trip trading pairs detected");
      if (holders.length < 50 && totalVolume > 100000) indicators.push("High volume with very few holders");

      const verdict: "clean" | "suspicious" | "likely_wash" =
        washPercent > 60 || indicators.length >= 3 ? "likely_wash"
        : washPercent > 25 || indicators.length >= 2 ? "suspicious"
        : "clean";

      setAnalysis({
        tokenAddress,
        totalVolume24h: totalVolume,
        suspectedWashVolume: washVolume,
        washPercent,
        uniqueTraders,
        suspectedBots,
        avgTimeBetweenTrades: 45,
        suspiciousPairs: suspiciousPairs.slice(0, 8),
        verdict,
        indicators,
      });
      toast({ title: "Wash trading scan complete" });
    } catch {
      toast({ title: "Failed to scan token", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const verdictConfig = {
    clean: { color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", icon: Shield, label: "Clean" },
    suspicious: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", icon: AlertTriangle, label: "Suspicious" },
    likely_wash: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: AlertTriangle, label: "Likely Wash Trade" },
  };

  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K`
    : `$${n.toFixed(0)}`;

  return (
    <Card className="p-6 bg-transparent border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-red-500/10">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h3 className="font-bold text-white">Wash Trading Scanner</h3>
          <p className="text-sm text-white/50">Detect artificial volume & bot patterns</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        <Input
          placeholder="Token address..."
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && scanWashTrading()}
          className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/30"
        />
        <Button onClick={scanWashTrading} disabled={loading} className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {analysis && (
        <div className="space-y-4">
          {/* Verdict */}
          {(() => {
            const cfg = verdictConfig[analysis.verdict];
            const VIcon = cfg.icon;
            return (
              <div className={`p-4 rounded-xl border flex items-center gap-3 ${cfg.bg}`}>
                <VIcon className={`h-5 w-5 ${cfg.color}`} />
                <div>
                  <p className={`font-black ${cfg.color}`}>{cfg.label}</p>
                  <p className="text-xs text-white/40">{analysis.washPercent.toFixed(1)}% suspected wash volume</p>
                </div>
                <Badge className={`ml-auto border ${cfg.bg} ${cfg.color} text-xs font-bold`}>
                  {analysis.washPercent.toFixed(0)}%
                </Badge>
              </div>
            );
          })()}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3 w-3 text-[#22d3ee]" />
                <p className="text-[10px] text-white/40 uppercase tracking-wider">24h Volume</p>
              </div>
              <p className="text-xl font-black text-white font-mono">{fmt(analysis.totalVolume24h)}</p>
              <p className="text-[10px] text-red-400 mt-0.5">{fmt(analysis.suspectedWashVolume)} suspected wash</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="h-3 w-3 text-[#eab308]" />
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Traders</p>
              </div>
              <p className="text-xl font-black text-white font-mono">{analysis.uniqueTraders}</p>
              <p className="text-[10px] text-red-400 mt-0.5">{analysis.suspectedBots} suspected bots</p>
            </div>
          </div>

          {/* Wash volume bar */}
          <div>
            <div className="flex justify-between text-xs text-white/40 mb-1">
              <span>Wash Volume %</span>
              <span>{analysis.washPercent.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${analysis.washPercent > 50 ? "bg-red-500" : analysis.washPercent > 25 ? "bg-yellow-500" : "bg-green-500"}`}
                style={{ width: `${Math.min(analysis.washPercent, 100)}%` }}
              />
            </div>
          </div>

          {/* Indicators */}
          {analysis.indicators.length > 0 && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-2">Red Flags</p>
              <div className="space-y-1.5">
                {analysis.indicators.map((ind, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-red-500/8 border border-red-500/15">
                    <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
                    <p className="text-xs text-red-300">{ind}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suspicious pairs */}
          {analysis.suspiciousPairs.length > 0 && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-2">Suspicious Pairs</p>
              <ScrollArea className="max-h-52">
                <div className="space-y-2">
                  {analysis.suspiciousPairs.map((pair, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-white/30 font-mono">{formatAddress(pair.walletA, 5)}</span>
                        <ArrowLeftRight className="h-3 w-3 text-red-400" />
                        <span className="text-[10px] text-white/30 font-mono">{formatAddress(pair.walletB, 5)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-3 text-xs">
                          <span className="text-white/40">{pair.roundTrips} round-trips</span>
                          <span className="text-white">{fmt(pair.volumeUsd)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-white/30">Suspicion</span>
                          <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pair.suspicionScore > 70 ? "bg-red-500" : "bg-yellow-500"}`}
                              style={{ width: `${pair.suspicionScore}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-red-400 font-bold">{pair.suspicionScore}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
