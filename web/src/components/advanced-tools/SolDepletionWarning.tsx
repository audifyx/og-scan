import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Battery, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const SolDepletionWarning = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const check = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", { body: { action: "getBalance", walletAddress } });
      setBalance(data?.balance || 0);
      toast({ title: "Check complete" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isLow = balance !== null && balance < 0.01;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-orange-500/10"><Battery className="h-5 w-5 text-orange-500" /></div>
        <div><h3 className="font-semibold">SOL Depletion Warning</h3><p className="text-sm text-muted-foreground">Low balance alerts</p></div>
      </div>
      <div className="flex gap-2 mb-4">
        <Input placeholder="Wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} />
        <Button onClick={check} disabled={loading}>{loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Check"}</Button>
      </div>
      {balance !== null && (
        <div className={`p-4 rounded-lg ${isLow ? "bg-red-500/10 border border-red-500/20" : "bg-green-500/10"}`}>
          <div className="flex items-center gap-2">
            {isLow && <AlertTriangle className="h-4 w-4 text-red-500" />}
            <span className="font-medium">{balance.toFixed(4)} SOL</span>
            <Badge variant={isLow ? "destructive" : "default"}>{isLow ? "LOW" : "OK"}</Badge>
          </div>
        </div>
      )}
    </Card>
  );
};
