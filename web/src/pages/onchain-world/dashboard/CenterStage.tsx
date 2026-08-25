import { Maximize2, Settings2 } from "lucide-react";
import { WorldView } from "@/pages/onchain-world/dashboard/WorldView";
import { AnalyticsView } from "@/pages/onchain-world/dashboard/views/AnalyticsView";
import { MapView } from "@/pages/onchain-world/dashboard/views/MapView";
import { OrbitxTokenView } from "@/pages/onchain-world/dashboard/views/OrbitxTokenView";
import { TerminalView } from "@/pages/onchain-world/dashboard/views/TerminalView";
import { WalletsView } from "@/pages/onchain-world/dashboard/views/WalletsView";
import { Button } from "@/pages/onchain-world/dashboard/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/pages/onchain-world/dashboard/ui/popover";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import type { CenterView } from "@/pages/onchain-world/lib/orbitx/types";
import { cn } from "@/lib/utils";

const VIEWS: { id: CenterView; label: string }[] = [
  { id: "world", label: "World" },
  { id: "terminal", label: "Terminal" },
  { id: "map", label: "Map" },
  { id: "orbitx", label: "OrbitX" },
  { id: "wallets", label: "Wallets" },
  { id: "analytics", label: "Analytics" },
];

export function CenterStage() {
  const view = useOrbitxStore((s) => s.activeView);
  const setView = useOrbitxStore((s) => s.setActiveView);
  const options = useOrbitxStore((s) => s.viewOptions);
  const toggle = useOrbitxStore((s) => s.toggleViewOption);
  const resetCamera = useOrbitxStore((s) => s.resetCamera);

  return (
    <section className="ox-panel flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-line px-2">
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn(
                "rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition-[background-color,color] duration-150",
                view === item.id
                  ? "bg-accent-2/25 text-accent"
                  : "text-dim hover:bg-bg-hover hover:text-fg",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="xs">
              <Settings2 className="size-3.5" />
              <span className="hidden sm:inline">View options</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <p className="ox-kicker mb-2">World layers</p>
            {(
              [
                ["labels", "Venue labels"],
                ["trails", "Route trails"],
                ["figures", "Token pads"],
                ["grid", "Reference grid"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                className="flex w-full items-center justify-between rounded-sm px-1 py-1.5 text-xs text-muted hover:text-fg"
              >
                {label}
                <span className={options[key] ? "text-live" : "text-dim"}>
                  {options[key] ? "On" : "Off"}
                </span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon-xs" aria-label="Reset framing" onClick={resetCamera}>
          <Maximize2 className="size-3.5" />
        </Button>
      </header>

      {view === "world" ? <WorldView /> : null}
      {view === "terminal" ? <TerminalView /> : null}
      {view === "map" ? <MapView /> : null}
      {view === "orbitx" ? <OrbitxTokenView /> : null}
      {view === "wallets" ? <WalletsView /> : null}
      {view === "analytics" ? <AnalyticsView /> : null}
    </section>
  );
}
