/**
 * Casino heist finale — the ultimate co-op mission.
 *
 * Three approaches, three infiltration routes, a vault with loot tiers gated
 * by the hacker, and an alarm meter that punishes sloppy play. Owning the
 * `casino-schedule` intel (from data heists) halves alarm gain.
 */
import type { Approach, HeistTemplate, IntelItem } from "./types";

export const CASINO_TEMPLATE: HeistTemplate = {
  id: "casino-finale",
  kind: "casino",
  name: "The Diamond Vault",
  tagline: "The finale. The house always wins — until tonight.",
  description:
    "The Diamond Casino's vault holds the city's biggest score. Casing reveals three ways in: the roof (silent), the front doors (loud), or the staff entrance in disguise (smart). The vault timer is the whole game — every second inside is alarm.",
  difficulty: 5,
  minCrew: 2,
  maxCrew: 4,
  suggestedRoles: ["leader", "hacker", "muscle", "driver"],
  approaches: ["silent", "loud", "smart"],
  baseLootCity: 60000,
  heatGain: 85,
  cooldownSec: 1800,
  locationLabel: "The Diamond Casino — Strip",
  premiumEntry: { amount: 10, sku: "heist:casino-entry", label: "High-roller buy-in" },
  intelReward: true,
  casing: [
    { id: "cz_cam", label: "Map the camera blind spots", hint: "Rooftop recon at night" },
    { id: "cz_vault", label: "Clock the vault delivery schedule", hint: "Follow the armored truck (data heist intel helps)" },
    { id: "cz_staff", label: "Photograph staff keycards", hint: "Valet parking, 8pm shift change" },
    { id: "cz_escape", label: "Plan the getaway route", hint: "Two exits minimum — the canal is fastest" },
  ],
  stages: [
    {
      stage: "casing",
      label: "Casing",
      objectives: [],
      tip: "Full casing = +30% take. The schedule intel halves alarm gain.",
    },
    { stage: "crew", label: "Assemble the crew", objectives: [], tip: "Hacker is non-negotiable on silent/smart." },
    {
      stage: "setup",
      label: "Setup",
      objectives: [],
      tip: "Buy the approach gear: thermite (loud), EMP (silent), uniforms (smart).",
    },
    {
      stage: "execution",
      label: "The Vault",
      objectives: [
        "Breach the casino floor",
        "Reach the vault antechamber",
        "Crack the vault (hacker)",
        "Grab the loot — watch the timer",
      ],
      tip: "Alarm rises while the vault is open. Leave before 100%.",
    },
    {
      stage: "getaway",
      label: "Getaway",
      objectives: ["Lose the tail", "Reach the safehouse"],
      tip: "Driver bonus is huge here. Speed bleeds heat.",
    },
    { stage: "cooldown", label: "Lay low", objectives: ["Wait out the heat"], tip: "Don't start another score yet." },
  ],
};

export interface CasinoApproachSpec {
  approach: Approach;
  entry: string;
  requiredRole: "hacker" | "muscle" | "ghost";
  alarmRate: number; // alarm %/sec while vault open
  lootMultiplier: number;
  blurb: string;
}

export const CASINO_APPROACHES: Record<Approach, CasinoApproachSpec> = {
  silent: {
    approach: "silent",
    entry: "Rooftop rappel → elevator shaft",
    requiredRole: "hacker",
    alarmRate: 1.6,
    lootMultiplier: 1.2,
    blurb: "No alarms, no witnesses. One mistake and it's over.",
  },
  loud: {
    approach: "loud",
    entry: "Front doors, thermite on the vault",
    requiredRole: "muscle",
    alarmRate: 4.5,
    lootMultiplier: 1.0,
    blurb: "Maximum chaos, maximum speed. Bring muscle.",
  },
  smart: {
    approach: "smart",
    entry: "Staff disguises through the service entrance",
    requiredRole: "ghost",
    alarmRate: 2.4,
    lootMultiplier: 1.1,
    blurb: "Walk in like you own the place. Talk your way past security.",
  },
};

export type VaultTier = "cash" | "gold" | "diamonds";

/** vault loot tiers — hacker skill gates how deep you get before the alarm cooks */
export function vaultTierFor(hackerSkill: number, secondsInside: number): VaultTier {
  const depth = hackerSkill * 12 - secondsInside * 0.8;
  if (depth > 42) return "diamonds";
  if (depth > 22) return "gold";
  return "cash";
}

export const VAULT_TIER_LOOT: Record<VaultTier, number> = {
  cash: 45000,
  gold: 75000,
  diamonds: 120000,
};

/** alarm gain per second while the vault is open */
export function casinoAlarmRate(approach: Approach, intel: IntelItem[]): number {
  const base = CASINO_APPROACHES[approach].alarmRate;
  const now = Date.now();
  const hasSchedule = intel.some(
    (i) => i.effect.kind === "casino-schedule" && !i.used && i.expiresAt > now,
  );
  return hasSchedule ? base * 0.5 : base;
}

/** mark the schedule intel consumed after a casino run */
export function consumeScheduleIntel(intel: IntelItem[]): IntelItem[] {
  const idx = intel.findIndex((i) => i.effect.kind === "casino-schedule" && !i.used);
  if (idx === -1) return intel;
  return intel.map((item, i) => (i === idx ? { ...item, used: true } : item));
}
