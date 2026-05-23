import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { GitMerge, Plus, Trash2, RefreshCw, DollarSign, TrendingUp, Wallet, BarChart3, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatAddress } from "@/lib/solana-api";

interface WalletStats {
  address: string;
  solBalance: number;
  solValue: number;
  tokenCount: number;
  tradeCount: number;
  estimatedPnL: number;
  winRate: string;
  error?: string;
}

interface MergedView {
  wallets: WalletStats[];
  totalSolValue: number;
  totalPnL: number;
  totalTrades: number;
  avgWinRate: number;
  combinedTokenCount: number;
}

export const MultiWalletMerge = () => {
  const [addresses, setAddresses] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);
  const [merged, setMerged] = useState<MergedView | null>(null);

  const addWallet = () => {
    if (addresses.length >= 8) {
      toast({ title: "Maximum 8 wallets at once", variant: "destructive" });
      return;
    }
    setAddresses([...addresses, ""]);
  };

  const removeWallet = (idx: number) => {
    if (addresses.length <= 2) return;
    const next = [...addresses];
    next.splice(idx, 1);
    setAddresses(next);
  };

  const updateAddress = (idx: number, val: string) => {
    const next = [...addresses];
    next[idx] = val;
    setAddresses(next);
  };

  const analyzeAll = async () => {
    const valid = addresses.filter((a) => a.trim().length >= 32);
    if (valid.length < 2) {
      toast({ title: "Enter at least 2 valid wallet addresses", variant: "destructive" });
      return;
    }
    setLoading(true);
    setMerged(null);

    try {
      const results = await Promise.all(
        valid.map(async (addr): Promise<WalletStats> => {
          try {
            const { data } = await supabase.functions.invoke("solana-tracker", {
              body: { action: "getWalletPnL", walletAddress: addr },
            });
            return {
              address: addr,
              solBalance: data?.solBalance || 0,
              solValue: (data?.solBalance || 0) * 165,
              tokenCount: data?.tokenCount || 0,
              tradeCount: data?.tradeCount || 0,
              estimatedPnL: data?.estimatedPnL || 0,
              winRate: data?.winRate || "0",
            };
          } catch {
            return { address: addr, solBalance: 0, solValue: 0, tokenCount: 0, tradeCount: 0, estimatedPnL: 0, winRate: "0", error: "Failed" };
          }
        })
      );

      const successful = results.filter((r) => !r.error);
      const totalSolValue = results.reduce((s, r) => s + r.solValue, 0);
      const totalPnL = results.reduce((s, r) => s + r.estimatedPnL, 0);
      const totalTrades = results.reduce((s, r) => s + r.tradeCount, 0);
      const avgWinRate = successful.length > 0
        ? successful.reduce((s, r) => s + parseFloat(r.winRate), 0) / successful.length
        : 0;
      const combinedTokenCount = results.reduce((s, r) => s + r.tokenCount, 0);

      setMerged({ wallets: results, totalSolValue, totalPnL, totalTrades, avgWinRate, combinedTokenCount });
      toast({ title: `Merged ${valid.length} wallets` });
    } catch {
      toast({ title: "Failed to merge wallets", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K`
    : `$${n.toFixed(2)}`;

  return (
    <Card className="p-6 bg-transparent border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-[#eab308]/10">
          <GitMerge className="h-5 w-5 text-[#eab308]" />
        </div>
        <div>
          <h3 className="font-bold text-white">Multi-Wallet Merge</h3>
          <p className="text-sm text-white/50">Combine stats across multiple wallets</p>
        </div>
      </div>

      {/* Wallet inputs */}
      <div className="space-y-2 mb-4">
        {addresses.map((addr, idx) => (
          <div key={idx} className="flex gap-2">
            <div className="relative flex-1">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <Input
                placeholder={`Wallet ${idx + 1} address...`}
                value={addr}
                onChange={(e) => updateAddress(idx, e.target.value)}
                className="pl-9 bg-white/[0.04] border-white/10 text-white placeholder:text-white/20 text-sm"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeWallet(idx)}
              disabled={addresses.length <= 2}
              className="h-9 w-9 text-white/30 hover:text-red-400 hover:bg-red-400/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-5">
        <Button variant="outline" onClick={addWallet} className="flex-1 border-white/10 text-white/60 hover:text-white gap-2 text-sm">
          <Plus className="h-3.5 w-3.5" /> Add Wallet
        </Button>
        <Button onClick={analyzeAll} disabled={loading} className="flex-1 bg-[#eab308]/10 border border-[#eab308]/20 text-[#eab308] hover:bg-[#eab308]/20 gap-2 text-sm">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
          {loading ? "Merging..." : "Merge View"}
        </Button>
      </div>

      {merged && (
        <div className="space-y-4">
          {/* Totals */}
          <div className="p-4 rounded-xl bg-[#eab308]/8 border border-[#eab308]/15">
            <p className="text-[10px] text-[#eab308]/60 uppercase tracking-widest font-bold mb-3">Combined Portfolio</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-white/40">Total Value</p>
                <p className="text-xl font-black text-white font-mono">{fmt(merged.totalSolValue)}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/40">Combined PnL</p>
                <p className={`text-xl font-black font-mono ${merged.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {merged.totalPnL >= 0 ? "+" : ""}{fmt(Math.abs(merged.totalPnL))}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-white/40">Total Trades</p>
                <p className="text-lg font-bold text-white">{merged.totalTrades.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/40">Avg Win Rate</p>
                <p className="text-lg font-bold text-[#22d3ee]">{merged.avgWinRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* Per-wallet breakdown */}
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-2">Wallet Breakdown</p>
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {merged.wallets.map((w, i) => (
                  <div key={i} className={`p-3 rounded-xl border ${w.error ? "border-red-500/20 bg-red-500/5" : "border-white/[0.07] bg-white/[0.03]"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className="text-[9px] bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20">#{i + 1}</Badge>
                        <span className="text-xs text-white/50 font-mono">{formatAddress(w.address, 6)}</span>
                      </div>
                      <a href={`https://solscan.io/account/${w.address}`} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-white/50">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    {w.error ? (
                      <p className="text-xs text-red-400">Failed to fetch</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[9px] text-white/30">Value</p>
                          <p className="text-xs font-bold text-white">{fmt(w.solValue)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-white/30">PnL</p>
                          <p className={`text-xs font-bold ${w.estimatedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {w.estimatedPnL >= 0 ? "+" : ""}{fmt(Math.abs(w.estimatedPnL))}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-white/30">Win %</p>
                          <p className="text-xs font-bold text-[#22d3ee]">{w.winRate}%</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </Card>
  );
};
