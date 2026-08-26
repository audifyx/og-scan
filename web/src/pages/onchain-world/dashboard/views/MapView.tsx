import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { galaxyPos } from "@/pages/onchain-world/WorldCanvas";
import { WORLD_NODES } from "@/pages/onchain-world/lib/orbitx/constants";
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

  const planets = useMemo(() => {
    return tokens.slice(0, 250).map((t, i) => {
      const pos = galaxyPos(t.mint, i, tokens.length);
      const vol = t.volume_24h || 0;
      return {
        mint: t.mint,
        label: tokenTicker(t) || tokenLabel(t),
        name: tokenLabel(t),
        image: t.image || null,
        vol,
        x: 50 + pos[0] * 1.15,
        y: 50 + pos[2] * 1.15,
        r: Math.min(2.4, 0.7 + Math.log10(Math.max(vol, 12)) * 0.28),
      };
    });
  }, [tokens]);

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
          setZoom((z) => Math.max(0.7, Math.min(3.2, z + (e.deltaY > 0 ? -0.12 : 0.12))));
        }}
      >
        {WORLD_NODES.filter((n) => n.id !== "orbitx").map((node) => (
          <line
            key={node.id}
            x1="50"
            y1="50"
            x2={node.x}
            y2={node.y}
            stroke="var(--color-accent-2)"
            strokeWidth="0.25"
            opacity="0.45"
          />
        ))}
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
              stroke={selected === p.mint || hover === p.mint ? "#f5d0fe" : "#a78bfa"}
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
        {WORLD_NODES.map((node) => (
          <g
            key={node.id}
            className="cursor-pointer"
            onClick={() => {
              if (node.id === "orbitx") open(orbitx?.mint || ORBITX_MINT);
            }}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={"hub" in node && node.hub ? 3.2 : 2.1}
              fill={"hub" in node && node.hub ? "var(--color-accent-2)" : "var(--color-bg-raised)"}
              stroke="var(--color-accent)"
              strokeWidth="0.35"
            />
            <text
              x={node.x}
              y={node.y + 6}
              textAnchor="middle"
              fill="var(--color-fg)"
              fontSize="2.4"
              fontFamily="Oxanium, sans-serif"
            >
              {node.label}
            </text>
          </g>
        ))}
        {kols.slice(0, 24).map((k, i) => {
          const angle = (i / Math.max(kols.length, 1)) * Math.PI * 2;
          const cx = 50 + Math.cos(angle) * 18;
          const cy = 50 + Math.sin(angle) * 13;
          return (
            <g
              key={k.address}
              className="cursor-pointer"
              onClick={() => {
                trackWallet(k.address);
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
          </p>
        ) : null}
      </div>
    </div>
  );
}
