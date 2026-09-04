import { useMemo } from "react";
import type { ChainEvent, FlowRow, KolCard } from "./api";
import { eventTone } from "./format";

type Props = {
  events: ChainEvent[];
  kols: KolCard[];
  flows: FlowRow[];
  followWallet?: string | null;
  onWallet: (address: string) => void;
  onEvent: (event: ChainEvent) => void;
};

function polar(index: number, count: number, r: number, cx = 260, cy = 210): { x: number; y: number } {
  const a = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
}

export default function LivingMap({ events, kols, flows, followWallet, onWallet, onEvent }: Props) {
  const nodes = useMemo(() => kols.map((k, i) => ({ ...k, ...polar(i, kols.length, 150) })), [kols]);
  const vis = events.filter((e) => e.importance >= 6 || e.orbitx_related || e.kol_related).slice(0, 28);

  return (
    <svg className="oxw-map" viewBox="0 0 520 420" role="img" aria-label="OrbitX living chain map">
      <defs>
        <radialGradient id="oxw-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="260" cy="210" r="86" fill="url(#oxw-core)" />
      <circle cx="260" cy="210" r="18" fill="#67e8f9" />
      <text x="260" y="214" textAnchor="middle" fill="#041016" fontSize="7" fontFamily="IBM Plex Mono, monospace">$ORBITX</text>
      {flows.slice(0, 16).map((f) => {
        const a = nodes.find((n) => n.address === f.from_address);
        const b = nodes.find((n) => n.address === f.to_address);
        if (!a || !b) return null;
        return (
          <line
            key={`${f.from_address}-${f.to_address}-${f.last_signature || ""}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#38bdf8"
            strokeOpacity="0.22"
            strokeWidth="1"
          />
        );
      })}
      {vis.map((ev) => {
        const src = nodes.find((n) => n.address === ev.wallet || n.address === ev.source_wallet);
        if (!src) return null;
        const tone = eventTone(ev.event_type);
        const color = tone === "burn" ? "#fbbf24" : tone === "sell" ? "#fb7185" : tone === "buy" ? "#4ade80" : "#7dd3fc";
        return (
          <g key={ev.event_id} onClick={() => onEvent(ev)} style={{ cursor: "pointer" }}>
            <line x1={src.x} y1={src.y} x2="260" y2="210" stroke={color} strokeOpacity="0.35" strokeWidth={ev.orbitx_related ? 2 : 1} />
            <circle cx={(src.x + 260) / 2} cy={(src.y + 210) / 2} r={ev.whale_related ? 4 : 2.4} fill={color} />
          </g>
        );
      })}
      {nodes.map((n) => {
        const active = events.some((e) => e.wallet === n.address);
        const on = followWallet === n.address;
        return (
          <g key={n.address} onClick={() => onWallet(n.address)} style={{ cursor: "pointer" }}>
            <circle
              cx={n.x}
              cy={n.y}
              r={on ? 9 : 6}
              fill={on ? "#f472b6" : active ? "#f9a8d4" : "#334155"}
              stroke="#f472b6"
              strokeWidth={on ? 2 : 1}
            />
            <text x={n.x} y={n.y + 16} textAnchor="middle" fill="#dbeafe" fontSize="7" fontFamily="IBM Plex Sans, sans-serif">
              {n.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
