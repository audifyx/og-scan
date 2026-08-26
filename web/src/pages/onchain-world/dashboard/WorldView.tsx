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
import type { ChainEvent } from "@/pages/onchain-world/api";
import { Button } from "@/pages/onchain-world/dashboard/ui/button";
import { clock } from "@/pages/onchain-world/format";
import { formatAddress, formatPct, formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
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
  const [inspect, setInspect] = useState<ChainEvent | null>(null);
  const onStick = useCallback((next: FlightStick) => setStick(next), []);

  const focused =
    selectedToken === districts.orbitx?.mint || (selectedToken && isOrbitxMint(selectedToken))
      ? districts.orbitx
      : (districts.tokens || []).find((t) => t.mint === selectedToken) || null;

  function onPick(pick: WorldPick) {
    if (pick.kind === "token") {
      setInspect(null);
      selectToken(pick.mint);
      setCamCommand({ kind: "token", mint: pick.mint });
      nav(`/on-chain/token/${pick.mint}`);
      return;
    }
    if (pick.kind === "wallet") {
      setInspect(null);
      trackWallet(pick.address);
      setCamCommand({ kind: "wallet", address: pick.address });
      nav(`/on-chain/wallet/${pick.address}`);
      return;
    }
    if (pick.kind === "event") {
      setFollowId(pick.event.event_id);
      setInspect(pick.event);
      if (pick.event.token_ca) selectToken(pick.event.token_ca);
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
            cinematic={false}
            spin={follow}
            cam={cam}
            paused={paused}
            speed={speed}
            viewOptions={viewOptions}
            stick={stick}
            onPick={onPick}
            onReady={() => patchCity({ webglLive: true })}
            onCamConsumed={() => setCamCommand(null)}
          />
        ) : (
          <CssCity
            kols={kols}
            districts={districts}
            events={events}
            followWallet={selectedWallet}
            cinematic={false}
            paused={paused}
            onWallet={(address) => onPick({ kind: "wallet", address })}
            onToken={(mint) => onPick({ kind: "token", mint })}
          />
        )}

        <WorldJoystick value={stick} onChange={onStick} />

        {inspect ? (
          <InspectHud
            event={inspect}
            onClose={() => setInspect(null)}
            onFocusToken={(mint) => {
              selectToken(mint);
              setCamCommand({ kind: "token", mint });
              nav(`/on-chain/token/${mint}`);
            }}
            onTrackWallet={(address) => {
              trackWallet(address);
              setCamCommand({ kind: "wallet", address });
              nav(`/on-chain/wallet/${address}`);
            }}
          />
        ) : focused ? (
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
              LIVING UNIVERSE
            </p>
            <p className="mt-0.5 text-2xs text-muted">
              {(districts.tokens || []).length} worlds · WASD / stick / wheel · camera stays still until you fly
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
          Spin
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

function InspectHud({
  event,
  onClose,
  onFocusToken,
  onTrackWallet,
}: {
  event: ChainEvent;
  onClose: () => void;
  onFocusToken: (mint: string) => void;
  onTrackWallet: (address: string) => void;
}) {
  const from = event.source_wallet || event.wallet;
  const to = event.destination_wallet || event.counterparty;
  const amount =
    event.amount != null
      ? String(event.amount)
      : event.sol_amount != null
        ? `${event.sol_amount} SOL`
        : "—";
  return (
    <aside className="absolute left-3 top-3 z-10 w-[22rem] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-md border border-line bg-bg-sunken/94 shadow-[0_18px_40px_rgb(0_0_0_/_0.55)]">
      <header className="flex items-center justify-between border-b border-line px-3 py-2">
        <p className="ox-kicker text-accent">{event.event_type.replace(/_/g, " ")}</p>
        <button type="button" className="text-2xs text-muted hover:text-fg" onClick={onClose}>
          Close
        </button>
      </header>
      <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 px-3 py-2 text-2xs">
        <dt className="text-dim">From</dt>
        <dd className="truncate font-mono text-fg">{from ? formatAddress(from) : "—"}</dd>
        <dt className="text-dim">To</dt>
        <dd className="truncate font-mono text-fg">{to ? formatAddress(to) : "—"}</dd>
        <dt className="text-dim">Token</dt>
        <dd className="truncate text-fg">{event.token_name || event.token_symbol || "—"}</dd>
        <dt className="text-dim">Amount</dt>
        <dd className="text-fg">
          {amount}
          {event.usd_value != null ? ` · ${formatUsd(event.usd_value)}` : ""}
        </dd>
        <dt className="text-dim">Time</dt>
        <dd className="text-fg">{clock(event.block_time)}</dd>
        <dt className="text-dim">Sig</dt>
        <dd className="truncate font-mono text-muted">{event.signature || "—"}</dd>
      </dl>
      <div className="flex flex-wrap gap-1.5 border-t border-line px-3 py-2">
        {event.token_ca ? (
          <Button size="xs" variant="subtle" onClick={() => onFocusToken(event.token_ca!)}>
            Focus token
          </Button>
        ) : null}
        {from ? (
          <Button size="xs" variant="ghost" onClick={() => onTrackWallet(from)}>
            Track sender
          </Button>
        ) : null}
        {event.signature ? (
          <a
            href={`https://solscan.io/tx/${event.signature}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-6 items-center rounded-sm px-1.5 text-2xs text-cyan hover:text-fg"
          >
            Solscan
          </a>
        ) : null}
      </div>
    </aside>
  );
}
