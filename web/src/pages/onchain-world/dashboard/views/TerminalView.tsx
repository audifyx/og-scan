import { useMemo, useState } from "react";
import { Terminal } from "lucide-react";
import { EmptyState } from "@/pages/onchain-world/dashboard/EmptyState";
import { EventKindGlyph } from "@/pages/onchain-world/dashboard/EventKindGlyph";
import { formatAddress, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { ALL_EVENT_KINDS, EVENT_META } from "@/pages/onchain-world/lib/orbitx/constants";
import { isOrbitxChainEvent, toLiveEvent } from "@/pages/onchain-world/lib/mapLive";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import type { EventKind } from "@/pages/onchain-world/lib/orbitx/types";
import { cn } from "@/lib/utils";

export function TerminalView() {
  const raw = useOrbitxStore((s) => s.city.rawEvents);
  const ox = useOrbitxStore((s) => s.city.orbitxEvents);
  const snap = useOrbitxStore((s) => s.snapshot.events);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<EventKind | "all" | "orbitx">("all");
  const lines = useMemo(() => {
    const byId = new Map(snap.map((e) => [e.id, e]));
    for (const ev of [...ox, ...raw]) byId.set(ev.event_id, toLiveEvent(ev));
    const needle = q.trim().toLowerCase();
    return [...byId.values()]
      .sort((a, b) => b.ts - a.ts)
      .filter((e) => {
        if (kind === "orbitx") {
          const src = raw.find((r) => r.event_id === e.id) || ox.find((r) => r.event_id === e.id);
          if (!src || !isOrbitxChainEvent(src)) {
            if (!/orbitx/i.test(`${e.title} ${e.token || ""} ${e.kind}`)) return false;
          }
        } else if (kind !== "all" && e.kind !== kind) return false;
        if (!needle) return true;
        return `${e.title} ${e.token || ""} ${e.wallet || ""} ${e.kind} ${e.amountLabel || ""}`
          .toLowerCase()
          .includes(needle);
      })
      .slice(0, 600);
  }, [raw, ox, snap, q, kind]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#05030c]">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-1.5 font-mono text-2xs text-dim">
        <span>orbitx@mainnet — {lines.length} decoded rows</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter wallet / token / type"
          className="min-w-[10rem] flex-1 rounded-sm border border-line bg-bg-sunken px-2 py-1 text-fg outline-none"
        />
        <span className="text-accent">SHOW ALL</span>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-line px-2 py-1">
        {(["all", "orbitx", ...ALL_EVENT_KINDS] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setKind(id)}
            className={cn(
              "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
              kind === id ? "bg-accent-2/25 text-accent" : "text-dim hover:text-fg",
            )}
          >
            {id === "all" ? "ALL" : id === "orbitx" ? "ORBITX" : EVENT_META[id].short}
          </button>
        ))}
      </div>
      {lines.length === 0 ? (
        <EmptyState
          icon={<Terminal className="size-5" />}
          title="Terminal is quiet"
          body="Decoded Solana instructions print here as they are indexed. Nothing is invented while the feeder is empty."
        />
      ) : (
        <div className="ox-scroll min-h-0 flex-1 overflow-auto p-2 font-mono text-2xs leading-5">
          {lines.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[22px_72px_88px_minmax(0,1fr)_auto] items-center gap-2 border-b border-line/40 px-1 py-1"
            >
              <EventKindGlyph kind={e.kind} className="size-5" />
              <span className="text-dim">{new Date(e.ts).toISOString().slice(11, 19)}</span>
              <span className="text-accent">{EVENT_META[e.kind]?.short || e.kind}</span>
              <span className="truncate text-fg">
                {e.title}
                {e.token ? `  ${e.token}` : ""}
                {e.amountLabel ? `  ${e.amountLabel}` : ""}
              </span>
              <span className="text-muted">
                {formatUsd(e.usd ?? null)}
                {e.wallet ? `  ${formatAddress(e.wallet)}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
