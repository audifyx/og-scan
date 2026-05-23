import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Target, RefreshCw, Zap, Clock, TrendingUp, Bot } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const TRADING_STYLES = {
  sniper: { label: "Sniper", icon: Target, color: "text-red-500", desc: "Fast entries on new tokens" },
  swing: { label: "Swing Trader", icon: TrendingUp, color: "text-blue-500", desc: "Medium-term positions" },
  holder: { label: "Long Holder", icon: Clock, color: "text-green-500", desc: "Buy and hold strategy" },
  farmer: { label: "Yield Farmer", icon: Zap, color: "text-purple-500", desc: "LP & staking focus" },
  bot: { label: "Bot/MEV", icon: Bot, color: "text-yellow-500", desc: "Automated trading" },
};

export const TradingStyleClassifier = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [classification, setClassification] = useState<any>(null);

  const classifyStyle = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 100 },
      });

      const txs = data?.transactions || [];
      
      // Analyze patterns
      const swaps = txs.filter((tx: any) => tx.type?.toLowerCase().includes("swap")).length;
      const transfers = txs.filter((tx: any) => tx.type?.toLowerCase().includes("transfer")).length;
      const lpActions = txs.filter((tx: any) => 
        tx.type?.toLowerCase().includes("liquidity") || tx.type?.toLowerCase().includes("pool")
      ).length;
      
      const avgTimeBetweenTx = txs.length > 1 ? 
        (txs[0]?.timestamp - txs[txs.length - 1]?.timestamp) / txs.length : 0;
      
      // High fee = likely bot/sniper
      const highFeeTxs = txs.filter((tx: any) => tx.fee > 50000).length;
      
      let style = "swing";
      let confidence = 50;
      
      if (highFeeTxs > txs.length * 0.3) {
        style = "bot";
        confidence = 75;
      } else if (lpActions > txs.length * 0.2) {
        style = "farmer";
        confidence = 70;
      } else if (swaps > txs.length * 0.6 && avgTimeBetweenTx < 3600) {
        style = "sniper";
        confidence = 65;
      } else if (transfers > swaps) {
        style = "holder";
        confidence = 60;
      }

      setClassification({
        style,
        confidence,
        stats: {
          swaps,
          transfers,
          lpActions,
          totalTxs: txs.length,
        },
      });

      toast({ title: "Classification complete" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const styleInfo = classification ? TRADING_STYLES[classification.style as keyof typeof TRADING_STYLES] : null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Trading Style Classifier</h3>
          <p className="text-sm text-muted-foreground">Identify wallet trading behavior</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Enter wallet address..."
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
        />
        <Button onClick={classifyStyle} disabled={loading}>
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Classify"}
        </Button>
      </div>

      {classification && styleInfo && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-background ${styleInfo.color}`}>
              <styleInfo.icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">{styleInfo.label}</p>
              <p className="text-sm text-muted-foreground">{styleInfo.desc}</p>
            </div>
            <Badge variant="secondary">{classification.confidence}% confidence</Badge>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Swaps</p>
              <p className="font-bold">{classification.stats.swaps}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Transfers</p>
              <p className="font-bold">{classification.stats.transfers}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">LP Actions</p>
              <p className="font-bold">{classification.stats.lpActions}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
