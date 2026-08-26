import { useEffect, useRef, type PointerEvent, type ReactNode, type WheelEvent } from "react";
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


function nodeById(id: string) {
  return WORLD_NODES.find((n) => n.id === id);
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
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  useEffect(() => {
    if (!follow || paused) return;
    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      const t = frame * 0.012 * speed;
      setCamera({
        x: Math.sin(t) * 28,
        y: Math.cos(t * 0.7) * 16,
        zoom: 1.12,
      });
    }, 40);
    return () => window.clearInterval(id);
  }, [follow, paused, speed, setCamera]);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
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
    e.preventDefault();
    const next = Math.min(1.8, Math.max(0.75, camera.zoom + (e.deltaY > 0 ? -0.08 : 0.08)));
    setCamera({ ...camera, zoom: next });
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-bg-sunken touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="absolute inset-0 origin-center will-change-transform"
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          }}
        >
          <img
            src="/world-city.jpg"
            alt=""
            className="h-full w-full object-cover object-[center_40%]"
            draggable={false}
          />
          {viewOptions.grid ? (
            <div
              className="pointer-events-none absolute inset-0 opacity-30 mix-blend-screen"
              style={{
                backgroundImage:
                  "linear-gradient(rgb(139 92 246 / 0.18) 1px, transparent 1px), linear-gradient(90deg, rgb(139 92 246 / 0.18) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
          ) : null}

          {viewOptions.trails ? (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
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
            ? TOKEN_PADS.map((pad) => (
                <div
                  key={pad.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 max-sm:hidden"
                  style={{ left: `${pad.x}%`, top: `${pad.y}%` }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <img
                      src={pad.src}
                      alt=""
                      className="size-8 rounded-full object-cover shadow-[0_0_16px_rgb(0_0_0_/_0.55)] outline outline-1 -outline-offset-1 outline-white/15"
                    />
                    <span className="rounded-sm bg-bg-sunken/88 px-1.5 py-0.5 font-display text-2xs tracking-wider text-fg shadow-[0_0_0_1px_rgb(255_255_255_/_0.08)]">
                      {pad.label}
                    </span>
                  </div>
                </div>
              ))
            : null}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgb(7_8_14_/_0.55)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg-sunken to-transparent" />
      </div>

      <div className="flex h-11 shrink-0 items-center gap-2 border-t border-line bg-bg-raised/90 px-2">
        <Button variant="ghost" size="xs" onClick={resetCamera}>
          <Aperture className="size-3.5" />
          Camera
        </Button>
        <Button
          variant={follow ? "subtle" : "ghost"}
          size="xs"
          onClick={() => setFollow(!follow)}
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

function IconToggle({
  pressed,
  label,
  onClick,
  children,
}: {
  pressed: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
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

