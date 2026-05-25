import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PieChart, RefreshCw, AlertTriangle, Users, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatAddress } from "@/lib/solana-api";
import { solanaTracker } from "@/lib/solana-tools";

export const WhaleConcentration = () => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const analyze = async () => {
    if (!tokenAddress) return;
    setLoading(true);
    try {
      const { data: res } = await solanaTracker("getTokenHolders", { tokenAddress });
      const holders = res?.holders || [];
      const top10 = holders.slice(0, 10).reduce((s: number, h: any) => s + (h.percentage || 0), 0);
      const top3 = holders.slice(0, 3).reduce((s: number, h: any) => s + (h.percentage || 0), 0);
      const riskLevel = top10 > 80 ? "critical" : top10 > 60 ? "high" : top10 > 40 ? "medium" : "low";
      setData({
        holders: holders.slice(0, 20),
        totalHolders: res?.totalHolders || holders.length,
        top10,
        top3,
        riskLevel,
      });
      toast({ title: "Concentration analysis complete" });
    } catch {
      toast({ title: "Error analyzing holders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const riskConfig = {
    critical: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Critical" },
    high:     { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: "High" },
    medium:   { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "Medium" },
    low:      { color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", label: "Low" },
  };
  const risk = data ? riskConfig[data.riskLevel as keyof typeof riskConfig] : null;

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#eab308]/10 border border-[#eab308]/20">
          <PieChart className="h-5 w-5 text-[#eab308]" />
        </div>
        <div>
          <h3 className="font-bold text-white">Whale Concentration</h3>
          <p className="text-xs text-white/40">Analyze top holder distribution and rug risk</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter token address..." value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={analyze} disabled={loading} className="btn-3d shrink-0 gap-1.5">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PieChart className="h-4 w-4" />}
          Analyze
        </Button>
      </div>

      {data && risk && (
        <div className="space-y-3">
          {/* Risk banner */}
          <div className={`p-3 rounded-xl border ${risk.bg} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              {data.riskLevel !== "low" && <AlertTriangle className={`h-4 w-4 ${risk.color}`} />}
              <span className={`font-bold ${risk.color}`}>{risk.label} Concentration Risk</span>
            </div>
            <Badge className={`${risk.bg} ${risk.color}`}>Top 10: {data.top10.toFixed(1)}%</Badge>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Total Holders", val: data.totalHolders.toLocaleString(), color: "text-white" },
              { label: "Top 3 Hold", val: `${data.top3.toFixed(1)}%`, color: data.top3 > 50 ? "text-red-400" : "text-[#eab308]" },
              { label: "Top 10 Hold", val: `${data.top10.toFixed(1)}%`, color: data.top10 > 60 ? "text-red-400" : "text-white" },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                <p className={`text-lg font-black ${s.color}`}>{s.val}</p>
                <p className="text-[10px] text-white/30">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Holder list */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-3.5 w-3.5 text-white/30" />
              <p className="text-xs font-semibold text-white/40">TOP HOLDERS</p>
            </div>
            <div className="space-y-1.5">
              {data.holders.slice(0, 10).map((h: any, i: number) => {
                const pct = h.percentage || 0;
                const isWhale = pct > 5;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[10px] w-5 text-center font-bold ${i < 3 ? "text-[#eab308]" : "text-white/20"}`}>#{i + 1}</span>
                    <code className="text-[10px] font-mono text-white/50 flex-1">{formatAddress(h.address, 6)}</code>
                    <div className="w-20 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${isWhale ? "bg-red-400/60" : "bg-[#22d3ee]/50"}`} style={{ width: `${Math.min(pct * 2, 100)}%` }} />
                    </div>
                    <span className={`text-[10px] w-10 text-right ${isWhale ? "text-red-400" : "text-white/40"}`}>{pct.toFixed(1)}%</span>
                    <a href={`https://solscan.io/account/${h.address}`} target="_blank" rel="noopener noreferrer" className="text-white/15 hover:text-white/50">
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
