import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import type { BreakdownKey } from "@/pages/onchain-world/lib/orbitx/types";
import { cn } from "@/lib/utils";

const SLICE: Record<BreakdownKey, string> = {
  buy: "var(--color-slice-buy)",
  transfer: "var(--color-slice-transfer)",
  sell: "var(--color-slice-sell)",
  orbitx: "var(--color-slice-orbitx)",
  burn: "var(--color-slice-burn)",
  other: "var(--color-slice-other)",
};

const DOT: Record<BreakdownKey, string> = {
  buy: "bg-slice-buy",
  transfer: "bg-slice-transfer",
  sell: "bg-slice-sell",
  orbitx: "bg-slice-orbitx",
  burn: "bg-slice-burn",
  other: "bg-slice-other",
};

export function EventBreakdown() {
  const breakdown = useOrbitxStore((s) => s.snapshot.breakdown);
  const total = breakdown.reduce((sum, s) => sum + s.pct, 0);
  const chartData =
    total > 0
      ? breakdown.map((s) => ({ ...s, value: Math.max(s.pct, 0) }))
      : [{ key: "other" as const, label: "EMPTY", pct: 0, value: 1 }];

  return (
    <section className="ox-panel shrink-0 p-3">
      <h2 className="ox-kicker mb-2 text-fg">Event breakdown</h2>
      <div className="flex items-center gap-3">
        <div className="relative size-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                innerRadius={28}
                outerRadius={42}
                stroke="none"
                paddingAngle={total > 0 ? 2 : 0}
              >
                {chartData.map((slice) => (
                  <Cell
                    key={slice.key}
                    fill={total > 0 ? SLICE[slice.key] : "var(--color-faint)"}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-1.5">
          {breakdown.map((slice) => (
            <li key={slice.key} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={cn("size-1.5 shrink-0 rounded-full", DOT[slice.key])} />
                <span className="truncate text-2xs text-muted">{slice.label}</span>
              </span>
              <span className="ox-stat text-2xs text-fg">
                {slice.pct.toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
