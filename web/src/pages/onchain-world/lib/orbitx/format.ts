const DASH = "—";

export function blank(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return DASH;
  return String(value);
}

export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1) return formatUsd(value);
  if (abs >= 0.01) return `${sign}$${abs.toFixed(4)}`;
  if (abs === 0) return DASH;
  const decimals = Math.min(12, Math.max(4, -Math.floor(Math.log10(abs)) + 3));
  return `${sign}$${abs.toFixed(decimals)}`;
}

export function formatToken(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return DASH;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function formatAddress(address: string | null | undefined): string {
  if (!address) return DASH;
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-3)}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  return `${value.toFixed(1)}%`;
}

export function formatAge(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return DASH;
  if (seconds < 1) return `${seconds.toFixed(1)}s`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds / 60)}m`;
}

export function utcClock(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} UTC`;
}
