export default function ScoreRing({ value, max = 100, label, size = 120 }: { value?: number | null; max?: number; label?: string; size?: number }) {
  const v = Math.max(0, Math.min(max, value ?? 0));
  const pct = v / max;
  const color = pct >= 0.75 ? "#16c784" : pct >= 0.5 ? "#22d3a6" : pct >= 0.3 ? "#f0b90b" : "#ea3943";
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#232733" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" style={{ transition: "stroke-dashoffset .6s" }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold" style={{ color }}>{value == null ? "—" : Math.round(value)}</div>
        {label && <div className="text-[10px] uppercase tracking-wide text-muted mt-0.5">{label}</div>}
      </div>
    </div>
  );
}
