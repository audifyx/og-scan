
import React, { useEffect, useState } from "react";
import { Flame, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmtUsd, fmtPct } from "@/lib/og";

export function WhaleRiskAnalysis({ mint }: { mint: string }) {
  const [whales, setWhales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskMetrics, setRiskMetrics] = useState({
    totalWhalePower: 0,
    criticalWallets: 0,
    dumpProbability: 0,
  });

  useEffect(() => {
    async function fetchWhaleData() {
      try {
        const { data } = await supabase
          .from("holder_snapshots")
          .select("*")
          .eq("mint_address", mint)
          .gt("balance_percent_of_supply", 1)
          .order("balance_usd", { ascending: false })
          .limit(50);

        setWhales(data || []);

        const criticalWallets = (data || []).filter(w => w.unrealized_pnl_percent > 100).length;
        const totalWhalePower = (data || []).reduce((sum, w) => sum + w.balance_percent_of_supply, 0);

        setRiskMetrics({
          totalWhalePower,
          criticalWallets,
          dumpProbability: Math.min(100, criticalWallets * 20 + (totalWhalePower / 10)),
        });
      } catch (error) {
        console.error("Error fetching whale data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchWhaleData();
  }, [mint]);

  if (loading) return <div className="flex h-64 items-center justify-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RiskCard
          label="Total Whale Power"
          value={riskMetrics.totalWhalePower.toFixed(1) + "%"}
          icon="🐋"
          color="text-og-cyan"
        />
        <RiskCard
          label="Critical Risk Wallets"
          value={riskMetrics.criticalWallets}
          icon="⚠️"
          color="text-og-gold"
        />
        <RiskCard
          label="Dump Probability"
          value={riskMetrics.dumpProbability.toFixed(0) + "%"}
          icon="🔥"
          color="text-og-red"
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 overflow-x-auto">
        <h3 className="font-bold text-lg mb-4">Top Whales (>1% holdings)</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-foreground/60 font-bold">
              <th className="text-left py-3 px-4">Wallet</th>
              <th className="text-right py-3 px-4">Balance USD</th>
              <th className="text-right py-3 px-4">% of Supply</th>
              <th className="text-right py-3 px-4">Unrealized PnL</th>
              <th className="text-center py-3 px-4">Dump Risk</th>
            </tr>
          </thead>
          <tbody>
            {whales.map((whale) => (
              <tr key={whale.wallet_address} className="border-b border-border/20 hover:bg-foreground/5">
                <td className="py-3 px-4 font-mono text-xs text-og-cyan">
                  {whale.wallet_address.slice(0, 8)}...{whale.wallet_address.slice(-4)}
                </td>
                <td className="text-right py-3 px-4 font-mono">{fmtUsd(whale.balance_usd)}</td>
                <td className="text-right py-3 px-4 font-mono">{fmtPct(whale.balance_percent_of_supply)}</td>
                <td className={`text-right py-3 px-4 font-mono ${
                  whale.unrealized_pnl_usd >= 0 ? "text-og-lime" : "text-og-red"
                }`}>
                  {fmtUsd(whale.unrealized_pnl_usd)}
                </td>
                <td className="text-center py-3 px-4">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                    whale.unrealized_pnl_percent > 100 ? "bg-og-red/15 text-og-red" :
                    whale.unrealized_pnl_percent > 50 ? "bg-og-gold/15 text-og-gold" :
                    "bg-og-lime/15 text-og-lime"
                  }`}>
                    {whale.unrealized_pnl_percent > 100 ? "CRITICAL" :
                     whale.unrealized_pnl_percent > 50 ? "HIGH" : "MODERATE"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RiskCard({ label, value, icon, color }: any) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-foreground/60 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  );
}
