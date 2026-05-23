import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Database, RefreshCw, Activity } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const PROGRAM_LABELS: Record<string, string> = {
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "Jupiter",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "Orca",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo": "Meteora",
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "Pump.fun",
};

const PROGRAM_COLORS: Record<string, string> = {
  "Jupiter": "text-green-400 bg-green-500/10 border-green-500/20",
  "Raydium": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "Orca": "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  "Meteora": "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "Pump.fun": "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

export const ProgramInteractionMonitor = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [interactions, setInteractions] = useState<{ name: string; count: number; pct: number }[]>([]);
  const [total, setTotal] = useState(0);

  const analyze = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 100 },
      });
      const counts: Record<string, number> = {};
      (data?.transactions || []).forEach((tx: any) => {
        const src = tx.source || "Unknown";
        counts[src] = (counts[src] || 0) + 1;
      });
      const tot = Object.values(counts).reduce((a, b) => a + b, 0);
      setTotal(tot);
      setInteractions(
        Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([src, cnt]) => ({
            name: PROGRAM_LABELS[src] || src,
            count: cnt,
            pct: tot > 0 ? (cnt / tot) * 100 : 0,
          }))
      );
      toast({ title: "Analysis complete" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Database className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">Program Interaction Monitor</h3>
          <p className="text-xs text-white/40">Track usage of Raydium, Jupiter, Pump.fun, etc.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={analyze} disabled={loading} className="btn-3d shrink-0 gap-1.5">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
          Analyze
        </Button>
      </div>

      {interactions.length > 0 && (
        <>
          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center">
            <p className="text-2xl font-black text-blue-400">{total}</p>
            <p className="text-xs text-white/30">Total Interactions</p>
          </div>

          <div className="space-y-2">
            {interactions.map((item) => {
              const color = PROGRAM_COLORS[item.name] || "text-white/60 bg-white/[0.04] border-white/[0.08]";
              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] ${color}`}>{item.name}</Badge>
                    </div>
                    <span className="text-xs text-white/40">{item.count}x · {item.pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#22d3ee]/60 to-[#22d3ee]/20" style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
