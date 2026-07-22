// Dependency-light price chart for a curve token, built from the trade ledger.
import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CurveTradeRow } from "@/lib/orbitx/curveData";

export default function CurvePriceChart({ trades, symbol }: { trades: CurveTradeRow[]; symbol?: string }) {
  const data = useMemo(() =>
    trades
      .filter((t) => t.price_x1e18 && t.created_at)
      .map((t) => ({
        t: new Date(t.created_at as string).getTime(),
        price: Number(BigInt(t.price_x1e18 as string)) / 1e18,
      })),
  [trades]);

  if (data.length < 2) {
    return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">Not enough trades yet for a chart.</div>;
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="curvePrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--og-gold))" stopOpacity={0.5} />
              <stop offset="100%" stopColor="hsl(var(--og-gold))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} hide />
          <YAxis dataKey="price" type="number" domain={["auto", "auto"]} width={0} hide />
          <Tooltip
            contentStyle={{ background: "#0b0b0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(v) => new Date(v as number).toLocaleString()}
            formatter={(v: number) => [`${v.toPrecision(6)}`, `${symbol ?? "price"}`]}
          />
          <Area type="monotone" dataKey="price" stroke="hsl(var(--og-gold))" strokeWidth={2} fill="url(#curvePrice)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
