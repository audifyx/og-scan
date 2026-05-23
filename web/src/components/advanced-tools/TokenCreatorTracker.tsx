import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { User, RefreshCw, AlertTriangle, Shield, ExternalLink, Coins } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatAddress } from "@/lib/solana-api";
import { formatDistanceToNow } from "date-fns";

export const TokenCreatorTracker = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<any>(null);

  const track = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 100 },
      });
      const txs = data?.transactions || [];
      const deployments = txs.filter((tx: any) =>
        tx.type?.toLowerCase().includes("create") ||
        tx.type?.toLowerCase().includes("initialize") ||
        tx.type?.toLowerCase().includes("mint")
      );
      const riskLevel = deployments.length > 10 ? "high" : deployments.length > 3 ? "medium" : "low";
      setInfo({
        totalDeployments: deployments.length,
        isActiveDeployer: deployments.length > 3,
        recent: deployments.slice(0, 8).map((tx: any) => ({
          sig: tx.signature,
          type: tx.type,
          desc: tx.description,
          ts: tx.timestamp ? new Date(tx.timestamp * 1000) : null,
        })),
        riskLevel,
      });
      toast({ title: "Creator analysis complete" });
    } catch {
      toast({ title: "Error tracking creator", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const riskMap = {
    high: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "HIGH RISK — Prolific Deployer" },
    medium: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "MEDIUM — Active Deployer" },
    low: { color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", label: "LOW — Minimal Deployments" },
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20">
          <User className="h-5 w-5 text-pink-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">Token Creator Tracker</h3>
          <p className="text-xs text-white/40">Identify wallets that frequently deploy tokens</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={track} disabled={loading} className="btn-3d shrink-0 gap-1.5">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
          Track
        </Button>
      </div>

      {info && (() => {
        const r = riskMap[info.riskLevel as keyof typeof riskMap];
        return (
          <div className="space-y-3">
            <div className={`p-3 rounded-xl border ${r.bg} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                {info.riskLevel !== "low" ? <AlertTriangle className={`h-4 w-4 ${r.color}`} /> : <Shield className="h-4 w-4 text-green-400" />}
                <span className={`text-sm font-bold ${r.color}`}>{r.label}</span>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-black ${r.color}`}>{info.totalDeployments}</p>
                <p className="text-[10px] text-white/30">deployments</p>
              </div>
            </div>

            {info.recent.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-white/40 mb-2">RECENT DEPLOYMENTS</p>
                <div className="space-y-1.5">
                  {info.recent.map((tx: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                      <Coins className="h-3 w-3 text-pink-400/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono text-white/50 truncate">{formatAddress(tx.sig, 8)}</p>
                        <p className="text-[9px] text-white/25">{tx.type}{tx.ts ? ` · ${formatDistanceToNow(tx.ts, { addSuffix: true })}` : ""}</p>
                      </div>
                      <a href={`https://solscan.io/tx/${tx.sig}`} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-white/50">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
