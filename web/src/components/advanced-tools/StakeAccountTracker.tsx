import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Lock, RefreshCw, TrendingUp, Unlock, Layers } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatUsd } from "@/lib/solana-api";

export const StakeAccountTracker = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<any>(null);

  const track = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getWalletOverview", walletAddress },
      });
      // Also fetch assets to find staked tokens
      const { data: assets } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getAssets", walletAddress },
      });
      const stakeTokens = (assets?.items || []).filter((t: any) => {
        const name = (t.content?.metadata?.name || "").toLowerCase();
        return name.includes("stake") || name.includes("msol") || name.includes("bsol") || name.includes("jitoSOL") || name.includes("liquid");
      });
      const stakedValue = stakeTokens.reduce((s: number, t: any) => s + (t.token_info?.price_info?.total_price || 0), 0);
      setInfo({
        solBalance: data?.balance || 0,
        usdValue: data?.usdValue || 0,
        stakedValue,
        stakeTokens,
        apy: 7.2,
      });
      toast({ title: "Stake tracking complete" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <Lock className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">Stake Account Tracker</h3>
          <p className="text-xs text-white/40">SOL staking positions, liquid staking & validators</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={track} disabled={loading} className="btn-3d shrink-0 gap-1.5">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Track
        </Button>
      </div>

      {info && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "SOL Balance", val: `${info.solBalance.toFixed(4)} SOL`, sub: formatUsd(info.usdValue), color: "text-[#eab308]" },
              { label: "Staked Value", val: formatUsd(info.stakedValue), sub: `${info.stakeTokens.length} positions`, color: "text-emerald-400" },
              { label: "Network APY", val: `${info.apy}%`, sub: "Estimated", color: "text-[#22d3ee]" },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                <p className={`text-lg font-black ${s.color}`}>{s.val}</p>
                <p className="text-[10px] text-white/30">{s.label}</p>
                <p className="text-[9px] text-white/20">{s.sub}</p>
              </div>
            ))}
          </div>

          {info.stakeTokens.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-white/40 mb-2">LIQUID STAKING TOKENS</p>
              <div className="space-y-2">
                {info.stakeTokens.map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div>
                      <p className="text-sm font-semibold">{t.content?.metadata?.symbol || "?"}</p>
                      <p className="text-xs text-white/30">{t.content?.metadata?.name}</p>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      {formatUsd(t.token_info?.price_info?.total_price || 0)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {info.stakeTokens.length === 0 && (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] text-center">
              <Unlock className="h-8 w-8 mx-auto mb-2 text-white/15" />
              <p className="text-sm text-white/30">No liquid staking positions found</p>
              <p className="text-xs text-white/20 mt-1">Consider mSOL, bSOL, or JitoSOL for yield</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
