import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Gift, RefreshCw, AlertTriangle, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { solanaTracker } from "@/lib/solana-tools";

export const AirdropAnalyzer = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const analyze = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await solanaTracker("getTransactions", { walletAddress, limit: 100 });
      const txs = data?.transactions || [];
      const claims = txs.filter((t: any) =>
        t.type?.toLowerCase().includes("airdrop") ||
        t.description?.toLowerCase().includes("claim") ||
        t.description?.toLowerCase().includes("airdrop")
      );
      const fastClaims = claims.filter((t: any, i: number) => {
        if (i === 0) return false;
        const prev = claims[i - 1];
        return prev?.timestamp && t.timestamp && Math.abs(t.timestamp - prev.timestamp) < 60;
      });
      const isFarmer = claims.length > 5 || fastClaims.length > 2;
      setResult({
        total: txs.length,
        claims: claims.length,
        fastClaims: fastClaims.length,
        isFarmer,
        recent: claims.slice(0, 5),
      });
      toast({ title: "Airdrop analysis complete" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <Gift className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">Airdrop Analyzer</h3>
          <p className="text-xs text-white/40">Detect airdrop farming behavior</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={analyze} disabled={loading} className="btn-3d shrink-0 gap-1.5">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
          Analyze
        </Button>
      </div>

      {result && (
        <div className="space-y-3">
          {result.isFarmer ? (
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-bold text-yellow-400">Possible Airdrop Farmer</span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2">
              <Check className="h-4 w-4 text-green-400" />
              <span className="text-sm font-bold text-green-400">Normal Claim Activity</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Claims Found", val: result.claims, color: "text-purple-400" },
              { label: "Fast Claims", val: result.fastClaims, color: result.fastClaims > 0 ? "text-yellow-400" : "text-white" },
              { label: "Total Txs", val: result.total, color: "text-white" },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
                <p className="text-[10px] text-white/25">{s.label}</p>
              </div>
            ))}
          </div>

          {result.recent.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-white/40 mb-2">RECENT CLAIMS</p>
              <div className="space-y-1.5">
                {result.recent.map((tx: any, i: number) => (
                  <div key={i} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <p className="text-[10px] font-mono text-white/40">{tx.signature?.slice(0, 24)}…</p>
                    <p className="text-[9px] text-white/20">{tx.description?.slice(0, 60)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
