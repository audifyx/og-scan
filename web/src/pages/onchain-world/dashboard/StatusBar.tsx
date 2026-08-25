import { Activity, Radio, Unplug, Wifi } from "lucide-react";
import { APP_NAME, APP_VERSION } from "@/pages/onchain-world/lib/orbitx/constants";
import { blank, formatAge, formatInt } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const network = useOrbitxStore((s) => s.snapshot.network);
  const rpcTone =
    network.rpc === "healthy" ? "text-live" : network.rpc === "idle" ? "text-warn" : "text-danger";
  const wsOn = network.ws === "connected";

  return (
    <footer className="flex h-9 shrink-0 items-center gap-3 overflow-x-auto border-t border-line bg-bg-raised px-3 text-2xs">
      <span className="flex items-center gap-1.5 text-muted">
        <Radio className="size-3 text-accent" />
        <span className="tracking-wider uppercase">{network.name}</span>
      </span>
      <span className="hidden h-3 w-px bg-line sm:block" />
      <span className={cn("flex items-center gap-1.5", rpcTone)}>
        <Activity className="size-3" />
        RPC {network.rpc}
      </span>
      <span className="hidden h-3 w-px bg-line md:block" />
      <span className="hidden text-muted md:inline">
        Last indexed block{" "}
        <span className="ox-stat text-fg">{formatInt(network.lastIndexedBlock)}</span>
      </span>
      <span className="hidden text-muted lg:inline">
        Indexing delay{" "}
        <span className="ox-stat text-fg">{formatAge(network.indexingDelaySec)}</span>
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        {wsOn ? (
          <Wifi className="size-3 text-live" />
        ) : (
          <Unplug className="size-3 text-warn" />
        )}
        <span className={wsOn ? "text-live" : "text-warn"}>
          WS {wsOn ? "connected" : "disconnected"}
        </span>
        <span className="ml-2 hidden text-dim sm:inline">
          {APP_NAME} {blank(APP_VERSION)}
        </span>
      </span>
    </footer>
  );
}
