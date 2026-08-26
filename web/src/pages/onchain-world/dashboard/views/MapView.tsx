import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CLUSTER_META,
  CLUSTER_ORDER,
  layoutBounds,
  layoutUniverse,
  projectToMap,
} from "@/pages/onchain-world/universeLayout";
import { DEX_HUBS } from "../../../../../shared/orbitx-chain-districts.js";
import { formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import { tokenLabel, tokenTicker } from "../../../../../shared/orbitx-chain-districts.js";
import { ORBITX_MINT } from "../../../../../shared/orbitx-chain-intel.js";

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
  const drag = useRef({ dragging: false, lx: 0, ly: 0 });

  const layout = useMemo(() => layoutUniverse(tokens.slice(0, 250)), [tokens]);
  const bounds = useMemo(() => layoutBounds(layout), [layout]);

  const planets = useMemo(() => {
    return tokens.slice(0, 250).flatMap((t) => {
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
          r: Math.min(3.4, 1.05 + node.radius * 1.5),
        },
      ];
    });
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

  function open(mint: string) {
    selectToken(mint);
    setCamCommand({ kind: "token", mint });
    setView("world");
    nav(`/on-chain/token/${mint}`);
  }

  return (
    <div className="relative h-full min-h-0 flex-1 overflow-hidden bg-[#05030c]">
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(rgb(139 92 246 / 0.16) 1px, transparent 1px), linear-gradient(90deg, rgb(139 92 246 / 0.16) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        viewBox={`${viewX} ${viewY} ${span} ${span}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={(e) => {
          e.preventDefault();
          setZoom((z) => Math.max(0.7, Math.min(4.2, z + (e.deltaY > 0 ? -0.12 : 0.12))));
        }}
        onPointerDown={(e) => {
          drag.current.dragging = true;
          drag.current.lx = e.clientX;
          drag.current.ly = e.clientY;
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current.dragging) return;
          const dx = ((e.clientX - drag.current.lx) / e.currentTarget.clientWidth) * span;
          const dy = ((e.clientY - drag.current.ly) / e.currentTarget.clientHeight) * span;
          drag.current.lx = e.clientX;
          drag.current.ly = e.clientY;
          setPan((p) => ({ x: p.x - dx, y: p.y - dy }));
        }}
        onPointerUp={() => {
          drag.current.dragging = false;
        }}
        onPointerCancel={() => {
          drag.current.dragging = false;
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
          const c = projectToMap(meta.center, bounds);
          const r = (meta.spread / bounds.span) * 42;
          return (
            <g key={id}>
              <circle cx={c.x} cy={c.y} r={r} fill={meta.color} opacity="0.12" />
              <text
                x={c.x}
                y={c.y - r * 0.72}
                textAnchor="middle"
                fill={meta.color}
                fontSize="2.6"
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
              <circle cx={mapped.x} cy={mapped.y} r="2.1" fill="#0b0e16" stroke="#c4b5fd" strokeWidth="0.28" />
              <text x={mapped.x} y={mapped.y + 3.6} textAnchor="middle" fill="#e8eaf2" fontSize="2.1" fontFamily="Oxanium, sans-serif">
                {hub.label.replace(" DEX", "")}
              </text>
            </g>
          );
        })}
        {sparks.map((s) => (
          <circle key={s.id} cx={s.x} cy={s.y} r="0.42" fill={s.buy ? "#34d399" : "#fb7185"} opacity="0.85" />
        ))}
        {planets.map((p) => (
          <g
            key={p.mint}
            className="cursor-pointer"
            onClick={() => open(p.mint)}
            onPointerEnter={() => setHover(p.mint)}
            onPointerLeave={() => setHover((h) => (h === p.mint ? null : h))}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill="#1e1b4b"
              stroke={selected === p.mint || hover === p.mint ? "#f5d0fe" : CLUSTER_META[p.cluster]?.color || "#a78bfa"}
              strokeWidth={selected === p.mint ? 0.35 : 0.16}
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
              />
            ) : null}
          </g>
        ))}
        <g className="cursor-pointer" onClick={() => open(orbitx?.mint || ORBITX_MINT)}>
          <circle cx={ox.x} cy={ox.y} r="3.4" fill="#8b5cf6" stroke="#c4b5fd" strokeWidth="0.35" />
          <text x={ox.x} y={ox.y + 5.4} textAnchor="middle" fill="#e8eaf2" fontSize="2.6" fontFamily="Oxanium, sans-serif">
            ORBITX
          </text>
        </g>
        {kols.slice(0, 24).map((k, i) => {
          const host = k.last_mint ? planets.find((p) => p.mint === k.last_mint) : null;
          const ring = projectToMap(
            [Math.cos((i / 24) * Math.PI * 2) * 16, 0, Math.sin((i / 24) * Math.PI * 2) * 16],
            bounds,
          );
          const cx = host ? host.x + 1.6 : ring.x;
          const cy = host ? host.y - 1.2 : ring.y;
          return (
            <g
              key={k.address}
              className="cursor-pointer"
              onClick={() => {
                trackWallet(k.address);
                setCamCommand({ kind: "wallet", address: k.address });
                setView("wallets");
              }}
            >
              <circle cx={cx} cy={cy} r="0.95" fill="#34d399" opacity="0.95" />
              <text x={cx} y={cy + 2.2} textAnchor="middle" fill="#e9d5ff" fontSize="1.5" fontFamily="Oxanium, sans-serif">
                {k.name.slice(0, 10)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-line bg-bg-sunken/80 px-3 py-2">
        <p className="ox-kicker text-accent">SPACE MAP</p>
        <p className="text-2xs text-muted">
          {planets.length} planets · {kols.length} KOLs · {sparks.length} live sparks · drag / wheel
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
