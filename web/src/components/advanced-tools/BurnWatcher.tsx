import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Flame, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatAddress } from "@/lib/solana-api";
import { solanaTracker } from "@/lib/solana-tools";

const BURN_ADDRS = [
  "1nc1nerator11111111111111111111111111111111",
  "11111111111111111111111111111111",
  "burnXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
];

export const BurnWatcher = () => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const watch = async () => {
    if (!tokenAddress) return;
    setLoading(true);
    try {
      const { data } = await solanaTracker("getTokenHolders", { tokenAddress });
      const holders = data?.holders || [];
      const burns = holders.filter((h: any) =>
        BURN_ADDRS.some((b) => h.address?.includes("111111")) ||
        h.address?.toLowerCase() === "1nc1nerator11111111111111111111111111111111"
      );
      const burnPct = burns.reduce((s: number, b: any) => s + (b.percentage || 0), 0);
      setResult({
        burns,
        burnPct,
        totalHolders: data?.totalHolders || holders.length,
        isBurned: burnPct > 0,
      });
      toast({ title: "Burn analysis complete" });
    } catch {
      toast({ title: "Error watching burns", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <Flame className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">Burn Watcher</h3>
          <p className="text-xs text-white/40">Track token burns sent to null/incinerator addresses</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter token address..." value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={watch} disabled={loading} className="btn-3d shrink-0 gap-1.5">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
          Watch
        </Button>
      </div>

      {result ? (
        <div className="space-y-3">
          <div className={`p-3 rounded-xl border flex items-center justify-between ${result.isBurned ? "bg-orange-500/10 border-orange-500/20" : "bg-white/[0.03] border-white/[0.06]"}`}>
            <div className="flex items-center gap-2">
              <Flame className={`h-4 w-4 ${result.isBurned ? "text-orange-400" : "text-white/20"}`} />
              <span className={`font-bold ${result.isBurned ? "text-orange-400" : "text-white/30"}`}>
                {result.isBurned ? "Burn Activity Detected" : "No Burns Found"}
              </span>
            </div>
            <Badge className={result.isBurned ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-white/[0.04] text-white/30 border-white/[0.08]"}>
              {result.burnPct.toFixed(2)}% burned
            </Badge>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <p className="text-xs text-white/40 mb-1">How Burns Work</p>
            <p className="text-xs text-white/25 leading-relaxed">
              Burned tokens are transferred to the null address (<code className="text-white/30">1nc1nerator…</code>) or the incinerator program and permanently removed from circulation, reducing total supply and potentially increasing scarcity.
            </p>
          </div>

          {result.burns.length > 0 && (
            <div className="space-y-2">
              {result.burns.map((b: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-orange-500/5 border border-orange-500/10">
                  <div>
                    <p className="text-xs font-mono text-white/50">{formatAddress(b.address, 8)}</p>
                    <p className="text-[10px] text-white/25">{b.amount?.toLocaleString()} tokens</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[10px]">{b.percentage?.toFixed(2)}%</Badge>
                    <a href={`https://solscan.io/account/${b.address}`} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-white/50">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <p className="text-xs text-white/30 text-center">Enter a token address to check for burn events</p>
        </div>
      )}
    </div>
  );
};
