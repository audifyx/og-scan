import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Flame, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatAddress } from "@/lib/solana-api";

export const BurnWatcher = () => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [burnEvents, setBurnEvents] = useState<any[]>([]);

  const watchBurns = async () => {
    if (!tokenAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getTokenHolders", tokenAddress },
      });

      // Look for burn address holdings
      const burnAddresses = ["1nc1nerator11111111111111111111111111111111"];
      const burns = data?.holders?.filter((h: any) => 
        burnAddresses.some(b => h.address?.toLowerCase().includes("111111"))
      ) || [];

      setBurnEvents(burns);
      toast({ title: "Burn analysis complete" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-orange-500/10">
          <Flame className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <h3 className="font-semibold">Burn Watcher</h3>
          <p className="text-sm text-muted-foreground">Track token burn events</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Enter token address..."
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
        />
        <Button onClick={watchBurns} disabled={loading} className="bg-orange-500 hover:bg-orange-600">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Watch"}
        </Button>
      </div>

      <div className="p-4 rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground">
          Monitor token burn events. Burned tokens are sent to null addresses and permanently removed from circulation.
        </p>
      </div>

      {burnEvents.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">Burn Events Detected</p>
          {burnEvents.map((event, i) => (
            <div key={i} className="p-3 rounded-lg bg-orange-500/10 flex items-center justify-between">
              <div>
                <p className="text-sm font-mono">{formatAddress(event.address, 8)}</p>
                <p className="text-xs text-muted-foreground">{event.amount?.toLocaleString()} tokens</p>
              </div>
              <Badge variant="outline" className="text-orange-500">Burned</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
