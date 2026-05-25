import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Eye, RefreshCw, AlertTriangle, Users, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatAddress } from "@/lib/solana-api";
import { solanaTracker } from "@/lib/solana-tools";

export const InsiderDetector = () => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const detect = async () => {
    if (!tokenAddress) return;
    setLoading(true);
    try {
      const { data } = await solanaTracker("getTokenHolders", { tokenAddress, limit: 50 });
      const holders = data?.holders || [];
      const top10 = holders.slice(0, 10);
      const potentialInsiders = top10.filter((h: any) => (h.percentage || 0) > 3);
      setResults({
        totalHolders: data?.totalHolders || holders.length,
        potentialInsiders: potentialInsiders.length,
        top10,
      });
      toast({ title: "Insider analysis complete" });
    } catch {
      toast({ title: "Analysis failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          <Eye className="h-5 w-5 text-red-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">Insider Detector</h3>
          <p className="text-xs text-white/40">Detect pre-pump buying patterns & early wallets</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter token address..." value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={detect} disabled={loading} className="btn-3d shrink-0 gap-1.5">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          Scan
        </Button>
      </div>

      {results && (
        <div className="space-y-3">
          {results.potentialInsiders > 2 ? (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span className="text-sm font-bold text-red-400">{results.potentialInsiders} Potential Insider Wallets</span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-2">
              <Users className="h-4 w-4 text-white/30" />
              <span className="text-sm text-white/50">Distribution looks normal</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
              <p className="text-2xl font-black text-white">{results.totalHolders.toLocaleString()}</p>
              <p className="text-[10px] text-white/30">Total Holders</p>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
              <p className="text-2xl font-black text-red-400">{results.potentialInsiders}</p>
              <p className="text-[10px] text-white/30">Suspect Wallets</p>
            </div>
          </div>

          {results.top10.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-white/40 mb-2">TOP HOLDER ANALYSIS</p>
              <div className="space-y-1.5">
                {results.top10.map((h: any, i: number) => {
                  const pct = h.percentage || 0;
                  const suspect = pct > 3;
                  return (
                    <div key={i} className={`flex items-center gap-2 p-2 rounded-xl border ${suspect ? "bg-red-500/5 border-red-500/10" : "bg-white/[0.02] border-white/[0.04]"}`}>
                      <span className={`text-[10px] w-5 font-bold ${suspect ? "text-red-400" : "text-white/20"}`}>#{i + 1}</span>
                      <code className="text-[10px] font-mono text-white/40 flex-1">{formatAddress(h.address, 6)}</code>
                      <div className="w-16 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className={`h-full ${suspect ? "bg-red-400/60" : "bg-white/20"}`} style={{ width: `${Math.min(pct * 3, 100)}%` }} />
                      </div>
                      <span className={`text-[10px] w-10 text-right ${suspect ? "text-red-400" : "text-white/30"}`}>{pct.toFixed(1)}%</span>
                      <a href={`https://solscan.io/account/${h.address}`} target="_blank" rel="noopener noreferrer" className="text-white/15 hover:text-white/50">
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
