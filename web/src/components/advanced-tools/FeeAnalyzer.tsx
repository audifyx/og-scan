import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Gauge, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const FeeAnalyzer = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<any>(null);

  const analyze = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 100 },
      });
      const fees = (data?.transactions || []).map((t: any) => t.fee || 5000).filter((f: number) => f > 0);
      if (!fees.length) { toast({ title: "No fee data" }); setLoading(false); return; }
      const avg = fees.reduce((a: number, b: number) => a + b, 0) / fees.length;
      const low = fees.filter((f: number) => f <= 5000).length;
      const med = fees.filter((f: number) => f > 5000 && f <= 50000).length;
      const high = fees.filter((f: number) => f > 50000).length;
      const strategy = low > fees.length * 0.7 ? "Efficient" : high > fees.length * 0.3 ? "Aggressive" : "Balanced";
      setInfo({ avg, max: Math.max(...fees), min: Math.min(...fees), total: fees.length, low, med, high, strategy });
      toast({ title: "Fee analysis complete" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const strategyColor: Record<string, string> = {
    "Efficient": "text-green-400 bg-green-500/10 border-green-500/20",
    "Aggressive": "text-red-400 bg-red-500/10 border-red-500/20",
    "Balanced": "text-[#22d3ee] bg-[#22d3ee]/10 border-[#22d3ee]/20",
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Gauge className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">Fee Analyzer</h3>
          <p className="text-xs text-white/40">Priority fee patterns, distribution & efficiency</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={analyze} disabled={loading} className="btn-3d shrink-0 gap-1.5">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
          Analyze
        </Button>
      </div>

      {info && (
        <div className="space-y-3">
          <div className={`p-3 rounded-xl border flex items-center justify-between ${strategyColor[info.strategy] || ""}`}>
            <span className="text-sm font-bold">Fee Strategy</span>
            <Badge className={strategyColor[info.strategy] || ""}>{info.strategy}</Badge>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Avg Fee", val: (info.avg / 1e9).toFixed(6), unit: "SOL" },
              { label: "Max Fee", val: (info.max / 1e9).toFixed(6), unit: "SOL" },
              { label: "Min Fee", val: (info.min / 1e9).toFixed(6), unit: "SOL" },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                <p className="text-[10px] text-white/30 mb-0.5">{s.label}</p>
                <p className="text-sm font-black text-white">{s.val}</p>
                <p className="text-[9px] text-white/20">{s.unit}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-white/40">FEE DISTRIBUTION</p>
            {[
              { label: "Low Priority (≤5K lamports)", val: info.low, color: "bg-green-400/50" },
              { label: "Medium (5K–50K lamports)", val: info.med, color: "bg-yellow-400/50" },
              { label: "High Priority (>50K lamports)", val: info.high, color: "bg-red-400/60" },
            ].map((b) => {
              const pct = (b.val / info.total) * 100;
              return (
                <div key={b.label} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">{b.label}</span>
                    <span className="text-white/30">{b.val} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${b.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
