import { fmtPct } from "../lib/api";
export default function Change({ v, className = "" }: { v?: number | null; className?: string }) {
  const up = (v ?? 0) >= 0;
  if (v == null) return <span className={`text-muted ${className}`}>—</span>;
  return <span className={`${up ? "text-up" : "text-down"} ${className}`}>{fmtPct(v)}</span>;
}
