import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { ArrowRight, RefreshCw, Zap, Route } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const JupiterRouteTracker = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]);

  const analyzeRoutes = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTransactions", walletAddress, limit: 50 },
      });
      
      // Parse swap transactions for route data
      const swaps = data?.transactions?.filter((tx: any) => 
        tx.type?.toLowerCase().includes("swap")
      ) || [];
      
      const routeData = swaps.map((tx: any) => ({
        signature: tx.signature,
        timestamp: tx.timestamp,
        type: tx.type,
        description: tx.description,
        program: tx.source || "Unknown",
      }));
      
      setRoutes(routeData);
      toast({ title: "Analysis complete", description: `Found ${routeData.length} swap routes` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to analyze routes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Route className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Jupiter Route Tracker</h3>
          <p className="text-sm text-muted-foreground">Analyze swap routes, slippage settings, and AMMs</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Enter wallet address..."
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
        />
        <Button onClick={analyzeRoutes} disabled={loading}>
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        </Button>
      </div>

      {routes.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{routes.length} Swap Routes Found</p>
          {routes.slice(0, 10).map((route, i) => (
            <div key={i} className="p-3 rounded-lg bg-white/[0.04] flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{route.type}</p>
                <p className="text-xs text-muted-foreground">{route.description?.slice(0, 50)}...</p>
              </div>
              <Badge variant="outline">{route.program}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
