import { Component, lazy, Suspense, type PointerEvent, type ReactNode, type WheelEvent } from "react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Aperture,
  Crosshair,
  Diamond,
  Grid3x3,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Spline,
  Users,
} from "lucide-react";
import { OrbitxMark } from "@/pages/onchain-world/dashboard/OrbitxMark";
import { Button } from "@/pages/onchain-world/dashboard/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/pages/onchain-world/dashboard/ui/popover";
import { TOKEN_PADS, TRAILS, WORLD_NODES } from "@/pages/onchain-world/lib/orbitx/constants";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import CssCity from "@/pages/onchain-world/CssCity";
import type { WorldPick } from "@/pages/onchain-world/WorldCanvas";
import { fetchToken } from "@/pages/onchain-world/api";
import { fmtUsd } from "@/pages/onchain-world/format";

const WorldCanvas = lazy(() => import("@/pages/onchain-world/WorldCanvas"));

function nodeById(id: string) {
  return WORLD_NODES.find((n) => n.id === id);
}

class ErrorCatch extends Component<{ children: ReactNode; fallback: () => void }, { fail: boolean }> {
  state = { fail: false };
  static getDerivedStateFromError() {
    return { fail: true };
  }
  componentDidCatch() {
    this.props.fallback();
  }
  render() {
    return this.state.fail ? null : this.props.children;
  }
}

export function WorldView() {
  const camera = useOrbitxStore((s) => s.camera);
  const setCamera = useOrbitxStore((s) => s.setCamera);
  const resetCamera = useOrbitxStore((s) => s.resetCamera);
  const follow = useOrbitxStore((s) => s.follow);
  const setFollow = useOrbitxStore((s) => s.setFollow);
  const paused = useOrbitxStore((s) => s.paused);
  const setPaused = useOrbitxStore((s) => s.setPaused);
  const speed = useOrbitxStore((s) => s.speed);
  const cycleSpeed = useOrbitxStore((s) => s.cycleSpeed);
  const viewOptions = useOrbitxStore((s) => s.viewOptions);
  const toggleViewOption = useOrbitxStore((s) => s.toggleViewOption);
  const city = useOrbitxStore((s) => s.city);
  const selectedWallet = useOrbitxStore((s) => s.selectedWallet);
  const trackWallet = useOrbitxStore((s) => s.trackWallet);
  const followId = useOrbitxStore((s) => s.followId);
  const camCommand = useOrbitxStore((s) => s.camCommand);
  const setCamCommand = useOrbitxStore((s) => s.setCamCommand);
  const patchCity = useOrbitxStore((s) => s.patchCity);
  const nav = useNavigate();
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  const tokens = (city.districts.tokens || [])
    .filter((t) => t.symbol)
    .slice(0, 6)
    .map((t, i) => ({
      id: t.mint,
      label: t.market_cap != null ? `$${t.symbol} (${fmtUsd(t.market_cap)})` : `$${t.symbol}`,
      src: t.image || TOKEN_PADS[i % TOKEN_PADS.length]?.src,
      x: TOKEN_PADS[i % TOKEN_PADS.length]?.x ?? 50 + i * 8,
      y: TOKEN_PADS[i % TOKEN_PADS.length]?.y ?? 22,
    }));

  function openWallet(address: string) {
    trackWallet(address);
    setCamCommand({ kind: "wallet", address });
    nav(`/on-chain/wallet/${address}`);
  }

  function onPick(pick: WorldPick) {
    if (pick.kind === "wallet") {
      openWallet(pick.address);
      return;
    }
    if (pick.kind === "event" && pick.event.wallet) {
      openWallet(pick.event.wallet);
      return;
    }
    if (pick.kind === "hub") {
      setCamCommand({ kind: "reset" });
      return;
    }
    if (pick.kind === "token") {
      setCamCommand({ kind: "token", mint: pick.mint });
      nav(`/on-chain/token/${pick.mint}`);
      void fetchToken(pick.mint).catch(() => undefined);
    }
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("canvas")) return;
    drag.current = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setCamera({
      x: drag.current.cx + (e.clientX - drag.current.x),
      y: drag.current.cy + (e.clientY - drag.current.y),
      zoom: camera.zoom,
    });
  }

  function onPointerUp() {
    drag.current = null;
  }

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("canvas")) return;
    e.preventDefault();
    const next = Math.min(1.8, Math.max(0.75, camera.zoom + (e.deltaY > 0 ? -0.08 : 0.08)));
    setCamera({ ...camera, zoom: next });
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="ox-world-stage" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}>
        <img
          src="/world-city.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_40%] opacity-40"
          draggable={false}
        />
        <CssCity
          kols={city.kols}
          districts={city.districts}
          events={city.rawEvents}
          followWallet={selectedWallet}
          cinematic={follow && !city.webglLive}
          paused={paused || city.webglLive}
          onWallet={openWallet}
          onToken={(mint) => {
            nav(`/on-chain/token/${mint}`);
            setCamCommand({ kind: "token", mint });
            void fetchToken(mint).catch(() => undefined);
          }}
        />
        {city.webglOk ? (
          <div className={`oxw-gl${city.webglLive ? " on" : ""}`}>
            <ErrorCatch
              key={city.worldKey}
              fallback={() => patchCity({ webglOk: false, webglLive: false })}
            >
              <Suspense fallback={null}>
                <WorldCanvas
                  events={city.rawEvents}
                  kols={city.kols}
                  flows={city.flows}
                  districts={city.districts}
                  followId={followId}
                  followWallet={selectedWallet}
                  cinematic={follow}
                  cam={camCommand}
                  onPick={onPick}
                  onReady={() => patchCity({ webglLive: true })}
                />
              </Suspense>
            </ErrorCatch>
          </div>
        ) : null}

        <div
          className="pointer-events-none absolute inset-0 origin-center will-change-transform"
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          }}
        >
          {viewOptions.grid ? (
            <div
              className="absolute inset-0 opacity-30 mix-blend-screen"
              style={{
                backgroundImage:
                  "linear-gradient(rgb(139 92 246 / 0.18) 1px, transparent 1px), linear-gradient(90deg, rgb(139 92 246 / 0.18) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
          ) : null}

          {viewOptions.trails ? (
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {TRAILS.map(([from, to, tone]) => {
                const a = nodeById(from);
                const b = nodeById(to);
                if (!a || !b) return null;
                const color =
                  tone === "cyan"
                    ? "var(--color-cyan)"
                    : tone === "buy"
                      ? "var(--color-buy)"
                      : "var(--color-accent)";
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2 - 8;
                return (
                  <path
                    key={`${from}-${to}`}
                    d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                    fill="none"
                    stroke={color}
                    strokeWidth="0.35"
                    className="ox-trail"
                    opacity="0.85"
                  />
                );
              })}
            </svg>
          ) : null}

          {viewOptions.labels
            ? WORLD_NODES.map((node) => (
                <div
                  key={node.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                >
                  {"hub" in node && node.hub ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="flex size-12 items-center justify-center rounded-full bg-accent-2/30 shadow-[0_0_28px_rgb(139_92_246_/_0.7)] ring-1 ring-accent/50">
                        <OrbitxMark className="size-7 text-accent" />
                      </span>
                      <span className="rounded-sm bg-bg-sunken/90 px-2 py-0.5 font-display text-xs font-semibold tracking-[0.2em] text-accent shadow-[0_0_0_1px_rgb(139_92_246_/_0.45)]">
                        {node.label}
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-sm bg-bg-sunken/88 px-2 py-1 text-center shadow-[0_0_0_1px_rgb(139_92_246_/_0.35),0_8px_20px_rgb(0_0_0_/_0.45)]">
                      <p className="font-display text-2xs font-semibold tracking-[0.16em] text-fg">
                        {node.label}
                      </p>
                      {node.sub ? (
                        <p className="text-2xs tracking-[0.14em] text-muted">{node.sub}</p>
                      ) : null}
                    </div>
                  )}
                </div>
              ))
            : null}

          {viewOptions.figures
            ? tokens.map((pad) => (
                <div
                  key={pad.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 max-sm:hidden"
                  style={{ left: `${pad.x}%`, top: `${pad.y}%` }}
                >
                  <div className="flex flex-col items-center gap-1">
                    {pad.src ? (
                      <img
                        src={pad.src}
                        alt=""
                        className="size-8 rounded-full object-cover shadow-[0_0_16px_rgb(0_0_0_/_0.55)] outline outline-1 -outline-offset-1 outline-white/15"
                      />
                    ) : null}
                    <span className="rounded-sm bg-bg-sunken/88 px-1.5 py-0.5 font-display text-2xs tracking-wider text-fg shadow-[0_0_0_1px_rgb(255_255_255_/_0.08)]">
                      {pad.label}
                    </span>
                  </div>
                </div>
              ))
            : null}
        </div>

        <div className="pointer-events-none absolute inset-0 z-[3] bg-[radial-gradient(ellipse_at_center,transparent_45%,rgb(7_8_14_/_0.55)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-20 bg-gradient-to-t from-bg-sunken to-transparent" />
      </div>

      <div className="flex h-11 shrink-0 items-center gap-2 border-t border-line bg-bg-raised/90 px-2">
        <Button variant="ghost" size="xs" onClick={() => { resetCamera(); setCamCommand({ kind: "reset" }); }}>
          <Aperture className="size-3.5" />
          Camera
        </Button>
        <Button
          variant={follow ? "subtle" : "ghost"}
          size="xs"
          onClick={() => {
            const next = !follow;
            setFollow(next);
            setCamCommand(next ? { kind: "follow" } : { kind: "reset" });
          }}
        >
          <Crosshair className="size-3.5" />
          Follow
        </Button>
        <div className="hidden items-center gap-0.5 sm:flex">
          <IconToggle
            pressed={viewOptions.labels}
            label="Labels"
            onClick={() => toggleViewOption("labels")}
          >
            <Diamond className="size-3.5" />
          </IconToggle>
          <IconToggle
            pressed={viewOptions.trails}
            label="Trails"
            onClick={() => toggleViewOption("trails")}
          >
            <Spline className="size-3.5" />
          </IconToggle>
          <IconToggle
            pressed={viewOptions.figures}
            label="Tokens"
            onClick={() => toggleViewOption("figures")}
          >
            <Users className="size-3.5" />
          </IconToggle>
          <IconToggle
            pressed={viewOptions.grid}
            label="Grid"
            onClick={() => toggleViewOption("grid")}
          >
            <Grid3x3 className="size-3.5" />
          </IconToggle>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="sm:hidden" aria-label="View options">
              <Settings2 className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
            <p className="ox-kicker mb-2">View options</p>
            {(
              [
                ["labels", "Labels"],
                ["trails", "Trails"],
                ["figures", "Token pads"],
                ["grid", "Grid"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="flex w-full items-center justify-between rounded-sm px-1 py-1.5 text-xs text-muted hover:text-fg"
                onClick={() => toggleViewOption(key)}
              >
                {label}
                <span className={viewOptions[key] ? "text-live" : "text-dim"}>
                  {viewOptions[key] ? "On" : "Off"}
                </span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-1.5">
          {!city.webglOk ? (
            <Button
              variant="chip"
              size="xs"
              onClick={() => patchCity({ webglOk: true, worldKey: city.worldKey + 1 })}
            >
              Retry 3D
            </Button>
          ) : null}
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
          <Button variant="ghost" size="icon-xs" aria-label="Reset view" onClick={() => { resetCamera(); setCamCommand({ kind: "reset" }); }}>
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function IconToggle({
  pressed,
  label,
  onClick,
  children,
}: {
  pressed: boolean;
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      variant={pressed ? "subtle" : "ghost"}
      size="icon-xs"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
