/**
 * Data heists — steal alpha (intel) from rival crews instead of cash.
 *
 * Intel items are loot with a double life: fence them for paper CITY, or
 * hold them for passive heist buffs (casing boosts, heat cuts, and the
 * casino vault schedule). Intel expires — alpha decays.
 */
import type { DataOp, Fence, IntelEffect, IntelItem, RivalCrew } from "./types";
import type { PaperLedger } from "./ledger";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export const RIVAL_CREWS: RivalCrew[] = [
  {
    id: "velvet-serpents",
    name: "Velvet Serpents",
    territory: "Strip clubs & lounges",
    difficulty: 2,
    color: "#c026d3",
    blurb: "Run the Strip's guest lists — and a quiet signal-relay skimming trades.",
  },
  {
    id: "harbor-kings",
    name: "Harbor Kings",
    territory: "Docks & warehouses",
    difficulty: 3,
    color: "#0ea5e9",
    blurb: "Smugglers with a logistics AI that predicts patrol gaps. Steal the model.",
  },
  {
    id: "neon-cartel",
    name: "Neon Cartel",
    territory: "Downtown rooftops",
    difficulty: 4,
    color: "#f43f5e",
    blurb: "The biggest relay in the city. Military-grade countermeasures.",
  },
  {
    id: "ghost-ledger",
    name: "Ghost Ledger",
    territory: "Unknown",
    difficulty: 5,
    color: "#a3a3a3",
    blurb: "Nobody has seen them. Their alpha feed is the stuff of legend.",
  },
];

export const FENCES: Fence[] = [
  {
    id: "fence-mira",
    name: "Mira",
    specialty: "Signal alpha & trade feeds",
    demand: { 1: 1.0, 2: 1.25, 3: 1.6 },
    cut: 0.15,
  },
  {
    id: "fence-otto",
    name: "Otto",
    specialty: "Patrol schedules & routes",
    demand: { 1: 1.2, 2: 1.1, 3: 1.0 },
    cut: 0.1,
  },
  {
    id: "fence-ledger",
    name: "The Ledger",
    specialty: "High-tier only, no questions",
    demand: { 1: 0.8, 2: 1.2, 3: 1.9 },
    cut: 0.25,
  },
];

const INTEL_NAMES: Record<string, string[]> = {
  "velvet-serpents": ["Guest-list skim logs", "Lounge cash-route map", "VIP blackmail ledger"],
  "harbor-kings": ["Patrol-gap predictor weights", "Dock manifest cipher", "Smuggler tide table"],
  "neon-cartel": ["Relay alpha feed (24h)", "Countermeasure bypass keys", "Cartel dead-drop schedule"],
  "ghost-ledger": ["Ghost alpha feed (1h)", "Phantom wallet cluster", "Zero-day exchange exploit"],
};

const INTEL_EFFECTS: IntelEffect[] = [
  { kind: "casing-boost", magnitude: 0.25, label: "+25% casing speed on next heist" },
  { kind: "heat-cut", magnitude: 0.3, label: "-30% heat gain on next heist" },
  { kind: "casino-schedule", magnitude: 0.5, label: "Casino vault schedule — halves alarm gain" },
  { kind: "fence-bonus", magnitude: 0.2, label: "+20% fence prices for 24h" },
];

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** plan a data op against a rival crew */
export function planDataHeist(crewId: string): DataOp | null {
  const crew = RIVAL_CREWS.find((c) => c.id === crewId);
  if (!crew) return null;
  return {
    id: uid("dataop"),
    crewId,
    name: `${crew.name} relay hit`,
    objectives: [
      `Infiltrate the ${crew.territory} relay`,
      "Clone the alpha feeds",
      "Wipe your trace",
      "Exfil with the drives",
    ],
    guardCount: crew.difficulty,
    intelDrops: Math.min(3, Math.max(1, Math.round(crew.difficulty / 2))),
  };
}

function randomEffect(): IntelEffect {
  const e = INTEL_EFFECTS[Math.floor(Math.random() * INTEL_EFFECTS.length)];
  return { ...e };
}

/** resolve a data op — returns the intel pulled */
export function resolveDataOp(op: DataOp, opts: { wipedTrace: boolean; hackerBonus: boolean }): IntelItem[] {
  const names = INTEL_NAMES[op.crewId] ?? ["Stolen alpha feed"];
  const crew = RIVAL_CREWS.find((c) => c.id === op.crewId);
  const tier = Math.min(3, Math.max(1, Math.round((crew?.difficulty ?? 2) / 2))) as 1 | 2 | 3;
  const drops = op.intelDrops + (opts.hackerBonus ? 1 : 0);
  const items: IntelItem[] = [];
  for (let i = 0; i < drops; i++) {
    items.push({
      id: uid("intel"),
      name: names[Math.floor(Math.random() * names.length)],
      tier,
      crewId: op.crewId,
      valueCity: Math.round((800 * tier + Math.random() * 1200 * tier) * (opts.wipedTrace ? 1.2 : 1)),
      expiresAt: Date.now() + WEEK_MS,
      effect: randomEffect(),
    });
  }
  return items;
}

/** sell intel to a fence — credits paper CITY, returns the payout */
export function sellIntel(item: IntelItem, fenceId: string, ledger: PaperLedger): number {
  const fence = FENCES.find((f) => f.id === fenceId);
  if (!fence) return 0;
  const now = Date.now();
  const expired = item.expiresAt < now;
  const freshness = expired ? 0.25 : 1;
  const payout = Math.round(item.valueCity * (fence.demand[item.tier] ?? 1) * (1 - fence.cut) * freshness);
  ledger.credit(payout, `fenced intel: ${item.name} → ${fence.name}`);
  return payout;
}

/** aggregate live (unexpired, unused) intel effects for payout modifiers */
export function activeIntelBoosts(intel: IntelItem[]): { casingBoost: number; heatCut: number; fenceBonus: number } {
  const now = Date.now();
  const live = intel.filter((i) => !i.used && i.expiresAt > now);
  return {
    casingBoost: live.filter((i) => i.effect.kind === "casing-boost").reduce((s, i) => s + i.effect.magnitude, 0),
    heatCut: Math.min(
      0.6,
      live.filter((i) => i.effect.kind === "heat-cut").reduce((s, i) => s + i.effect.magnitude, 0),
    ),
    fenceBonus: live.filter((i) => i.effect.kind === "fence-bonus").reduce((s, i) => s + i.effect.magnitude, 0),
  };
}

export function expiredIntel(intel: IntelItem[]): IntelItem[] {
  const now = Date.now();
  return intel.filter((i) => i.expiresAt < now);
}
