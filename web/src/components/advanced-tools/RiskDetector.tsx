import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, RefreshCw, AlertTriangle, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { solanaTracker } from "@/lib/solana-tools";

const RISK_FLAGS = [
  { id: "lowTxCount", label: "Low Activity", desc: "Fewer than 10 transactions" },
  { id: "tokenDeployer", label: "Token Deployer", desc: "Has deployed tokens before" },
  { id: "unusualPatterns", label: "Unusual Patterns", desc: ">80% of txs are swaps" },
  { id: "highPriorityFees", label: "High Priority Fees", desc: "Consistently paying elevated fees" },
];

export const RiskDetector = () => {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const analyze = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [{ data: overview }, { data: txData }] = await Promise.all([
        solanaTracker("getWalletOverview", { walletAddress: address }),
        solanaTracker("getTransactions", { walletAddress: address, limit: 50 }),
      ]);
      const txs = txData?.transactions || [];
      const flags: string[] = [];
      let score = 0;
      if (txs.length < 10) { flags.push("lowTxCount"); score += 20; }
      if (txs.some((t: any) => t.type?.toLowerCase().includes("create"))) { flags.push("tokenDeployer"); score += 15; }
      const swaps = txs.filter((t: any) => t.type?.toLowerCase().includes("swap")).length;
      if (txs.length > 0 && swaps > txs.length * 0.8) { flags.push("unusualPatterns"); score += 25; }
      const highFee = txs.filter((t: any) => t.fee > 50000).length;
      if (txs.length > 0 && highFee > txs.length * 0.3) { flags.push("highPriorityFees"); score += 20; }
      setResult({ flags, score: Math.min(score, 100), total: txs.length, balance: overview?.balance || 0 });
      toast({ title: "Risk analysis complete" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const riskLevel = result
    ? result.score >= 60 ? { label: "HIGH RISK", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" }
    : result.score >= 30 ? { label: "MEDIUM RISK", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" }
    : { label: "LOW RISK", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" }
    : null;

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          <Shield className="h-5 w-5 text-red-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">Risk Detector</h3>
          <p className="text-xs text-white/40">Flag high-risk wallets & behaviors</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter wallet or token address..." value={address} onChange={(e) => setAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={analyze} disabled={loading} className="btn-3d shrink-0 gap-1.5">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
          Analyze
        </Button>
      </div>

      {result && riskLevel && (
        <div className="space-y-3">
          <div className={`p-4 rounded-xl border ${riskLevel.bg} flex items-center justify-between`}>
            <div>
              <p className="text-xs text-white/30">Risk Score</p>
              <p className={`text-3xl font-black ${riskLevel.color}`}>{result.score}<span className="text-base font-normal text-white/20">/100</span></p>
            </div>
            <Badge className={`${riskLevel.bg} ${riskLevel.color} text-xs`}>{riskLevel.label}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Transactions", val: result.total },
              { label: "SOL Balance", val: `${result.balance.toFixed(3)} SOL` },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                <p className="text-sm font-bold text-white">{s.val}</p>
                <p className="text-[10px] text-white/30">{s.label}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-white/40 mb-2">RISK FLAGS</p>
            <div className="space-y-1.5">
              {RISK_FLAGS.map((flag) => {
                const active = result.flags.includes(flag.id);
                return (
                  <div key={flag.id} className={`flex items-center gap-2 p-2.5 rounded-xl border ${active ? "bg-red-500/10 border-red-500/20" : "bg-white/[0.02] border-white/[0.04]"}`}>
                    {active ? <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" /> : <Check className="h-3.5 w-3.5 text-green-400 shrink-0" />}
                    <div>
                      <p className={`text-xs font-semibold ${active ? "text-red-400" : "text-white/40"}`}>{flag.label}</p>
                      <p className="text-[10px] text-white/20">{flag.desc}</p>
                    </div>
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
