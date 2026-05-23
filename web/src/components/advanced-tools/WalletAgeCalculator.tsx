import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Clock, RefreshCw, Calendar, Activity } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";

export const WalletAgeCalculator = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletInfo, setWalletInfo] = useState<any>(null);

  const calculateAge = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 100 },
      });

      const transactions = data?.transactions || [];
      const timestamps = transactions
        .filter((tx: any) => tx.timestamp)
        .map((tx: any) => tx.timestamp);

      if (timestamps.length > 0) {
        const oldestTimestamp = Math.min(...timestamps);
        const newestTimestamp = Math.max(...timestamps);
        
        setWalletInfo({
          firstActivity: new Date(oldestTimestamp * 1000),
          lastActivity: new Date(newestTimestamp * 1000),
          totalTransactions: transactions.length,
          estimatedAge: formatDistanceToNow(new Date(oldestTimestamp * 1000)),
        });
      }

      toast({ title: "Analysis complete" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-indigo-500/10">
          <Clock className="h-5 w-5 text-indigo-500" />
        </div>
        <div>
          <h3 className="font-semibold">Wallet Age Calculator</h3>
          <p className="text-sm text-muted-foreground">Creation date, first transaction, activity history</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Enter wallet address..."
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
        />
        <Button onClick={calculateAge} disabled={loading}>
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Calculate"}
        </Button>
      </div>

      {walletInfo && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-white/[0.04]">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">First Activity</p>
              </div>
              <p className="font-medium text-sm">{format(walletInfo.firstActivity, "PPP")}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.04]">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Last Activity</p>
              </div>
              <p className="font-medium text-sm">{format(walletInfo.lastActivity, "PPP")}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
            <div>
              <p className="text-xs text-muted-foreground">Wallet Age</p>
              <p className="font-semibold text-primary">{walletInfo.estimatedAge}</p>
            </div>
            <Badge variant="secondary">{walletInfo.totalTransactions}+ txns</Badge>
          </div>
        </div>
      )}
    </Card>
  );
};
