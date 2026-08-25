import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/pages/onchain-world/dashboard/EmptyState";
import { EventBreakdown } from "@/pages/onchain-world/dashboard/EventBreakdown";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";

export function AnalyticsView() {
  const rate = useOrbitxStore((s) => s.snapshot.eventRate);

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
    </div>
  );
}
