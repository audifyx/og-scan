import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorldJoystick, type FlightStick } from "@/pages/onchain-world/dashboard/WorldJoystick";
import {
  Aperture,
  Crosshair,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import WorldCanvas, { type WorldPick } from "@/pages/onchain-world/WorldCanvas";
import CssCity from "@/pages/onchain-world/CssCity";
import { Button } from "@/pages/onchain-world/dashboard/ui/button";
import { formatPct, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import { tokenLabel, tokenTicker } from "../../../../shared/orbitx-chain-districts.js";
import { isOrbitxMint } from "../../../../shared/orbitx-chain-intel.js";

export function WorldView() {
  const nav = useNavigate();
  const follow = useOrbitxStore((s) => s.follow);
  const setFollow = useOrbitxStore((s) => s.setFollow);
  const paused = useOrbitxStore((s) => s.paused);
  const setPaused = useOrbitxStore((s) => s.setPaused);
  const speed = useOrbitxStore((s) => s.speed);
  const cycleSpeed = useOrbitxStore((s) => s.cycleSpeed);
  const resetCamera = useOrbitxStore((s) => s.resetCamera);
  const viewOptions = useOrbitxStore((s) => s.viewOptions);
  const webglOk = useOrbitxStore((s) => s.city.webglOk);
  const events = useOrbitxStore((s) => s.city.rawEvents);
  const kols = useOrbitxStore((s) => s.city.kols);
  const flows = useOrbitxStore((s) => s.city.flows);
  const districts = useOrbitxStore((s) => s.city.districts);
  const followId = useOrbitxStore((s) => s.followId);
  const selectedWallet = useOrbitxStore((s) => s.selectedWallet);
  const selectedToken = useOrbitxStore((s) => s.selectedToken);
  const cam = useOrbitxStore((s) => s.camCommand);
  const selectToken = useOrbitxStore((s) => s.selectToken);
  const trackWallet = useOrbitxStore((s) => s.trackWallet);
  const setFollowId = useOrbitxStore((s) => s.setFollowId);
  const setCamCommand = useOrbitxStore((s) => s.setCamCommand);
  const patchCity = useOrbitxStore((s) => s.patchCity);
  const [stick, setStick] = useState<FlightStick>({ x: 0, y: 0, z: 0, boost: false });
  const onStick = useCallback((next: FlightStick) => setStick(next), []);

  const focused =
    selectedToken === districts.orbitx?.mint || (selectedToken && isOrbitxMint(selectedToken))
      ? districts.orbitx
      : (districts.tokens || []).find((t) => t.mint === selectedToken) || null;

  function onPick(pick: WorldPick) {
    if (pick.kind === "token") {
      selectToken(pick.mint);
      setCamCommand({ kind: "token", mint: pick.mint });
      nav(`/on-chain/token/${pick.mint}`);
      return;
    }
    if (pick.kind === "wallet") {
      trackWallet(pick.address);
      setCamCommand({ kind: "wallet", address: pick.address });
      nav(`/on-chain/wallet/${pick.address}`);
      return;
    }
    if (pick.kind === "event") {
      setFollowId(pick.event.event_id);
      if (pick.event.token_ca) {
        selectToken(pick.event.token_ca);
        setCamCommand({ kind: "token", mint: pick.event.token_ca });
      } else if (pick.event.wallet) {
        trackWallet(pick.event.wallet);
      }
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#02010a]">
        {webglOk ? (
          <WorldCanvas
            events={events}
            kols={kols}
            flows={flows}
            districts={districts}
            followId={followId}
            followWallet={selectedWallet}
            selectedMint={selectedToken}
            cinematic={follow}
            cam={cam}
            paused={paused}
            speed={speed}
            viewOptions={viewOptions}
            stick={stick}
            onPick={onPick}
            onReady={() => patchCity({ webglLive: true })}
          />
        ) : (
          <CssCity
            kols={kols}
            districts={districts}
            events={events}
            followWallet={selectedWallet}
            cinematic={follow}
            paused={paused}
            onWallet={(address) => onPick({ kind: "wallet", address })}
            onToken={(mint) => onPick({ kind: "token", mint })}
          />
        )}

        <WorldJoystick value={stick} onChange={onStick} />

        {focused ? (
          <aside className="pointer-events-none absolute left-3 top-3 max-w-sm overflow-hidden rounded-md border border-line bg-bg-sunken/88 shadow-[0_18px_40px_rgb(0_0_0_/_0.45)]">
            {focused.banner ? (
              <img src={focused.banner} alt="" className="h-16 w-full object-cover" />
            ) : null}
            <div className="flex items-center gap-2.5 px-3 py-2">
              {focused.image ? (
                <img src={focused.image} alt="" className="size-9 rounded-full object-cover" />
              ) : (
                <span className="size-9 rounded-full bg-accent-2/30" />
              )}
              <div className="min-w-0">
                <p className="truncate font-display text-xs font-semibold tracking-wide text-fg">
                  {tokenLabel(focused)}
                </p>
                <p className="truncate text-2xs text-muted">
                  {tokenTicker(focused) ? `$${tokenTicker(focused)}` : "Solana"}
                  {focused.volume_24h != null ? ` · ${formatUsd(focused.volume_24h)} vol` : ""}
                  {focused.change_24h != null ? ` · ${formatPct(focused.change_24h)}` : ""}
                </p>
              </div>
            </div>
          </aside>
        ) : (
          <aside className="pointer-events-none absolute left-3 top-3 rounded-md border border-line bg-bg-sunken/80 px-3 py-2">
            <p className="flex items-center gap-1.5 font-display text-2xs tracking-[0.16em] text-accent">
              <Sparkles className="size-3" />
              GALAXY OF PLANETS
            </p>
            <p className="mt-0.5 text-2xs text-muted">
              {(districts.tokens || []).length} planets · WASD / stick to fly · Orbit is optional
            </p>
          </aside>
        )}
      </div>

      <div className="flex h-11 shrink-0 items-center gap-2 border-t border-line bg-bg-raised/90 px-2">
        <Button variant="ghost" size="xs" onClick={resetCamera}>
          <Aperture className="size-3.5" />
          Camera
        </Button>
        <Button variant={follow ? "subtle" : "ghost"} size="xs" onClick={() => setFollow(!follow)}>
          <Crosshair className="size-3.5" />
          Orbit
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="ox-kicker hidden sm:inline">Speed</span>
          <Button variant="chip" size="xs" onClick={cycleSpeed}>
            {speed}x
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={paused ? "Play" : "Pause"}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Reset view" onClick={resetCamera}>
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
