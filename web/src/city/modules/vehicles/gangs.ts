/**
 * OrbitXCity — Vehicles module: biker gangs (MC clubhouses + formation riding).
 *
 * Three clubs, one city. Join a clubhouse to unlock its patch, then ride in
 * formation: the integrator positions wingmen at formation slots relative to
 * the leader each frame. Formation riding boosts gang rep and pays a small
 * paper trickle per clean mile ridden together.
 */
import type { MapPoint, PaperDelta } from "./types";

export interface Clubhouse extends MapPoint {
  clubId: string;
  clubName: string;
  patch: string; // emoji / insignia
  colors: [string, string];
}

export const CLUBHOUSES: Clubhouse[] = [
  { clubId: "iron-saints", clubName: "Iron Saints MC", patch: "⚔️", colors: ["#1a1a1a", "#c0392b"], name: "Iron Saints Clubhouse", x: -88, z: 152, blip: "🏍️ Iron Saints" },
  { clubId: "neon-reapers", clubName: "Neon Reapers MC", patch: "💀", colors: ["#0a0a1a", "#00e5ff"], name: "Neon Reapers Clubhouse", x: 152, z: -136, blip: "🏍️ Neon Reapers" },
  { clubId: "dust-vultures", clubName: "Dust Vultures MC", patch: "🦅", colors: ["#2b1d0e", "#e67e22"], name: "Dust Vultures Clubhouse", x: -40, z: -200, blip: "🏍️ Dust Vultures" },
];

/** Formation slots: offsets (meters) behind/right of the leader, staggered. */
export interface FormationSlot {
  slot: number;
  /** Meters behind the leader along heading. */
  back: number;
  /** Meters to the right of the leader (negative = left). */
  side: number;
}

/** Classic staggered V: leader, then pairs alternating sides. */
export function formationSlots(riders: number): FormationSlot[] {
  const slots: FormationSlot[] = [{ slot: 0, back: 0, side: 0 }];
  for (let i = 1; i < riders; i++) {
    const row = Math.ceil(i / 2);
    const side = i % 2 === 1 ? 2.2 : -2.2;
    slots.push({ slot: i, back: row * 4.5, side });
  }
  return slots;
}

/** World-space target for a formation slot given the leader transform. */
export function formationTarget(
  leaderX: number, leaderZ: number, leaderHeading: number, slot: FormationSlot,
): { x: number; z: number; heading: number } {
  // heading convention matches core CarPhysics: forward = (sin h, cos h)
  const fx = Math.sin(leaderHeading);
  const fz = Math.cos(leaderHeading);
  const rx = fz; // right vector
  const rz = -fx;
  return {
    x: leaderX - fx * slot.back + rx * slot.side,
    z: leaderZ - fz * slot.back + rz * slot.side,
    heading: leaderHeading,
  };
}

export type GangRank = "prospect" | "patched" | "enforcer" | "road-captain" | "president";

export interface GangMember {
  name: string;
  rank: GangRank;
  /** Riding skill 0..1 (affects AI wingman tightness). */
  skill: number;
}

export interface GangState {
  clubId: string;
  rep: number; // 0..1000
  members: GangMember[];
  joinedAt: number;
}

const MEMBER_NAMES = [
  "Rook", "Vex", "Mama", "Torque", "Sable", "Havoc", "Priest", "Jinx",
  "Dagger", "Lo", "Brutus", "Nova",
];

export function joinGang(clubId: string): GangState {
  const members: GangMember[] = Array.from({ length: 5 }, (_, i) => ({
    name: MEMBER_NAMES[Math.floor(Math.random() * MEMBER_NAMES.length)],
    rank: (["prospect", "patched", "patched", "enforcer", "road-captain"] as GangRank[])[i],
    skill: 0.4 + Math.random() * 0.5,
  }));
  return { clubId, rep: 0, members, joinedAt: Date.now() };
}

export function clubhouseOf(clubId: string): Clubhouse {
  const c = CLUBHOUSES.find((x) => x.clubId === clubId);
  if (!c) throw new Error(`Unknown club: ${clubId}`);
  return c;
}

/**
 * Formation-ride payout: clean miles ridden in formation pay paper CITY.
 * The integrator calls this when a formation ride ends.
 */
export function formationRidePayout(miles: number, ridersInFormation: number): PaperDelta {
  const amount = Math.floor(miles * 12 * Math.min(ridersInFormation, 6));
  return {
    amount,
    label: `Formation ride — ${miles.toFixed(1)} mi with ${ridersInFormation} riders`,
    source: "vehicles:gangs",
  };
}

/** Rep gain for a clean formation mile. */
export function repForMile(clean: boolean): number {
  return clean ? 4 : 1;
}
