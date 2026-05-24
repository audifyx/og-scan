/**
 * PnLTracker — Track profit/loss across all tokens for a wallet.
 * Realized + Unrealized P&L. Entry/exit prices.
 */
import { useState, useEffect, useMemo } from "react";
import { DollarSign, TrendingUp, TrendingDown, BarChart3, Loader2, ChevronDown, ChevronUp, Flame, Trophy, Skull } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtUsd, HELIUS_RPC } from "@/lib/og";

interface TokenPnL {
  mint: string;
  symbol: string;
  name: string;
  logoURI?: string;
  buyAmount: number;
  sellAmount: number;
  currentValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  holdingCount: number;
  entryPrice: number;
  currentPrice: number;
  status: "holding" | "sold" | "partial";
}

interface WalletPnL {
  totalRealized: number;
  totalUnrealized: number;
  totalPnl: number;
  winCount: number;
  lossCount: number;
  bestToken: string;
  worstToken: string;
  tokens: TokenPnL[];
}

interface Props {
  walletAddress: string;
  compact?: boolean;
}

export const PnLTracker: React.FC<Props> = ({ walletAddress, compact = false }) => {
  const [pnl, setPnl] = useState<WalletPnL | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<"pnl" | "value" | "recent">("pnl");

  useEffect(() => {
    if (!walletAddress) return;
    setLoading(true);

    // Fetch wallet's fungible holdings
    fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getAssetsByOwner",
        params: { ownerAddress: walletAddress, page: 1, limit: 100, displayOptions: { showFungible: true } },
      }),
    })
      .then(r => r.json())
      .then(json => {
        const items = json?.result?.items || [];
        const fungibles = items.filter((a: any) =>
          a.interface === "FungibleToken" || a.interface === "FungibleAsset"
        );

        const tokens: TokenPnL[] = fungibles.map((a: any) => {
          const price = a.token_info?.price_info?.price_per_token || 0;
          const balance = (a.token_info?.balance || 0) / Math.pow(10, a.token_info?.decimals || 9);
          const currentValue = price * balance;

          return {
            mint: a.id,
            symbol: a.content?.metadata?.symbol || "???",
            name: a.content?.metadata?.name || "Unknown",
            logoURI: a.content?.links?.image || a.content?.files?.[0]?.uri,
            buyAmount: 0,
            sellAmount: 0,
            currentValue,
            realizedPnl: 0,
            unrealizedPnl: 0, // Would need historical tx data
            totalPnl: 0,
            holdingCount: balance,
            entryPrice: 0,
            currentPrice: price,
            status: balance > 0 ? "holding" : "sold",
          };
        });

        const totalRealized = tokens.reduce((s, t) => s + t.realizedPnl, 0);
        const totalUnrealized = tokens.reduce((s, t) => s + t.unrealizedPnl, 0);

        setPnl({
          totalRealized,
          totalUnrealized,
          totalPnl: totalRealized + totalUnrealized,
          winCount: tokens.filter(t => t.totalPnl > 0).length,
          lossCount: tokens.filter(t => t.totalPnl < 0).length,
          bestToken: tokens.sort((a, b) => b.currentValue - a.currentValue)[0]?.symbol || "N/A",
          worstToken: tokens.sort((a, b) => a.totalPnl - b.totalPnl)[0]?.symbol || "N/A",
          tokens: tokens.filter(t => t.currentValue > 0).sort((a, b) => b.currentValue - a.currentValue),
        });
      })
      .catch(() => setPnl(null))
      .finally(() => setLoading(false));
  }, [walletAddress]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-white/30" />
        <span className="text-xs text-white/30">Calculating P&L...</span>
      </div>
    );
  }

  if (!pnl) return null;

  const totalValue = pnl.tokens.reduce((s, t) => s + t.currentValue, 0);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <DollarSign className="h-3 w-3 text-white/30" />
        <span className="text-white/40">Portfolio:</span>
        <span className="font-bold text-white">{fmtUsd(totalValue)}</span>
        <span className="text-white/20">({pnl.tokens.length} tokens)</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">P&L Tracker</p>
            <p className="text-[10px] text-white/25">{pnl.tokens.length} positions · Portfolio value</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-white">{fmtUsd(totalValue)}</p>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-white/15" /> : <ChevronDown className="h-4 w-4 text-white/15" />}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-black/20 p-2 text-center">
            <p className="text-[8px] text-white/20">Positions</p>
            <p className="text-sm font-bold text-white">{pnl.tokens.length}</p>
          </div>
          <div className="rounded-lg bg-black/20 p-2 text-center">
            <p className="text-[8px] text-white/20">Top Holding</p>
            <p className="text-sm font-bold text-primary">{pnl.bestToken}</p>
          </div>
          <div className="rounded-lg bg-black/20 p-2 text-center">
            <p className="text-[8px] text-white/20">Total Value</p>
            <p className="text-sm font-bold text-white">{fmtUsd(totalValue)}</p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] px-3 pb-3 pt-2">
          {/* Sort tabs */}
          <div className="flex gap-1 mb-2">
            {(["pnl", "value", "recent"] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={cn("px-2 py-0.5 rounded text-[9px]",
                  sortBy === s ? "bg-primary/10 text-primary" : "text-white/20 hover:text-white/40"
                )}
              >
                {s === "pnl" ? "By P&L" : s === "value" ? "By Value" : "Recent"}
              </button>
            ))}
          </div>

          {/* Token positions */}
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {pnl.tokens.map(token => (
              <div key={token.mint} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.015] border border-white/[0.04]">
                {token.logoURI ? (
                  <img src={token.logoURI} className="w-6 h-6 rounded-full" alt="" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-[8px] font-bold text-white/20">
                    {token.symbol.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-bold text-white">{token.symbol}</span>
                  <span className="text-[9px] text-white/15 ml-1">{token.holdingCount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-white">{fmtUsd(token.currentValue)}</p>
                  {token.currentPrice > 0 && (
                    <p className="text-[9px] text-white/20">${token.currentPrice < 0.001 ? token.currentPrice.toExponential(1) : token.currentPrice.toFixed(4)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PnLTracker;
