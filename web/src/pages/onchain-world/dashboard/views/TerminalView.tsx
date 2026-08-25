import { Terminal } from "lucide-react";
import { EmptyState } from "@/pages/onchain-world/dashboard/EmptyState";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";

export function TerminalView() {
  const events = useOrbitxStore((s) => s.snapshot.events);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-sunken">
      <div className="border-b border-line px-3 py-1.5 font-mono text-2xs text-dim">
        orbitx@mainnet — idle stream
      </div>
      {events.length === 0 ? (
        <EmptyState
          icon={<Terminal className="size-5" />}
          title="Terminal is quiet"
          body="Decoded instructions will print here as a chronological log once a feeder writes events."
        />
      ) : (
        <pre className="ox-scroll min-h-0 flex-1 overflow-auto p-3 font-mono text-2xs leading-5 text-live">
          {events
            .map((e) => `[${new Date(e.ts).toISOString()}] ${e.kind}  ${e.title}  ${e.detail ?? ""}`)
            .join("\n")}
        </pre>
      )}
    </div>
  );
}
