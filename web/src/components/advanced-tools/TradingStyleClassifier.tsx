import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Target, RefreshCw, Zap, Clock, TrendingUp, Bot, Droplets } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { solanaTracker } from "@/lib/solana-tools";

const STYLES = {
  sniper:  { label: "Sniper", icon: Target, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", desc: "Fast entries on new launches, high fee txs" },
  swing:   { label: "Swing Trader", icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", desc: "Medium-term positions, buys dips" },
  holder:  { label: "Long Holder", icon: Clock, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", desc: "Buys and holds, low activity" },
  farmer:  { label: "Yield Farmer", icon: Droplets, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", desc: "LP & staking focus, passive income" },
  bot:     { label: "Bot / MEV", icon: Bot, color: "text-[#eab308]", bg: "bg-[#eab308]/10 border-[#eab308]/20", desc: "Automated trading, high fee usage" },
};

export const TradingStyleClassifier = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const classify = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await solanaTracker("getTransactions", { walletAddress, limit: 100 });
      const txs = data?.transactions || [];
      const swaps = txs.filter((t: any) => t.type?.toLowerCase().includes("swap")).length;
      const transfers = txs.filter((t: any) => t.type?.toLowerCase().includes("transfer")).length;
      const lp = txs.filter((t: any) => t.type?.toLowerCase().includes("liquidity") || t.type?.toLowerCase().includes("pool")).length;
      const highFee = txs.filter((t: any) => t.fee > 50000).length;
      const total = txs.length;

      let style = "swing";
      let confidence = 50;

      if (total === 0) { style = "holder"; confidence = 40; }
      else if (highFee > total * 0.3) { style = "bot"; confidence = 80; }
      else if (lp > total * 0.2) { style = "farmer"; confidence = 72; }
      else if (swaps > total * 0.6) { style = "sniper"; confidence = 68; }
      else if (transfers > swaps) { style = "holder"; confidence = 60; }
      else { style = "swing"; confidence = 55; }

      setResult({ style, confidence, stats: { swaps, transfers, lp, highFee, total } });
      toast({ title: "Classification complete" });
    } catch {
      toast({ title: "Error classifying wallet", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const s = result ? STYLES[result.style as keyof typeof STYLES] : null;

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#22d3ee]/10 border border-[#22d3ee]/20">
          <Target className="h-5 w-5 text-[#22d3ee]" />
        </div>
        <div>
          <h3 className="font-bold text-white">Trading Style Classifier</h3>
          <p className="text-xs text-white/40">Identify sniper, swing, holder, farmer, or bot</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={classify} disabled={loading} className="btn-3d shrink-0 gap-1.5">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
          Classify
        </Button>
      </div>

      {result && s && (
        <div className="space-y-3">
          {/* Style result card */}
          <div className={`p-4 rounded-xl border ${s.bg} flex items-center gap-4`}>
            <div className={`p-3 rounded-xl bg-white/[0.06] ${s.color}`}>
              <s.icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className={`font-black text-lg ${s.color}`}>{s.label}</p>
              <p className="text-xs text-white/30">{s.desc}</p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-black ${s.color}`}>{result.confidence}%</p>
              <p className="text-[10px] text-white/25">confidence</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Swaps", val: result.stats.swaps, color: "text-[#22d3ee]" },
              { label: "Transfers", val: result.stats.transfers, color: "text-white" },
              { label: "LP Actions", val: result.stats.lp, color: "text-purple-400" },
            ].map((st) => (
              <div key={st.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                <p className={`text-xl font-black ${st.color}`}>{st.val}</p>
                <p className="text-[10px] text-white/30">{st.label}</p>
              </div>
            ))}
          </div>

          {/* Style breakdown */}
          <div className="space-y-1.5">
            {Object.entries(STYLES).map(([key, style]) => {
              const isMatch = key === result.style;
              return (
                <div key={key} className={`flex items-center gap-2 p-2 rounded-xl ${isMatch ? `${style.bg}` : "opacity-30"}`}>
                  <style.icon className={`h-3.5 w-3.5 ${isMatch ? style.color : "text-white/30"}`} />
                  <span className={`text-xs flex-1 ${isMatch ? style.color : "text-white/30"}`}>{style.label}</span>
                  {isMatch && <Badge className={`${style.bg} ${style.color} text-[9px]`}>MATCH</Badge>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
