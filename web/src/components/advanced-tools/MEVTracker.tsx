import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Zap, RefreshCw, AlertTriangle, Bot, Shield } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const MEVTracker = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const track = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 100 },
      });
      const txs = data?.transactions || [];
      const highPriority = txs.filter((t: any) => t.fee && t.fee > 5000).length;
      const sandwich = txs.filter((t: any) => t.type?.toLowerCase().includes("swap") && t.fee > 10000).length;
      const jito = txs.filter((t: any) => t.fee && t.fee > 100000).length;
      const mevScore = txs.length > 0 ? Math.min(((highPriority + sandwich) / txs.length) * 100, 100) : 0;
      const isBot = highPriority > txs.length * 0.3;
      setAnalysis({ total: txs.length, highPriority, sandwich, jito, mevScore, isBot });
      toast({ title: "MEV analysis complete" });
    } catch {
      toast({ title: "Error analyzing MEV activity", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#eab308]/10 border border-[#eab308]/20">
          <Zap className="h-5 w-5 text-[#eab308]" />
        </div>
        <div>
          <h3 className="font-bold text-white">MEV Tracker</h3>
          <p className="text-xs text-white/40">Detect Jito bundles, sandwich attacks & MEV</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={track} disabled={loading} className="btn-3d shrink-0 gap-1.5">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Track
        </Button>
      </div>

      {analysis && (
        <div className="space-y-3">
          {analysis.isBot ? (
            <div className="p-3 rounded-xl bg-[#eab308]/10 border border-[#eab308]/20 flex items-center gap-2">
              <Bot className="h-4 w-4 text-[#eab308]" />
              <span className="text-sm font-bold text-[#eab308]">Likely Bot / MEV Wallet</span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-400" />
              <span className="text-sm font-bold text-green-400">No Significant MEV Activity</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-[#eab308]/5 border border-[#eab308]/10 text-center">
              <p className="text-2xl font-black text-[#eab308]">{analysis.mevScore.toFixed(0)}%</p>
              <p className="text-[10px] text-white/30">MEV Score</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
              <p className="text-2xl font-black text-white">{analysis.total}</p>
              <p className="text-[10px] text-white/30">Txs Analyzed</p>
            </div>
          </div>

          <div className="space-y-1.5">
            {[
              { label: "High Priority Fees", val: analysis.highPriority, color: "text-orange-400" },
              { label: "Sandwich Suspects", val: analysis.sandwich, color: "text-red-400" },
              { label: "Jito Bundle (est.)", val: analysis.jito, color: "text-[#eab308]" },
            ].map((s) => (
              <div key={s.label} className="flex justify-between items-center py-1.5 border-b border-white/[0.04] last:border-0">
                <span className="text-xs text-white/40">{s.label}</span>
                <span className={`text-sm font-bold ${s.color}`}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
