import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const WashTradingScanner = () => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-red-500/10">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h3 className="font-semibold">Wash Trading Scanner</h3>
          <p className="text-sm text-muted-foreground">Detect artificial volume patterns</p>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <Input placeholder="Token address..." value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} />
        <Button disabled={loading}><Search className="h-4 w-4" /></Button>
      </div>
      <div className="p-4 rounded-lg bg-white/[0.04] text-center text-sm text-muted-foreground">
        Analyzes trading patterns to identify wash trading
      </div>
    </Card>
  );
};
