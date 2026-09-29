/**
 * Heist catalog — the plannable jobs on the board.
 * The casino finale lives in casino.ts and is merged here.
 */
import { CASINO_TEMPLATE } from "./casino";
import type { HeistTemplate } from "./types";

const NEON_PAWN: HeistTemplate = {
  id: "neon-pawn",
  kind: "store",
  name: "Neon Pawn",
  tagline: "A quiet register job to learn the ropes.",
  description:
    "The pawn shop on Vice Row keeps the weekend take in a back safe. In and out before the single guard finishes his round. Perfect first score.",
  difficulty: 1,
  minCrew: 1,
  maxCrew: 2,
  suggestedRoles: ["leader", "ghost"],
  approaches: ["silent", "smart"],
  baseLootCity: 1200,
  heatGain: 15,
  cooldownSec: 300,
  locationLabel: "Neon Pawn — Vice Row",
  casing: [
    { id: "np_guard", label: "Clock the guard's patrol", hint: "Watch from the noodle bar across the street" },
    { id: "np_safe", label: "Photograph the safe model", hint: "Pretend to pawn a watch" },
  ],
  stages: [
    { stage: "casing", label: "Casing", objectives: [], tip: "Two tasks. Ten minutes." },
    { stage: "crew", label: "Crew", objectives: [], tip: "Soloable." },
    { stage: "setup", label: "Setup", objectives: [], tip: "Grab a burner car." },
    {
      stage: "execution",
      label: "The Job",
      objectives: ["Slip in the back", "Crack the safe", "Walk out clean"],
      tip: "Silent keeps the heat at zero.",
    },
    {
      stage: "getaway",
      label: "Getaway",
      objectives: ["Reach the safehouse"],
      tip: "No need to speed — just don't be seen.",
    },
    { stage: "cooldown", label: "Lay low", objectives: ["Wait out the heat"] },
  ],
};

const VICE_VAULT: HeistTemplate = {
  id: "vice-vault",
  kind: "bank",
  name: "Vice Vault Bank",
  tagline: "The mid-tier score every crew dreams about.",
  description:
    "Vice Vault's downtown branch moves serious cash on Fridays. Silent means drilling the vault at 3am; loud means the front doors at noon; smart means a forged cash delivery.",
  difficulty: 3,
  minCrew: 2,
  maxCrew: 4,
  suggestedRoles: ["leader", "hacker", "muscle", "driver"],
  approaches: ["silent", "loud", "smart"],
  baseLootCity: 12000,
  heatGain: 55,
  cooldownSec: 900,
  locationLabel: "Vice Vault — Downtown",
  intelReward: true,
  casing: [
    { id: "vv_cams", label: "Map camera coverage", hint: "Hacker: tap the traffic cams nearby" },
    { id: "vv_vault", label: "Identify the vault model", hint: "Tour the safety-deposit floor" },
    { id: "vv_shift", label: "Learn guard shift changes", hint: "Stakeout the loading dock" },
  ],
  stages: [
    { stage: "casing", label: "Casing", objectives: [], tip: "Full casing unlocks the drill shortcut." },
    { stage: "crew", label: "Crew", objectives: [], tip: "Hacker + driver minimum." },
    { stage: "setup", label: "Setup", objectives: [], tip: "Drill rig (silent) or forged van (smart)." },
    {
      stage: "execution",
      label: "The Vault",
      objectives: ["Enter the branch", "Control the floor", "Drill / crack the vault", "Load the bags"],
      tip: "Every extra bag is extra heat.",
    },
    {
      stage: "getaway",
      label: "Getaway",
      objectives: ["Break line of sight", "Reach the safehouse"],
      tip: "Swap cars at the canal tunnel.",
    },
    { stage: "cooldown", label: "Lay low", objectives: ["Wait out the heat"] },
  ],
};

const SERVER_FARM: HeistTemplate = {
  id: "server-farm",
  kind: "data",
  name: "Rooftop Server Farm",
  tagline: "Steal alpha, not cash.",
  description:
    "A rival crew runs a trading-signal relay from a downtown rooftop. Hit the relay, pull their alpha feeds, and fence the intel — or keep it and run their plays yourself.",
  difficulty: 2,
  minCrew: 1,
  maxCrew: 3,
  suggestedRoles: ["leader", "hacker", "ghost"],
  approaches: ["silent", "smart"],
  baseLootCity: 2500,
  heatGain: 25,
  cooldownSec: 600,
  locationLabel: "Relay rooftop — Downtown",
  intelReward: true,
  casing: [
    { id: "sf_access", label: "Find roof access", hint: "Service elevator code changes weekly" },
    { id: "sf_signals", label: "Sniff the relay traffic", hint: "Hacker: park a scanner van nearby" },
  ],
  stages: [
    { stage: "casing", label: "Casing", objectives: [], tip: "Signals tell you when the relay is unmanned." },
    { stage: "crew", label: "Crew", objectives: [], tip: "Hacker doubles the intel haul." },
    { stage: "setup", label: "Setup", objectives: [], tip: "Burner drives for the exfil." },
    {
      stage: "execution",
      label: "The Pull",
      objectives: ["Reach the relay", "Clone the alpha feeds", "Wipe your trace"],
      tip: "Wiping the trace keeps rival retaliation down.",
    },
    {
      stage: "getaway",
      label: "Getaway",
      objectives: ["Exfil with the drives"],
      tip: "Intel is weightless — travel light.",
    },
    { stage: "cooldown", label: "Lay low", objectives: ["Wait out the heat"] },
  ],
};

export const HEIST_CATALOG: HeistTemplate[] = [NEON_PAWN, VICE_VAULT, SERVER_FARM, CASINO_TEMPLATE];

export function getTemplate(id: string): HeistTemplate | undefined {
  return HEIST_CATALOG.find((t) => t.id === id);
}
