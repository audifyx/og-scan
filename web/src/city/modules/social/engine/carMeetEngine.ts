/**
 * Weekly docks car-meet engine (paper CITY gameplay).
 *
 * Entry fee goes into the prize pool; judging is deterministic per meet so
 * every client agrees on the winner. NPC regulars seed the field.
 */

import type { CarMeetEntry } from "../types";

export const CAR_MEET_CATEGORIES = ["Stance", "Speed", "Sound", "Classic"] as const;
export type CarMeetCategory = (typeof CAR_MEET_CATEGORIES)[number];
export const CAR_MEET_ENTRY_FEE_CITY = 100;

export const NPC_MEET_ENTRIES: { owner: string; ownerHandle: string; car: string; category: CarMeetCategory }[] = [
  { owner: "Turbo Tess", ownerHandle: "@turbotess", car: "Neon GT-R 'Blitz'", category: "Speed" },
  { owner: "Vice Vic", ownerHandle: "@vicevic", car: "Boardwalk Lowrider 'La Sombra'", category: "Stance" },
  { owner: "Byte Beat", ownerHandle: "@bytebeat", car: "Bass Cannon Civic", category: "Sound" },
  { owner: "Dex Degen", ownerHandle: "@dexdegen", car: "'69 Charger 'Liquidated'", category: "Classic" },
  { owner: "Chart Chef", ownerHandle: "@chartchef", car: "Slammed S2000 'Entry'", category: "Stance" },
];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** 0–100 score. Deterministic: same meet + same car = same score. */
export function scoreEntry(meetId: string, car: string, category: string): number {
  const h = hashStr(`${meetId}:${car.toLowerCase()}:${category}`);
  const base = 45 + (h % 4500) / 100; // 45–90
  const nameBonus = Math.min(8, car.replace(/[^a-z0-9]/gi, "").length / 3);
  return Math.round(Math.min(100, base + nameBonus));
}

export interface JudgedEntry extends CarMeetEntry {
  category: string;
  prizeCity: number;
}

export function judgeMeet(meetId: string, entries: CarMeetEntry[]): JudgedEntry[] {
  const pool = entries.length * CAR_MEET_ENTRY_FEE_CITY;
  const ranked = entries
    .map((e) => ({ ...e, score: scoreEntry(meetId, e.car, (e as { category?: string }).category ?? "Speed") }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const splits = [0.6, 0.25, 0.15];
  return ranked.map((e, i) => ({
    ...e,
    category: (e as { category?: string }).category ?? "Speed",
    prizeCity: i < 3 ? Math.round(pool * splits[i]) : 0,
  }));
}

/** Weekly meet id, e.g. "meet-2026-W40". */
export function currentMeetId(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  // Saturday of this week
  const delta = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const week = Math.ceil(
    ((d.getTime() - new Date(y, 0, 1).getTime()) / 86400000 + 1) / 7
  );
  return `meet-${y}-W${week}`;
}
