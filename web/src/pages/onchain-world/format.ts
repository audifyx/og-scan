export function shortAddr(value?: string | null, left = 4, right = 4): string {
  const v = String(value || "");
  if (!v) return "UNKNOWN";
  if (v.length <= left + right + 1) return v;
  return `${v.slice(0, left)}…${v.slice(-right)}`;
}

export function fmtNum(value?: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(Number(value))) return "UNKNOWN";
  const n = Number(value);
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function fmtUsd(value?: number | null): string {
  if (value == null || !Number.isFinite(Number(value))) return "UNKNOWN";
  return `$${fmtNum(Number(value))}`;
}

export function fmtSol(value?: number | null): string {
  if (value == null || !Number.isFinite(Number(value))) return "UNKNOWN";
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`;
}

export function clock(iso?: string | null): string {
  if (!iso) return "--:--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString(undefined, { hour12: false });
}

export function eventTone(type: string): string {
  if (type.includes("BURN")) return "burn";
  if (type.includes("BUY")) return "buy";
  if (type.includes("SELL")) return "sell";
  if (type.includes("SOL")) return "sol";
  if (type.includes("ORBITX")) return "ox";
  if (type.includes("WHALE") || type.includes("KOL")) return "whale";
  return "dim";
}

export function eventTitle(type: string): string {
  return type.replace(/_/g, " ");
}
