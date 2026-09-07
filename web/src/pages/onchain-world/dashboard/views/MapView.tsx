import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CLUSTER_META,
  CLUSTER_ORDER,
  layoutBounds,
  layoutUniverse,
  packBubbles,
  projectToMap,
  volumeBubbleRadius,
} from "@/pages/onchain-world/universeLayout";
import { DEX_HUBS } from "../../../../../shared/orbitx-chain-districts.js";
import { formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import { tokenLabel, tokenTicker } from "../../../../../shared/orbitx-chain-districts.js";
import { ORBITX_MINT } from "../../../../../shared/orbitx-chain-intel.js";

type DragState = {
  pointer: boolean;
  moved: number;
  lx: number;
  ly: number;
  vx: number;
  vy: number;
  raf: number;
};

export function MapView() {
  const nav = useNavigate();
  const kols = useOrbitxStore((s) => s.city.kols);
  const tokens = useOrbitxStore((s) => s.city.districts.tokens || []);
  const orbitx = useOrbitxStore((s) => s.city.districts.orbitx);
  const events = useOrbitxStore((s) => s.city.rawEvents);
  const selected = useOrbitxStore((s) => s.selectedToken);
  const selectToken = useOrbitxStore((s) => s.selectToken);
  const setCamCommand = useOrbitxStore((s) => s.setCamCommand);
  const setView = useOrbitxStore((s) => s.setActiveView);
  const trackWallet = useOrbitxStore((s) => s.trackWallet);
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<DragState>({ pointer: false, moved: 0, lx: 0, ly: 0, vx: 0, vy: 0, raf: 0 });

  const layout = useMemo(() => layoutUniverse(tokens.slice(0, 250)), [tokens]);
  const bounds = useMemo(() => layoutBounds(layout), [layout]);

  const planets = useMemo(() => {
    const raw = tokens.slice(0, 250).flatMap((t) => {
      const node = layout.get(t.mint);
      if (!node) return [];
      const mapped = projectToMap(node.pos, bounds);
      return [
        {
          mint: t.mint,
          label: tokenTicker(t) || tokenLabel(t),
          name: tokenLabel(t),
          image: t.image || null,
          cluster: node.cluster,
          vol: t.volume_24h || 0,
          x: mapped.x,
          y: mapped.y,
          r: volumeBubbleRadius(t.volume_24h || t.market_cap || 12, node.radius),
        },
      ];
    });
    return packBubbles(raw, 0.42, 22, { min: 6, max: 94 });
  }, [tokens, layout, bounds]);

  const sparks = useMemo(
    () =>
      events.slice(0, 80).map((e, i) => {
        const mint = e.token_ca || ORBITX_MINT;
        const host = planets.find((p) => p.mint === mint);
        const core = projectToMap([0, 0, 0], bounds);
        return {
          id: e.event_id,
          x: (host?.x ?? core.x) + ((i % 7) - 3) * 0.55,
          y: (host?.y ?? core.y) + ((i % 5) - 2) * 0.45,
          buy: /BUY/i.test(e.event_type || ""),
        };
      }),
    [events, planets, bounds],
  );

  const ox = projectToMap([0, 0, 0], bounds);
  const hovered = planets.find((p) => p.mint === hover) || null;
  const span = 100 / zoom;
  const viewX = 50 - span / 2 + pan.x;
  const viewY = 50 - span / 2 + pan.y;

  function coast() {
    const state = drag.current;
    if (state.raf) window.cancelAnimationFrame(state.raf);
    const step = () => {
      if (state.pointer) {
        state.raf = 0;
        return;
      }
      state.vx *= 0.88;
      state.vy *= 0.88;
      if (Math.hypot(state.vx, state.vy) < 0.004) {
        state.raf = 0;
        return;
      }
      setPan((p) => ({ x: p.x + state.vx, y: p.y + state.vy }));
      state.raf = window.requestAnimationFrame(step);
    };
    state.raf = window.requestAnimationFrame(step);
  }

  function open(mint: string) {
    if (drag.current.moved > 5) return;
    selectToken(mint);
    setCamCommand({ kind: "token", mint });
    setView("world");
    nav(`/on-chain/token/${mint}`);
  }

  return (
    <div className="relative h-full min-h-0 flex-1 overflow-hidden bg-black">
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(rgb(255 255 255 / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.08) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        viewBox={`${viewX} ${viewY} ${span} ${span}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={(e) => {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const fracX = (e.clientX - rect.left) / Math.max(rect.width, 1);
          const fracY = (e.clientY - rect.top) / Math.max(rect.height, 1);
          const worldX = viewX + fracX * span;
          const worldY = viewY + fracY * span;
          const nextZoom = Math.max(0.55, Math.min(6.2, zoom * (e.deltaY > 0 ? 0.9 : 1.11)));
          const nextSpan = 100 / nextZoom;
          const nextViewX = worldX - fracX * nextSpan;
          const nextViewY = worldY - fracY * nextSpan;
          setZoom(nextZoom);
          setPan({
            x: nextViewX - (50 - nextSpan / 2),
            y: nextViewY - (50 - nextSpan / 2),
          });
        }}
        onPointerDown={(e) => {
          drag.current.pointer = true;
          drag.current.moved = 0;
          drag.current.lx = e.clientX;
          drag.current.ly = e.clientY;
          drag.current.vx = 0;
          drag.current.vy = 0;
          if (drag.current.raf) window.cancelAnimationFrame(drag.current.raf);
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current.pointer) return;
          const dx = ((e.clientX - drag.current.lx) / Math.max(e.currentTarget.clientWidth, 1)) * span;
          const dy = ((e.clientY - drag.current.ly) / Math.max(e.currentTarget.clientHeight, 1)) * span;
          drag.current.moved += Math.hypot(e.clientX - drag.current.lx, e.clientY - drag.current.ly);
          drag.current.lx = e.clientX;
          drag.current.ly = e.clientY;
          drag.current.vx = -dx;
          drag.current.vy = -dy;
          setPan((p) => ({ x: p.x - dx, y: p.y - dy }));
        }}
        onPointerUp={() => {
          drag.current.pointer = false;
          coast();
        }}
        onPointerCancel={() => {
          drag.current.pointer = false;
        }}
      >
        <defs>
          {planets.map((p) => (
            <clipPath key={`clip-${p.mint}`} id={`map-clip-${p.mint}`}>
              <circle cx={p.x} cy={p.y} r={p.r * 0.82} />
            </clipPath>
          ))}
        </defs>
        {CLUSTER_ORDER.filter((id) => id !== "orbitx").map((id) => {
          const meta = CLUSTER_META[id];
          const c = projectToMap([0, 0, 0], bounds);
          const r = (meta.orbit / bounds.span) * 84;
          return (
            <g key={id}>
              <circle
                cx={c.x}
                cy={c.y}
                r={r}
                fill="none"
                stroke={meta.color}
                strokeWidth="0.22"
                opacity="0.28"
              />
              <text
                x={c.x}
                y={c.y - r - 1.1}
                textAnchor="middle"
                fill={meta.color}
                fontSize="2.4"
                fontFamily="Oxanium, sans-serif"
              >
                {meta.label}
              </text>
            </g>
          );
        })}
        {DEX_HUBS.map((hub, i) => {
          const a = (i / Math.max(DEX_HUBS.length, 1)) * Math.PI * 2;
          const mapped = projectToMap([Math.cos(a) * 16, 0, Math.sin(a) * 16], bounds);
          return (
            <g key={hub.id}>
              <circle cx={mapped.x} cy={mapped.y} r="1.8" fill="#050505" stroke="#d4d4d4" strokeWidth="0.24" />
              <text x={mapped.x} y={mapped.y + 3.2} textAnchor="middle" fill="#e5e5e5" fontSize="1.9" fontFamily="Oxanium, sans-serif">
                {hub.label.replace(" DEX", "")}
              </text>
            </g>
          );
        })}
        {sparks.map((s) => (
          <circle key={s.id} cx={s.x} cy={s.y} r="0.38" fill={s.buy ? "#f5f5f5" : "#737373"} opacity="0.88" />
        ))}
        {planets.map((p) => (
          <g
            key={p.mint}
            className="cursor-pointer"
            onPointerUp={() => open(p.mint)}
            onPointerEnter={() => setHover(p.mint)}
            onPointerLeave={() => setHover((h) => (h === p.mint ? null : h))}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill="#0a0a0a"
              stroke={selected === p.mint || hover === p.mint ? "#ffffff" : CLUSTER_META[p.cluster]?.color || "#a3a3a3"}
              strokeWidth={selected === p.mint ? 0.38 : hover === p.mint ? 0.28 : 0.16}
            />
            {p.image ? (
              <image
                href={p.image}
                x={p.x - p.r * 0.82}
                y={p.y - p.r * 0.82}
                width={p.r * 1.64}
                height={p.r * 1.64}
                clipPath={`url(#map-clip-${p.mint})`}
                preserveAspectRatio="xMidYMid slice"
                style={{ filter: "grayscale(1) contrast(1.12)" }}
              />
            ) : null}
            {zoom >= 1.7 || hover === p.mint || selected === p.mint ? (
              <text
                x={p.x}
                y={p.y + p.r + 1.7}
                textAnchor="middle"
                fill="#f5f5f5"
                fontSize="1.7"
                fontFamily="Oxanium, sans-serif"
              >
                {p.label}
              </text>
            ) : null}
          </g>
        ))}
        <g className="cursor-pointer" onPointerUp={() => open(orbitx?.mint || ORBITX_MINT)}>
          <circle cx={ox.x} cy={ox.y} r="3.6" fill="#111111" stroke="#ffffff" strokeWidth="0.4" />
          <text x={ox.x} y={ox.y + 0.55} textAnchor="middle" fill="#f5f5f5" fontSize="2.1" fontFamily="Oxanium, sans-serif">
            OX
          </text>
          <text x={ox.x} y={ox.y + 5.6} textAnchor="middle" fill="#e5e5e5" fontSize="2.3" fontFamily="Oxanium, sans-serif">
            ORBITX
          </text>
        </g>
        {kols.slice(0, 24).map((k, i) => {
          const host = k.last_mint ? planets.find((p) => p.mint === k.last_mint) : null;
          const ring = projectToMap(
            [Math.cos((i / 24) * Math.PI * 2) * 16, 0, Math.sin((i / 24) * Math.PI * 2) * 16],
            bounds,
          );
          const cx = host ? host.x + host.r + 1.1 : ring.x;
          const cy = host ? host.y - 1.1 : ring.y;
          return (
            <g
              key={k.address}
              className="cursor-pointer"
              onPointerUp={() => {
                if (drag.current.moved > 5) return;
                trackWallet(k.address);
                setCamCommand({ kind: "wallet", address: k.address });
                setView("wallets");
                nav(`/on-chain/wallet/${k.address}`);
              }}
            >
              <circle cx={cx} cy={cy} r="0.9" fill="#e5e5e5" opacity="0.95" />
              <text x={cx} y={cy + 2.1} textAnchor="middle" fill="#a3a3a3" fontSize="1.4" fontFamily="Oxanium, sans-serif">
                {k.name.slice(0, 10)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-line bg-bg-sunken/80 px-3 py-2">
        <p className="ox-kicker text-accent">BUBBLE MAP</p>
        <p className="text-2xs text-muted">
          {planets.length} worlds · sized by volume · packed so they never sit inside each other · drag / inertial coast / wheel-to-cursor
        </p>
        {hovered ? (
          <p className="mt-1 text-2xs text-fg">
            {hovered.name}
            {hovered.vol ? ` · ${formatUsd(hovered.vol)} vol` : ""}
            {` · ${CLUSTER_META[hovered.cluster]?.label || "cluster"}`}
          </p>
        ) : null}
      </div>
    </div>
  );
}
