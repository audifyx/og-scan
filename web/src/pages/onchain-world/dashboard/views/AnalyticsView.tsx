import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/pages/onchain-world/dashboard/EmptyState";
import { EventBreakdown } from "@/pages/onchain-world/dashboard/EventBreakdown";
import { formatPct, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import { tokenLabel, tokenTicker } from "../../../../../shared/orbitx-chain-districts.js";

export function AnalyticsView() {
  const rate = useOrbitxStore((s) => s.snapshot.eventRate);
  const tokens = useOrbitxStore((s) => s.city.districts.tokens || []);
  const orbitx = useOrbitxStore((s) => s.city.districts.orbitx);
  const rows = [orbitx, ...tokens].filter(Boolean);

  return (
    <div className="ox-scroll min-h-0 flex-1 overflow-auto p-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <EventBreakdown />
        <section className="ox-panel min-h-48 p-3">
          {rate.length === 0 ? (
            <EmptyState
              icon={<BarChart3 className="size-5" />}
              title="No analytics samples"
              body="Throughput, flow, and cohort charts stay empty until the snapshot is filled."
            />
          ) : (
            <p className="text-xs text-muted">{rate.length} samples loaded.</p>
          )}
        </section>
      </div>

      <section className="ox-panel mt-3 overflow-hidden">
        <header className="border-b border-line px-3 py-2.5">
          <h3 className="ox-kicker text-fg">Markets · 250 trending</h3>
        </header>
        {rows.length === 0 ? (
          <p className="px-3 py-4 text-xs text-dim">No confirmed token districts yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((t) =>
              t ? (
                <li key={t.mint} className="flex items-center gap-3 px-3 py-2">
                  {t.image ? (
                    <img src={t.image} alt="" className="size-7 rounded-full object-cover" />
                  ) : (
                    <span className="size-7 rounded-full bg-bg-hover" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-fg">
                      {tokenLabel(t)}
                    </span>
                    <span className="block truncate text-2xs text-dim">
                      {tokenTicker(t) ? `$${tokenTicker(t)}` : "Solana"}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="ox-stat block text-xs text-fg">{formatUsd(t.market_cap ?? null)}</span>
                    <span className="block text-2xs text-muted">
                      {formatUsd(t.volume_24h ?? null)} · {formatPct(t.change_24h ?? null)}
                    </span>
                  </span>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
