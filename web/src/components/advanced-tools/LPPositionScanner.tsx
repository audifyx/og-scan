import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Layers, RefreshCw, TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatUsd, formatAddress } from "@/lib/solana-api";
import { solanaTracker } from "@/lib/solana-tools";

export const LPPositionScanner = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [positions, setPositions] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState(0);

  const scanPositions = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await solanaTracker("getAssets", { walletAddress });
      const lpTokens = (data?.items || []).filter((item: any) => {
        const name = item.content?.metadata?.name?.toLowerCase() || "";
        return name.includes("lp") || name.includes("pool") || name.includes("liquidity") || name.includes("raydium") || name.includes("meteora") || name.includes("orca");
      });
      const parsed = lpTokens.map((lp: any) => ({
        name: lp.content?.metadata?.name || "LP Token",
        symbol: lp.content?.metadata?.symbol || "LP",
        balance: (lp.token_info?.balance || 0) / Math.pow(10, lp.token_info?.decimals || 0),
        value: lp.token_info?.price_info?.total_price || 0,
        mint: lp.id,
      }));
      setPositions(parsed);
      setTotalValue(parsed.reduce((s: number, p: any) => s + p.value, 0));
      toast({ title: `Found ${lpTokens.length} LP positions` });
    } catch {
      toast({ title: "Error scanning LP positions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/[0.07] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <Layers className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">LP Position Scanner</h3>
          <p className="text-xs text-white/40">Raydium, Meteora, Orca liquidity positions</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Enter wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)}
          className="flex-1 font-mono text-xs bg-white/[0.04] border-white/10" />
        <Button onClick={scanPositions} disabled={loading} className="btn-3d shrink-0 gap-1.5">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
          Scan
        </Button>
      </div>

      {positions.length > 0 ? (
        <>
          <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Total LP Value</p>
              <p className="text-xl font-black text-purple-400">{formatUsd(totalValue)}</p>
            </div>
            <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">{positions.length} positions</Badge>
          </div>

          <div className="space-y-2">
            {positions.map((pos, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-white truncate">{pos.name}</p>
                  <p className="text-xs text-white/40 font-mono">{pos.balance.toFixed(4)} {pos.symbol}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs">{formatUsd(pos.value)}</Badge>
                  <a href={`https://solscan.io/token/${pos.mint}`} target="_blank" rel="noopener noreferrer"
                    className="text-white/20 hover:text-white/60">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : !loading && walletAddress && (
        <div className="text-center py-8 text-white/25">
          <Layers className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No LP positions found</p>
          <p className="text-xs mt-1">This wallet hasn't provided liquidity yet</p>
        </div>
      )}
    </div>
  );
};
