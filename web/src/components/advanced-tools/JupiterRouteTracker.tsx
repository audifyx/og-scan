import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, RefreshCw, Route, ExternalLink, Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatAddress } from "@/lib/solana-api";
import { solanaTracker } from "@/lib/solana-tools";

export const JupiterRouteTracker = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total: number; programs: Record<string, number> } | null>(null);

  const analyzeRoutes = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await solanaTracker("getTransactions", { walletAddress, limit: 100 });
      const swaps = (data?.transactions || []).filter((tx: any) =>
        tx.type?.toLowerCase().includes("swap") || tx.source?.toLowerCase().includes("jupiter")
      );
      const programCounts: Record<string, number> = {};
      swaps.forEach((tx: any) => {
        const src = tx.source || "Unknown";
        programCounts[src] = (programCounts[src] || 0) + 1;
      });
      setRoutes(swaps.slice(0, 20).map((tx: any) => ({
        signature: tx.signature,
        timestamp: tx.timestamp,
        type: tx.type,
        description: tx.description,
        program: tx.source || "Unknown",
        fee: tx.fee,
      })));
      setStats({ total: swaps.length, programs: programCounts });
      toast({ title: `Found ${swaps.length} Jupiter swap routes` });
    } catch {
      toast({ title: "Error analyzing routes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#22d3ee]/10 border border-[#22d3ee]/20">
          <Route className="h-5 w-5 text-[#22d3ee]" />
        </div>
        <div>
          <h3 className="font-bold text-white">Jupiter Route Tracker</h3>
          <p className="text-xs text-white/40">Analyze swap routes, AMMs, and slippage history</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={analyzeRoutes} disabled={loading} className="btn-3d gap-1.5 shrink-0">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Analyze
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-xl bg-[#22d3ee]/5 border border-[#22d3ee]/10 text-center">
            <p className="text-2xl font-black text-[#22d3ee]">{stats.total}</p>
            <p className="text-[10px] text-white/30">Total Swaps</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
            <p className="text-2xl font-black text-white">{Object.keys(stats.programs).length}</p>
            <p className="text-[10px] text-white/30">AMMs Used</p>
          </div>
        </div>
      )}

      {stats && Object.keys(stats.programs).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-white/50 mb-2">ROUTING BREAKDOWN</p>
          <div className="space-y-1.5">
            {Object.entries(stats.programs).sort(([, a], [, b]) => b - a).map(([prog, cnt]) => {
              const pct = Math.round((cnt / stats.total) * 100);
              return (
                <div key={prog} className="flex items-center gap-2">
                  <span className="text-xs text-white/60 w-24 truncate">{prog}</span>
                  <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-[#22d3ee]/60 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-white/40 w-10 text-right">{cnt}x</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {routes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/50">RECENT ROUTES</p>
          {routes.slice(0, 10).map((r, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-white/60">{formatAddress(r.signature, 6)}</p>
                <p className="text-[10px] text-white/25 truncate">{r.description || r.type}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="text-[9px] bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/20">{r.program}</Badge>
                <a href={`https://solscan.io/tx/${r.signature}`} target="_blank" rel="noopener noreferrer"
                  className="text-white/20 hover:text-white/60 transition-colors">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
