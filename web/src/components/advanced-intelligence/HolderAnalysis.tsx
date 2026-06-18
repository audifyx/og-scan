// FILE: web/src/components/advanced-intelligence/HolderAnalysis.tsx

import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmtUsd, fmtPct } from "@/lib/og";

interface Holder {
  wallet: string;
  balance_usd: number;
  unrealized_pnl_usd: number;
  unrealized_pnl_percent: number;
  realized_pnl_usd: number;
  total_pnl_usd: number;
  avg_entry_price: number;
  buy_count: number;
  sell_count: number;
  holding_duration_days: number;
  classification: string;
}

export function HolderAnalysis({ mint }: { mint: string }) {
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalHolders: 0,
    diamondHands: 0,
    swingTraders: 0,
    bagHolders: 0,
  });

  useEffect(() => {
    async function fetchHolders() {
      try {
        const { data, error } = await supabase
          .from("holder_snapshots")
          .select("*")
          .eq("mint_address", mint)
          .order("balance_usd", { ascending: false })
          .limit(100);

        if (error) throw error;

        setHolders(data || []);

        // Calculate stats
        const diamondHands = (data || []).filter(h => h.classification === "diamond_hand").length;
        const swingTraders = (data || []).filter(h => h.classification === "swing_trader").length;
        const bagHolders = (data || []).filter(h => h.classification === "bag_holder").length;

        setStats({
          totalHolders: data?.length || 0,
          diamondHands,
          swingTraders,
          bagHolders,
        });
      } catch (error) {
        console.error("Error fetching holders:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchHolders();
  }, [mint]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin">
          <Zap className="h-8 w-8 text-og-cyan" />
        </div>
      </div>
    );
  }

  const pnlData = holders.slice(0, 20).map((h) => ({
    wallet: h.wallet.slice(0, 4) + "..." + h.wallet.slice(-4),
    pnl: h.total_pnl_usd,
    realized: h.realized_pnl_usd,
  }));

  const classificationData = [
    { name: "Diamond Hands", value: stats.diamondHands },
    { name: "Swing Traders", value: stats.swingTraders },
    { name: "Bag Holders", value: stats.bagHolders },
    { name: "Other", value: stats.totalHolders - stats.diamondHands - stats.swingTraders - stats.bagHolders },
  ];

  const COLORS = ["#38C4DC", "#F8BE70", "#F85A5A", "#6B7280"];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Holders"
          value={stats.totalHolders}
          change={0}
          icon="👥"
        />
        <StatCard
          label="Diamond Hands"
          value={stats.diamondHands}
          change={((stats.diamondHands / stats.totalHolders) * 100).toFixed(1) + "%"}
          icon="💎"
        />
        <StatCard
          label="Swing Traders"
          value={stats.swingTraders}
          change={((stats.swingTraders / stats.totalHolders) * 100).toFixed(1) + "%"}
          icon="📈"
        />
        <StatCard
          label="Bag Holders"
          value={stats.bagHolders}
          change={((stats.bagHolders / stats.totalHolders) * 100).toFixed(1) + "%"}
          icon="🎒"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PnL Distribution */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-bold text-lg mb-4">Top 20 Holders PnL</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pnlData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#404050" />
              <XAxis dataKey="wallet" stroke="#888" fontSize={12} />
              <YAxis stroke="#888" fontSize={12} />
              <Tooltip
                formatter={(value) => fmtUsd(Number(value))}
                contentStyle={{ backgroundColor: "#0F0F14", border: "1px solid #404050" }}
              />
              <Bar dataKey="pnl" fill="#38C4DC" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Classification Breakdown */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-bold text-lg mb-4">Holder Classification</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={classificationData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {classificationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Holder Table */}
      <div className="rounded-xl border border-border bg-card p-6 overflow-x-auto">
        <h3 className="font-bold text-lg mb-4">Top 50 Holders</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-foreground/60 font-bold">
              <th className="text-left py-3 px-4">Wallet</th>
              <th className="text-right py-3 px-4">Balance USD</th>
              <th className="text-right py-3 px-4">Entry Price</th>
              <th className="text-right py-3 px-4">Unrealized PnL</th>
              <th className="text-right py-3 px-4">Realized PnL</th>
              <th className="text-right py-3 px-4">Total PnL %</th>
              <th className="text-center py-3 px-4">Classification</th>
              <th className="text-center py-3 px-4">Buys/Sells</th>
            </tr>
          </thead>
          <tbody>
            {holders.slice(0, 50).map((holder, idx) => (
              <tr
                key={holder.wallet}
                className="border-b border-border/20 hover:bg-foreground/5 transition"
              >
                <td className="py-3 px-4 font-mono text-xs text-og-cyan">
                  {holder.wallet.slice(0, 8)}...{holder.wallet.slice(-4)}
                </td>
                <td className="text-right py-3 px-4 font-mono">
                  {fmtUsd(holder.balance_usd)}
                </td>
                <td className="text-right py-3 px-4 font-mono">
                  ${holder.avg_entry_price?.toFixed(6)}
                </td>
                <td className={`text-right py-3 px-4 font-mono ${
                  holder.unrealized_pnl_usd >= 0 ? "text-og-lime" : "text-og-red"
                }`}>
                  {fmtUsd(holder.unrealized_pnl_usd)}
                </td>
                <td className={`text-right py-3 px-4 font-mono ${
                  holder.realized_pnl_usd >= 0 ? "text-og-lime" : "text-og-red"
                }`}>
                  {fmtUsd(holder.realized_pnl_usd)}
                </td>
                <td className={`text-right py-3 px-4 font-mono ${
                  holder.unrealized_pnl_percent >= 0 ? "text-og-lime" : "text-og-red"
                }`}>
                  {fmtPct(holder.unrealized_pnl_percent)}
                </td>
                <td className="text-center py-3 px-4">
                  <span className="inline-block px-2 py-1 rounded-full text-xs font-bold bg-og-cyan/15 text-og-cyan">
                    {holder.classification || "Unknown"}
                  </span>
                </td>
                <td className="text-center py-3 px-4 text-foreground/70">
                  {holder.buy_count}/{holder.sell_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  change,
  icon,
}: {
  label: string;
  value: number | string;
  change: number | string;
  icon: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-foreground/60">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-foreground/50 mt-1">
        {typeof change === "number" ? `${change > 0 ? "+" : ""}${change}%` : change}
      </p>
    </div>
  );
}
