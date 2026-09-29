/**
 * Real estate module — shared UI glue for the panels.
 * A single `RealEstateCtx` is threaded through every panel so billing,
 * the paper ledger and the player id never need context plumbing.
 */
import type { PaperLedger } from "../types";
import type { RealEstateBilling } from "../billing";

export interface RealEstateCtx {
  billing: RealEstateBilling;
  ledger: PaperLedger;
  playerId: string;
}

/** "1,234" / "12.5K" compact number formatting. */
export function fmt(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  if (abs >= 100) return `${sign}${Math.round(abs).toLocaleString("en-US")}`;
  return `${sign}${(Math.round(abs * 100) / 100).toLocaleString("en-US")}`;
}

/** "12:34" countdown from ms. */
export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function timeAgo(at: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
