/**
 * OrbitXCity — Police module: shared copy/formatting atoms.
 */

import type { CrimeKind, WantedStars } from "./types";

export const CRIME_LABELS: Record<CrimeKind, string> = {
  petty_theft: "Petty theft",
  assault_ped: "Assault (civilian)",
  grand_theft_auto: "Grand theft auto",
  assault_officer: "Assaulting an officer",
  reckless_driving: "Reckless driving",
  heist_offense: "Armed robbery",
  kill_officer: "Killing an officer",
  jailbreak: "Jailbreak",
};

export function starGlyph(stars: WantedStars): string {
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}

export function tacticLabel(tactic: string): string {
  switch (tactic) {
    case "search":
      return "Searching…";
    case "chase":
      return "In pursuit";
    case "pit":
      return "PIT maneuver!";
    case "roadblock":
      return "Roadblock ahead";
    case "spike":
      return "Spike strip ahead";
    default:
      return tactic;
  }
}

export function heatColor(stars: WantedStars): string {
  if (stars === 0) return "#8a8f98";
  if (stars <= 2) return "#f5c518";
  if (stars <= 3) return "#ff8c1a";
  return "#ff3b30";
}

export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export const COPY = {
  bribeGate:
    "Bribes burn real ORBITX (backend-signed, no wallet popups). Auth ORBITX billing once to unlock.",
  bribeConfirm:
    "This burns real ORBITX on-chain. The heat is wiped — no record survives. Confirm?",
  bailConfirm: "Crew bail is paid in paper CITY (gameplay currency, no chain). Confirm?",
  fineConfirm: "Court fines are paper CITY (gameplay currency, no chain). Confirm?",
} as const;
