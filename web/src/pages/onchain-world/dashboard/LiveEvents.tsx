import { Filter, Radio } from "lucide-react";
import { EventKindGlyph } from "@/pages/onchain-world/dashboard/EventKindGlyph";
import { EmptyState } from "@/pages/onchain-world/dashboard/EmptyState";
import { Badge } from "@/pages/onchain-world/dashboard/ui/badge";
import { Button } from "@/pages/onchain-world/dashboard/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/pages/onchain-world/dashboard/ui/popover";
import { ALL_EVENT_KINDS, EVENT_META } from "@/pages/onchain-world/lib/orbitx/constants";
import { formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import type { EventKind } from "@/pages/onchain-world/lib/orbitx/types";
import { cn } from "@/lib/utils";

function relative(ts: number): string {
  const delta = Math.max(0, Date.now() - ts);
  if (delta < 1000) return "now";
  if (delta < 60_000) return `${Math.round(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m ago`;
  return `${Math.round(delta / 3_600_000)}h ago`;
}

export function LiveEvents() {
  const events = useOrbitxStore((s) => s.snapshot.events);
  const filters = useOrbitxStore((s) => s.eventFilters);
  const toggleFilter = useOrbitxStore((s) => s.toggleFilter);
  const resetFilters = useOrbitxStore((s) => s.resetFilters);
  const liveReason = useOrbitxStore((s) => s.snapshot.network.liveReason);

  const visible = events.filter((e) => filters.includes(e.kind));

  return (
    <section className="ox-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <h2 className="ox-kicker text-fg">Live events</h2>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="xs">
              <Filter className="size-3" />
              Filters
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <div className="mb-2 flex items-center justify-between">
              <p className="ox-kicker">Event types</p>
              <button
                type="button"
                className="text-2xs text-muted hover:text-fg"
                onClick={resetFilters}
              >
                Reset
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {ALL_EVENT_KINDS.map((kind) => {
                const on = filters.includes(kind);
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => toggleFilter(kind)}
                    className={cn(
                      "flex items-center gap-2 rounded-sm px-1.5 py-1 text-left text-xs transition-[background-color,color] duration-150",
                      on ? "bg-bg-hover text-fg" : "text-dim hover:text-muted",
                    )}
                  >
                    <EventKindGlyph kind={kind} className="size-6" />
                    {EVENT_META[kind].label}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </header>

      <div className="ox-scroll min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <EmptyState
            icon={<Radio className="size-5" />}
            title="No live events"
            body={liveReason || "The stream is idle. Wire a Solana feed into the store to populate this panel."}
          />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function EventRow({
  event,
}: {
  event: {
    id: string;
    kind: EventKind;
    title: string;
    token?: string;
    amountLabel?: string;
    usd?: number | null;
    detail?: string;
    ts: number;
  };
}) {
  const meta = EVENT_META[event.kind];
  return (
    <li className="flex items-start gap-2.5 px-3 py-2.5">
      <EventKindGlyph kind={event.kind} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold tracking-wide text-fg">
                {meta.label}
              </span>
              {event.token ? (
                <span className="text-xs font-medium text-muted">{event.token}</span>
              ) : null}
            </div>
            {event.detail ? (
              <p className="mt-0.5 truncate text-2xs text-dim">{event.detail}</p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            {event.usd != null ? (
              <p className="ox-stat text-xs text-fg">{formatUsd(event.usd)}</p>
            ) : event.amountLabel ? (
              <p className="ox-stat text-xs text-fg">{event.amountLabel}</p>
            ) : null}
            <p className="text-2xs text-dim">{relative(event.ts)}</p>
          </div>
        </div>
        {event.amountLabel && event.usd != null ? (
          <p className="mt-0.5 ox-stat text-2xs text-muted">{event.amountLabel}</p>
        ) : null}
      </div>
      <Badge tone={meta.tone} className="mt-0.5 hidden xl:inline-flex">
        {meta.short}
      </Badge>
    </li>
  );
}
