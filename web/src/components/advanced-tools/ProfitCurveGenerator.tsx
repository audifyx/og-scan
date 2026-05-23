import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { TrendingUp, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const ProfitCurveGenerator = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [pnl, setPnl] = useState<any>(null);

  const generate = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", { body: { action: "getWalletPnL", walletAddress } });
      setPnl(data);
      toast({ title: "Generated" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-green-500/10"><TrendingUp className="h-5 w-5 text-green-500" /></div>
        <div><h3 className="font-semibold">Profit Curve Generator</h3><p className="text-sm text-muted-foreground">PnL over time</p></div>
      </div>
      <div className="flex gap-2 mb-4">
        <Input placeholder="Wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} />
        <Button onClick={generate} disabled={loading}>{loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Generate"}</Button>
      </div>
      {pnl && <div className="p-4 rounded-lg bg-muted/50"><p className={`text-xl font-bold ${pnl.totalPnL >= 0 ? "text-green-500" : "text-red-500"}`}>{pnl.totalPnL >= 0 ? "+" : ""}{pnl.totalPnL?.toFixed(2)} SOL</p></div>}
    </Card>
  );
};
