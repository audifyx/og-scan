import { useEffect, useState } from "react";
import { MoreVertical, Volume2, VolumeX } from "lucide-react";
import { OrbitxMark } from "@/pages/onchain-world/dashboard/OrbitxMark";
import { Badge } from "@/pages/onchain-world/dashboard/ui/badge";
import { Button } from "@/pages/onchain-world/dashboard/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/pages/onchain-world/dashboard/ui/dropdown-menu";
import { APP_NAME } from "@/pages/onchain-world/lib/orbitx/constants";
import { formatAge, formatInt, formatUsd, utcClock } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";

function Stat({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-3 py-1.5">
      <span className="ox-kicker">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="ox-stat text-sm font-medium text-fg">{value}</span>
        {delta ? <span className="ox-stat text-2xs text-live">{delta}</span> : null}
      </div>
    </div>
  );
}

export function TopBar() {
  const ticker = useOrbitxStore((s) => s.snapshot.ticker);
  const network = useOrbitxStore((s) => s.snapshot.network);
  const muted = useOrbitxStore((s) => s.muted);
  const setMuted = useOrbitxStore((s) => s.setMuted);
  const resetCamera = useOrbitxStore((s) => s.resetCamera);
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(utcClock(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const live = Boolean(network.live);
  const liveLabel = network.liveLabel || (live ? "LIVE" : "IDLE");

  const stats = (
    <div className="flex items-stretch divide-x divide-line">
      <Stat
        label="Block"
        value={formatInt(ticker.block)}
        delta={ticker.blockAgeSec != null ? `+${formatAge(ticker.blockAgeSec)}` : null}
      />
      <Stat label="Events / Sec" value={formatInt(ticker.eventsPerSec)} />
      <Stat label="Tx / Min" value={formatInt(ticker.txPerMin)} />
      <Stat label="OrbitX Buys" value={formatInt(ticker.orbitxBuys)} />
      <Stat label="OrbitX Burned" value={formatInt(ticker.orbitxBurned)} />
      <Stat label="Whale Activity" value={formatUsd(ticker.whaleActivityUsd)} />
      <Stat label="Active Wallets" value={formatInt(ticker.activeWallets)} />
    </div>
  );

  return (
    <header className="flex shrink-0 flex-col border-b border-line bg-bg-raised">
      <div className="flex h-12 items-center gap-3 px-3">
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-accent-2/20 shadow-[0_0_18px_rgb(139_92_246_/_0.35)]">
            <OrbitxMark className="size-5" />
          </span>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-sm font-semibold tracking-[0.18em] text-fg">
              ORBITX
            </h1>
            <span className="hidden text-micro font-medium tracking-[0.2em] text-muted sm:inline">
              ON-CHAIN
            </span>
            <Badge tone={live ? "live" : "idle"} className="gap-1">
              <span className={`size-1.5 rounded-full ox-live-dot ${live ? "bg-live" : "bg-warn"}`} />
              {liveLabel}
            </Badge>
          </div>
        </div>

        <div className="ox-scroll mx-auto hidden min-w-0 flex-1 items-stretch overflow-x-auto md:flex">
          <div className="mx-auto">{stats}</div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="ox-stat hidden min-w-28 text-right text-xs text-muted lg:inline">
            {now ?? "—"}
          </span>
          <span className="hidden items-center gap-1.5 rounded-sm border border-line px-2 py-1 text-2xs font-semibold tracking-wider text-cyan sm:inline-flex">
            <span className="size-1.5 rounded-full bg-cyan" />
            SOLANA
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => setMuted(!muted)}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => resetCamera()}>Reset camera</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setMuted(!muted)}>
                {muted ? "Unmute alerts" : "Mute alerts"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>{APP_NAME}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="ox-scroll overflow-x-auto border-t border-line md:hidden">{stats}</div>
    </header>
  );
}
