import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, RefreshCw, TrendingUp, TrendingDown, Repeat } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { solanaTracker } from "@/lib/solana-tools";

export const TransferProfiler = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const analyze = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await solanaTracker("getTransactions", { walletAddress, limit: 100 });
      const txs = data?.transactions || [];
      let incoming = 0, outgoing = 0, swaps = 0, other = 0;
      txs.forEach((tx: any) => {
        const type = tx.type?.toLowerCase() || "";
        if (type.includes("swap")) swaps++;
        else if (type.includes("transfer")) {
          if (tx.nativeTransfers?.some((t: any) => t.toUserAccount === walletAddress)) incoming++;
          else outgoing++;
        } else other++;
      });
      const total = txs.length;
      const pattern = swaps > total * 0.5 ? "Active Trader" : incoming > outgoing ? "Accumulator" : outgoing > incoming * 1.5 ? "Distributor" : "Mixed";
      setProfile({ incoming, outgoing, swaps, other, total, pattern });
      toast({ title: "Transfer profile complete" });
    } catch {
      toast({ title: "Error profiling transfers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const patternColors: Record<string, string> = {
    "Active Trader": "text-[#22d3ee] bg-[#22d3ee]/10 border-[#22d3ee]/20",
    "Accumulator": "text-green-400 bg-green-500/10 border-green-500/20",
    "Distributor": "text-orange-400 bg-orange-500/10 border-orange-500/20",
    "Mixed": "text-white/60 bg-white/[0.04] border-white/[0.08]",
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <ArrowUpDown className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">Transfer Profiler</h3>
          <p className="text-xs text-white/40">Analyze sending patterns, inflow vs. outflow</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={analyze} disabled={loading} className="btn-3d shrink-0 gap-1.5">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowUpDown className="h-4 w-4" />}
          Profile
        </Button>
      </div>

      {profile && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-violet-500/5 border border-violet-500/10">
            <div>
              <p className="text-xs text-white/30">Wallet Pattern</p>
              <p className="font-bold text-white">{profile.pattern}</p>
            </div>
            <Badge className={patternColors[profile.pattern] || patternColors["Mixed"]}>{profile.pattern}</Badge>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Incoming", val: profile.incoming, Icon: TrendingDown, color: "text-green-400" },
              { label: "Outgoing", val: profile.outgoing, Icon: TrendingUp, color: "text-red-400" },
              { label: "Swaps", val: profile.swaps, Icon: Repeat, color: "text-[#22d3ee]" },
              { label: "Other", val: profile.other, Icon: ArrowUpDown, color: "text-white/40" },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                <s.Icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
                <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
                <p className="text-[9px] text-white/25">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Bar visualization */}
          <div className="space-y-2">
            {[
              { label: "Incoming", val: profile.incoming, color: "bg-green-400/60" },
              { label: "Outgoing", val: profile.outgoing, color: "bg-red-400/60" },
              { label: "Swaps", val: profile.swaps, color: "bg-[#22d3ee]/60" },
            ].map((b) => {
              const pct = profile.total > 0 ? (b.val / profile.total) * 100 : 0;
              return (
                <div key={b.label} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">{b.label}</span>
                    <span className="text-white/30">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${b.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-white/20 text-center">{profile.total} transactions analyzed</p>
        </div>
      )}
    </div>
  );
};
