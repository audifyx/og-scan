import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layers, Plus, RefreshCw } from "lucide-react";

export const MultiWalletMerge = () => {
  const [wallets, setWallets] = useState<string[]>([""]);
  const addWallet = () => setWallets([...wallets, ""]);
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-indigo-500/10"><Layers className="h-5 w-5 text-indigo-500" /></div>
        <div><h3 className="font-semibold">Multi-Wallet Merge</h3><p className="text-sm text-muted-foreground">Combine wallet data</p></div>
      </div>
      {wallets.map((w, i) => (
        <Input key={i} placeholder={`Wallet ${i + 1}...`} value={w} onChange={(e) => { const n = [...wallets]; n[i] = e.target.value; setWallets(n); }} className="mb-2" />
      ))}
      <div className="flex gap-2">
        <Button variant="outline" onClick={addWallet} className="flex-1"><Plus className="h-4 w-4 mr-1" />Add Wallet</Button>
        <Button className="flex-1">Merge View</Button>
      </div>
    </Card>
  );
};
