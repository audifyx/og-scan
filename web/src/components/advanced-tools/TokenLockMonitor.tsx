import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Unlock, RefreshCw } from "lucide-react";

export const TokenLockMonitor = () => {
  const [tokenAddress, setTokenAddress] = useState("");
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-blue-500/10"><Lock className="h-5 w-5 text-blue-500" /></div>
        <div><h3 className="font-semibold">Token Lock Monitor</h3><p className="text-sm text-muted-foreground">Track lock/unlock events</p></div>
      </div>
      <div className="flex gap-2 mb-4">
        <Input placeholder="Token address..." value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} />
        <Button><RefreshCw className="h-4 w-4" /></Button>
      </div>
      <div className="p-4 rounded-lg bg-muted/30 text-center text-sm text-muted-foreground">Monitor token vesting schedules</div>
    </Card>
  );
};
