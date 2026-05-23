import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { Database, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const KNOWN_PROGRAMS: Record<string, string> = {
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "Jupiter",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "Orca",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo": "Meteora",
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "Pump.fun",
};

export const ProgramInteractionMonitor = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [interactions, setInteractions] = useState<Record<string, number>>({});

  const analyze = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 100 },
      });

      const programCounts: Record<string, number> = {};
      data?.transactions?.forEach((tx: any) => {
        const source = tx.source || "Unknown";
        programCounts[source] = (programCounts[source] || 0) + 1;
      });

      setInteractions(programCounts);
      toast({ title: "Analysis complete" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const totalInteractions = Object.values(interactions).reduce((a, b) => a + b, 0);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <Database className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h3 className="font-semibold">Program Interaction Monitor</h3>
          <p className="text-sm text-muted-foreground">Track Raydium, Pump.fun, Meteora, etc.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Enter wallet address..."
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
        />
        <Button onClick={analyze} disabled={loading}>
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Analyze"}
        </Button>
      </div>

      {Object.keys(interactions).length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">{totalInteractions} Total Interactions</p>
          {Object.entries(interactions)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([program, count]) => (
              <div key={program} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{KNOWN_PROGRAMS[program] || program}</span>
                  <span className="text-muted-foreground">{count} ({((count / totalInteractions) * 100).toFixed(1)}%)</span>
                </div>
                <Progress value={(count / totalInteractions) * 100} className="h-2" />
              </div>
            ))}
        </div>
      )}
    </Card>
  );
};
