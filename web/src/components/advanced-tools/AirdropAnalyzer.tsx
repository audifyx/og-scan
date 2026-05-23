import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Gift, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const AirdropAnalyzer = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const analyze = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 100 },
      });
      const airdrops = data?.transactions?.filter((tx: any) => 
        tx.type?.toLowerCase().includes("airdrop") || tx.description?.toLowerCase().includes("claim")
      ) || [];
      setAnalysis({ airdropCount: airdrops.length, totalTxs: data?.transactions?.length || 0 });
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
        <div className="p-2 rounded-lg bg-purple-500/10">
          <Gift className="h-5 w-5 text-purple-500" />
        </div>
        <div>
          <h3 className="font-semibold">Airdrop Analyzer</h3>
          <p className="text-sm text-muted-foreground">Detect farming behavior</p>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <Input placeholder="Wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} />
        <Button onClick={analyze} disabled={loading}>{loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Analyze"}</Button>
      </div>
      {analysis && (
        <div className="p-4 rounded-lg bg-white/[0.04]">
          <p className="text-sm">Airdrop-related: <Badge>{analysis.airdropCount}</Badge></p>
        </div>
      )}
    </Card>
  );
};
