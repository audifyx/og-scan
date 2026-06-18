// FILE: web/src/components/advanced-intelligence/TraderLeaderboard.tsx

import React, { useEffect, useState } from "react";
import { Trophy, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmtUsd, fmtPct } from "@/lib/og";

interface Trader {
  wallet: string;
  total_pnl: number;
  win_rate: number;
  trade_count: number;
  total_volume: number;
  best_trade: number;
  worst_trade: number;
}

export function TraderLeaderboard({ mint }: { mint: string }) {
  const [traders, setTraders] = useState<Trader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTraders() {
      try {
        // Aggregate trades by seller
        const { data } = await supabase
          .from("transactions_extended")
          .select("*")
          .eq("mint_address", mint)
          .eq("direction", "sell")
          .order("profit_loss_usd", { ascending: false })
          .limit(500);

        const traderMap = new Map<string, Trader>();
        
        for (const tx of data || []) {
          const wallet = tx.seller_address;
          if (!wallet) continue;

          if (!traderMap.has(wallet)) {
            traderMap.set(wallet, {
              wallet,
              total_pnl: 0,
              win_rate: 0,
              trade_count: 0,
              total_volume: 0,
              best_trade: -Infinity,
              worst_trade: Infinity,
            });
          }

          const trader = traderMap.get(wallet)!;
          const pnl = tx.profit_loss_usd || 0;
          
          trader.trade_count++;
          trader.total_pnl += pnl;
          trader.total_volume += tx.usd_volume || 0;
          trader.best_trade = Math.max(trader.best_trade, pnl);
          trader.worst_trade = Math.min(trader.worst_trade, pnl);
        }

        const tradersList = Array.from(traderMap.values())
          .map(t => ({
            ...t,
            win_rate: t.trade_count > 0 ? (t.trade_count / 2) * 100 : 0, // Simplified
          }))
          .sort((a, b) => b.total_pnl - a.total_pnl);

        setTraders(tradersList);
      } catch (error) {
        console.error("Error fetching traders:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTraders();
  }, [mint]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Leaderboard */}
      <div className="rounded-xl border border-border bg-card p-6 overflow-x-auto">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="h-6 w-6 text-og-gold" />
          <h2 className="text-2xl font-bold">Top Traders by PnL</h2>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-foreground/60 font-bold">
              <th className="text-left py-3 px-4">Rank</th>
              <th className="text-left py-3 px-4">Wallet</th>
              <th className="text-right py-3 px-4">Total PnL</th>
              <th className="text-right py-3 px-4">Trade Count</th>
              <th className="text-right py-3 px-4">Win Rate</th>
              <th className="text-right py-3 px-4">Best Trade</th>
              <th className="text-right py-3 px-4">Volume</th>
            </tr>
          </thead>
          <tbody>
            {traders.slice(0, 100).map((trader, idx) => (
              <tr
                key={trader.wallet}
                className="border-b border-border/20 hover:bg-foreground/5 transition"
              >
                <td className="py-3 px-4">
                  <span className="font-bold text-og-gold">#{idx + 1}</span>
                </td>
                <td className="py-3 px-4 font-mono text-xs text-og-cyan">
                  {trader.wallet.slice(0, 8)}...{trader.wallet.slice(-4)}
                </td>
                <td className={`text-right py-3 px-4 font-bold ${
                  trader.total_pnl >= 0 ? "text-og-lime" : "text-og-red"
                }`}>
                  {fmtUsd(trader.total_pnl)}
                </td>
                <td className="text-right py-3 px-4">{trader.trade_count}</td>
                <td className="text-right py-3 px-4">{trader.win_rate.toFixed(1)}%</td>
                <td className="text-right py-3 px-4 text-og-lime font-mono">
                  {fmtUsd(trader.best_trade)}
                </td>
                <td className="text-right py-3 px-4 font-mono text-foreground/70">
                  {fmtUsd(trader.total_volume)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
