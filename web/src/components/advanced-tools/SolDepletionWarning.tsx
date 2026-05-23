import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Battery, BatteryLow, RefreshCw, AlertTriangle, Plus, Trash2, BatteryFull } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface WalletCheck {
  address: string;
  balance: number | null;
  loading: boolean;
}

export const SolDepletionWarning = () => {
  const [wallets, setWallets] = useState<WalletCheck[]>([{ address: "", balance: null, loading: false }]);
  const [threshold, setThreshold] = useState("0.05");

  const updateAddress = (i: number, val: string) =>
    setWallets((prev) => prev.map((w, idx) => (idx === i ? { ...w, address: val } : w)));

  const addWallet = () => setWallets((prev) => [...prev, { address: "", balance: null, loading: false }]);
  const removeWallet = (i: number) => setWallets((prev) => prev.filter((_, idx) => idx !== i));

  const checkWallet = async (i: number) => {
    const w = wallets[i];
    if (!w.address) return;
    setWallets((prev) => prev.map((x, idx) => (idx === i ? { ...x, loading: true } : x)));
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "getBalance", walletAddress: w.address },
      });
      const bal = data?.balance ?? 0;
      setWallets((prev) => prev.map((x, idx) => (idx === i ? { ...x, balance: bal, loading: false } : x)));
      if (bal < parseFloat(threshold)) {
        toast({ title: "⚠️ Low SOL Balance", description: `${w.address.slice(0, 8)}… has only ${bal.toFixed(4)} SOL`, variant: "destructive" });
      }
    } catch {
      setWallets((prev) => prev.map((x, idx) => (idx === i ? { ...x, loading: false } : x)));
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const checkAll = () => wallets.forEach((_, i) => checkWallet(i));

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <Battery className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">SOL Depletion Warning</h3>
            <p className="text-xs text-white/40">Monitor multiple wallets for low SOL</p>
          </div>
        </div>
        <Button size="sm" onClick={checkAll} className="btn-3d text-xs h-8 px-3 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Check All
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-white/40">Alert threshold:</span>
        <Input
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="w-24 h-7 text-xs text-center bg-white/[0.04] border-white/10"
          placeholder="0.05"
        />
        <span className="text-xs text-white/40">SOL</span>
      </div>

      <div className="space-y-2">
        {wallets.map((w, i) => {
          const thr = parseFloat(threshold) || 0.05;
          const isLow = w.balance !== null && w.balance < thr;
          const isOk = w.balance !== null && !isLow;
          return (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder={`Wallet ${i + 1} address...`}
                value={w.address}
                onChange={(e) => updateAddress(i, e.target.value)}
                className="flex-1 text-xs font-mono h-9 bg-white/[0.04] border-white/10"
              />
              <Button size="sm" variant="outline" onClick={() => checkWallet(i)} disabled={w.loading || !w.address}
                className="h-9 px-3 border-white/10">
                {w.loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Check"}
              </Button>
              {w.balance !== null && (
                <Badge className={`shrink-0 gap-1 text-xs ${isLow ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20"}`}>
                  {isLow ? <BatteryLow className="h-3 w-3" /> : <BatteryFull className="h-3 w-3" />}
                  {w.balance.toFixed(4)}
                </Badge>
              )}
              {wallets.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => removeWallet(i)} className="h-9 w-9 p-0 text-white/20 hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {wallets.length < 8 && (
        <Button variant="ghost" size="sm" onClick={addWallet} className="w-full h-8 text-xs text-white/30 hover:text-white/60 border border-dashed border-white/10 hover:border-white/20 rounded-xl gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Wallet
        </Button>
      )}

      {wallets.some((w) => w.balance !== null) && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {[
            { label: "⚠️ Low", count: wallets.filter((w) => w.balance !== null && w.balance < (parseFloat(threshold) || 0.05)).length, color: "text-red-400" },
            { label: "✅ OK", count: wallets.filter((w) => w.balance !== null && w.balance >= (parseFloat(threshold) || 0.05)).length, color: "text-green-400" },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
              <p className={`text-xl font-black ${s.color}`}>{s.count}</p>
              <p className="text-[10px] text-white/30">{s.label} Wallets</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
