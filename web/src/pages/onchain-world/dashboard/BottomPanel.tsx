import { Activity, X } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EventKindGlyph } from "@/pages/onchain-world/dashboard/EventKindGlyph";
import { EmptyState } from "@/pages/onchain-world/dashboard/EmptyState";
import { Button } from "@/pages/onchain-world/dashboard/ui/button";
import { EVENT_META } from "@/pages/onchain-world/lib/orbitx/constants";
import { formatAddress, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import type { BottomTab, EventKind } from "@/pages/onchain-world/lib/orbitx/types";
import { cn } from "@/lib/utils";

const TABS: { id: BottomTab; label: string }[] = [
  { id: "recent", label: "Recent transactions" },
  { id: "orbitx_activity", label: "OrbitX activity" },
  { id: "whale", label: "Whale movements" },
  { id: "kol", label: "KOL activity" },
];

const KIND_MATCH: Record<BottomTab, EventKind[] | null> = {
  recent: null,
  orbitx_activity: ["orbitx_buy", "orbitx_burn"],
  whale: ["whale_sell"],
  kol: ["kol_buy"],
  wallets: null,
};

export function BottomPanel() {
  const tab = useOrbitxStore((s) => s.bottomTab);
  const setTab = useOrbitxStore((s) => s.setBottomTab);
  const rows = useOrbitxStore((s) => s.snapshot.transactions);
  const rate = useOrbitxStore((s) => s.snapshot.eventRate);
  const last = useOrbitxStore((s) => s.snapshot.ticker.eventsPerSec);
  const match = KIND_MATCH[tab];
  const selectedWallet = useOrbitxStore((s) => s.selectedWallet);
  const visible = rows.filter((r) => {
    if (match && !match.includes(r.kind)) return false;
    if (tab === "wallets" && selectedWallet) {
      return r.wallet === selectedWallet;
    }
    return true;
  });
  const chartData =
    rate.length > 0 ? rate : [{ t: "—", v: 0 }, { t: "—", v: 0 }];

  return (
    <div className="grid min-h-0 grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.7fr)]">
      <section className="ox-panel flex min-h-0 flex-col overflow-hidden">
        <header className="flex items-center gap-1 overflow-x-auto border-b border-line px-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "shrink-0 border-b-2 px-2.5 py-2 text-2xs font-semibold tracking-wider uppercase transition-[color,border-color] duration-150",
                tab === item.id
                  ? "border-accent text-fg"
                  : "border-transparent text-dim hover:text-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </header>
        <div className="ox-scroll min-h-40 flex-1 overflow-auto">
          {visible.length === 0 ? (
            <EmptyState
              icon={<Activity className="size-5" />}
              title="No transactions"
              body="No indexed rows in this layer yet."
              className="min-h-28 py-4"
            />
          ) : (
            <table className="w-full min-w-[44rem] text-left text-2xs">
              <thead className="sticky top-0 bg-bg-panel text-dim">
                <tr className="border-b border-line">
                  {["Time", "Type", "Wallet", "Token / Action", "Amount", "Value (USD)", "Tx"].map(
                    (h) => (
                      <th key={h} className="px-3 py-2 font-medium tracking-wide">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-line/70 hover:bg-bg-hover"
                    onClick={() => {
                      if (row.wallet) {
                        useOrbitxStore.getState().trackWallet(row.wallet);
                        useOrbitxStore.getState().setFollowId(row.id);
                      }
                    }}
                  >
                    <td className="ox-stat px-3 py-2 text-muted">{row.time}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <EventKindGlyph kind={row.kind} className="size-5" />
                        {EVENT_META[row.kind].label}
                      </span>
                    </td>
                    <td className="ox-stat px-3 py-2 text-fg">{formatAddress(row.wallet)}</td>
                    <td className="px-3 py-2 text-muted">{row.token}</td>
                    <td className="ox-stat px-3 py-2 text-fg">{row.amount}</td>
                    <td className="ox-stat px-3 py-2 text-fg">{formatUsd(row.usd)}</td>
                    <td className="ox-stat px-3 py-2 text-dim">{formatAddress(row.signature)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="ox-panel flex min-h-0 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-line px-3 py-2">
          <h2 className="ox-kicker text-fg">Events / second (live)</h2>
          <Button variant="ghost" size="icon-xs" aria-label="Close chart" tabIndex={-1} disabled>
            <X className="size-3.5" />
          </Button>
        </header>
        <div className="relative min-h-40 flex-1 px-1 pb-1 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="oxRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent-2)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-accent-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                tick={{ fill: "var(--color-dim)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--color-dim)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={28}
                domain={[0, "auto"]}
              />
              <RechartsTooltip
                contentStyle={{
                  background: "var(--color-bg-raised)",
                  border: "1px solid var(--color-line)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--color-accent)"
                fill="url(#oxRate)"
                strokeWidth={1.6}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
          {rate.length === 0 ? (
            <div className="pointer-events-none absolute right-3 top-2 ox-stat text-xs text-dim">
              {last ?? 0}
            </div>
          ) : (
            <div className="pointer-events-none absolute right-3 top-2 rounded-sm bg-live/15 px-1.5 py-0.5 ox-stat text-xs text-live">
              {last ?? 0}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
