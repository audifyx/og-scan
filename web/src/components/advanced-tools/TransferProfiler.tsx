import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { ArrowUpDown, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const TransferProfiler = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const analyzeTransfers = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 100 },
      });

      const txs = data?.transactions || [];
      
      let incoming = 0;
      let outgoing = 0;
      let swaps = 0;
      
      txs.forEach((tx: any) => {
        const type = tx.type?.toLowerCase() || "";
        if (type.includes("transfer")) {
          // Check if incoming or outgoing based on native transfers
          if (tx.nativeTransfers?.some((t: any) => t.toUserAccount === walletAddress)) {
            incoming++;
          } else {
            outgoing++;
          }
        } else if (type.includes("swap")) {
          swaps++;
        }
      });

      const total = incoming + outgoing + swaps;

      setProfile({
        incoming,
        outgoing,
        swaps,
        total,
        incomingPercent: total > 0 ? (incoming / total) * 100 : 0,
        outgoingPercent: total > 0 ? (outgoing / total) * 100 : 0,
        swapPercent: total > 0 ? (swaps / total) * 100 : 0,
        pattern: swaps > total * 0.5 ? "Active Trader" : incoming > outgoing ? "Accumulator" : "Distributor",
      });

      toast({ title: "Profile complete" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-violet-500/10">
          <ArrowUpDown className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <h3 className="font-semibold">Transfer Profiler</h3>
          <p className="text-sm text-muted-foreground">Analyze sending patterns & behavior</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Enter wallet address..."
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
        />
        <Button onClick={analyzeTransfers} disabled={loading}>
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Profile"}
        </Button>
      </div>

      {profile && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
            <span className="text-sm font-medium">Wallet Pattern</span>
            <Badge variant="secondary">{profile.pattern}</Badge>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-green-500" />
                  Incoming
                </span>
                <span>{profile.incoming} ({profile.incomingPercent.toFixed(1)}%)</span>
              </div>
              <Progress value={profile.incomingPercent} className="h-2" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-red-500" />
                  Outgoing
                </span>
                <span>{profile.outgoing} ({profile.outgoingPercent.toFixed(1)}%)</span>
              </div>
              <Progress value={profile.outgoingPercent} className="h-2" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <ArrowUpDown className="h-3 w-3 text-primary" />
                  Swaps
                </span>
                <span>{profile.swaps} ({profile.swapPercent.toFixed(1)}%)</span>
              </div>
              <Progress value={profile.swapPercent} className="h-2" />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-white/[0.04] text-center">
            <p className="text-sm text-muted-foreground">{profile.total} transactions analyzed</p>
          </div>
        </div>
      )}
    </Card>
  );
};
