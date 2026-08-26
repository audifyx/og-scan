import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CLUSTER_META, CLUSTER_ORDER, layoutUniverse } from "@/pages/onchain-world/universeLayout";
import { formatUsd } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import { tokenLabel, tokenTicker } from "../../../../../shared/orbitx-chain-districts.js";
import { ORBITX_MINT } from "../../../../../shared/orbitx-chain-intel.js";

function toMap(pos: [number, number, number]): { x: number; y: number } {
  return { x: 50 + pos[0] * 0.26, y: 50 + pos[2] * 0.26 };
}

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

  const layout = useMemo(() => layoutUniverse(tokens.slice(0, 250)), [tokens]);

  const planets = useMemo(() => {
    return tokens.slice(0, 250).flatMap((t) => {
      const node = layout.get(t.mint);
      if (!node) return [];
      const mapped = toMap(node.pos);
      const vol = t.volume_24h || 0;
      return [
        {
          mint: t.mint,
          label: tokenTicker(t) || tokenLabel(t),
          name: tokenLabel(t),
          image: t.image || null,
          cluster: node.cluster,
          vol,
          x: mapped.x,
          y: mapped.y,
          r: Math.min(2.6, 0.35 + node.radius * 1.15),
        },
      ];
    });
  }, [tokens, layout]);

  const sparks = useMemo(
    () =>
      events.slice(0, 80).map((e, i) => {
        const mint = e.token_ca || ORBITX_MINT;
        const host = planets.find((p) => p.mint === mint);
        return {
          id: e.event_id,
          x: (host?.x ?? 50) + ((i % 7) - 3) * 0.7,
          y: (host?.y ?? 50) + ((i % 5) - 2) * 0.55,
          buy: /BUY/i.test(e.event_type || ""),
        };
      }),
    [events, planets],
  );

  function open(mint: string) {
    selectToken(mint);
    setCamCommand({ kind: "token", mint });
    setView("world");
    nav(`/on-chain/token/${mint}`);
  }

  const hovered = planets.find((p) => p.mint === hover) || null;

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-[#05030c]">
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
        viewBox={`${50 - 50 / zoom} ${50 - 50 / zoom} ${100 / zoom} ${100 / zoom}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={(e) => {
          e.preventDefault();
          setZoom((z) => Math.max(0.55, Math.min(4.2, z + (e.deltaY > 0 ? -0.12 : 0.12))));
        }}
      >
        {CLUSTER_ORDER.filter((id) => id !== "orbitx").map((id) => {
          const meta = CLUSTER_META[id];
          const c = toMap(meta.center);
          return (
            <g key={id}>
              <circle cx={c.x} cy={c.y} r={meta.spread * 0.26} fill={meta.color} opacity="0.08" />
              <text
                x={c.x}
                y={c.y - meta.spread * 0.22}
                textAnchor="middle"
                fill={meta.color}
                fontSize="1.8"
                fontFamily="Oxanium, sans-serif"
              >
                {meta.label}
              </text>
            </g>
          );
        })}
        {sparks.map((s) => (
          <circle key={s.id} cx={s.x} cy={s.y} r="0.35" fill={s.buy ? "#34d399" : "#fb7185"} opacity="0.85" />
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
              stroke={selected === p.mint || hover === p.mint ? "#f5d0fe" : CLUSTER_META[p.cluster].color}
              strokeWidth={selected === p.mint ? 0.35 : 0.16}
            />
            {p.image ? (
              <image
                href={p.image}
                x={p.x - p.r * 0.82}
                y={p.y - p.r * 0.82}
                width={p.r * 1.64}
                height={p.r * 1.64}
                clipPath="circle(50%)"
                preserveAspectRatio="xMidYMid slice"
              />
            ) : null}
          </g>
        ))}
        <g className="cursor-pointer" onClick={() => open(orbitx?.mint || ORBITX_MINT)}>
          <circle cx="50" cy="50" r="3.2" fill="var(--color-accent-2)" stroke="var(--color-accent)" strokeWidth="0.35" />
          <text x="50" y="56" textAnchor="middle" fill="var(--color-fg)" fontSize="2.4" fontFamily="Oxanium, sans-serif">
            ORBITX
          </text>
        </g>
        {kols.slice(0, 24).map((k) => {
          const host = k.last_mint ? planets.find((p) => p.mint === k.last_mint) : null;
          const cx = host ? host.x + 1.8 : 50 + (hashAngle(k.address).x);
          const cy = host ? host.y - 1.4 : 50 + (hashAngle(k.address).y);
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
              <circle cx={cx} cy={cy} r="0.95" fill="var(--color-live)" opacity="0.95" />
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
          {planets.length} planets · {kols.length} KOLs · {sparks.length} live sparks · wheel zoom
        </p>
        {hovered ? (
          <p className="mt-1 text-2xs text-fg">
            {hovered.name}
            {hovered.vol ? ` · ${formatUsd(hovered.vol)} vol` : ""}
            {` · ${CLUSTER_META[hovered.cluster].label}`}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function hashAngle(id: string): { x: number; y: number } {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const a = ((h >>> 0) % 10_000) / 10_000 * Math.PI * 2;
  return { x: Math.cos(a) * 18, y: Math.sin(a) * 13 };
}
