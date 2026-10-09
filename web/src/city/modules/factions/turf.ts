/**
 * ORBITXCITY — Factions module: turf districts + turf wars.
 *
 * The 5x5 city grid (core CityBuilder) is carved into 5 named districts.
 * Firms battle for district control; the controlling firm skims a fee
 * share off the district's paper CITY yield.
 *
 * Geometry constants mirror core CityBuilder (self-contained, no core
 * imports): BLOCKS=5, BLOCK=64, ROAD_W=14, PITCH=78, CITY_SPAN=404, HALF=202.
 * Block (bi,bj) center: x = -HALF + ROAD_W + bi*PITCH + BLOCK/2.
 */
import type { District, FactionId, TurfWar } from "./types";
import { FACTION_IDS } from "./factions";

const HALF = 202;
const ROAD_W = 14;
const BLOCK = 64;
const PITCH = 78;

/** World-space center of block (bi, bj), y=0. */
export function blockCenter(bi: number, bj: number): { x: number; z: number } {
  return { x: -HALF + ROAD_W + bi * PITCH + BLOCK / 2, z: -HALF + ROAD_W + bj * PITCH + BLOCK / 2 };
}

/** Which district owns block (bi,bj). */
export function districtAt(
  bi: number,
  bj: number,
  districts: District[]
): District | null {
  return districts.find((d) => d.blocks.some((b) => b.bi === bi && b.bj === bj)) ?? null;
}

/** Controller skim: % of district yield the controlling firm takes. */
export const FEE_SHARE_PCT = 0.15;
/** Mayor's fee-share multiplier applies on top (1.0 default, up to 2.0). */

function initialInfluence(): Record<FactionId, number> {
  return { bulls: 25, bears: 25, whales: 25, apes: 25 };
}

export function buildDistricts(): District[] {
  const defs: Array<{
    id: string;
    name: string;
    blurb: string;
    cells: [number, number][];
    yieldPerHour: number;
  }> = [
    {
      id: "old-town",
      name: "Old Town",
      blurb: "Brick tenements and corner bodegas. First ink on these walls.",
      cells: [[0, 0], [0, 1], [1, 0], [1, 1], [0, 2]],
      yieldPerHour: 120,
    },
    {
      id: "skyline",
      name: "Skyline Heights",
      blurb: "Glass towers, rooftop deals, the money end of town.",
      cells: [[3, 0], [4, 0], [2, 0], [3, 1], [4, 1]],
      yieldPerHour: 200,
    },
    {
      id: "foundry",
      name: "The Foundry",
      blurb: "Industrial heart. Every firm wants the center.",
      cells: [[1, 2], [2, 1], [2, 2], [2, 3], [3, 2]],
      yieldPerHour: 180,
    },
    {
      id: "docks",
      name: "Neon Docks",
      blurb: "Warehouses and night markets glowing on the water.",
      cells: [[0, 3], [1, 3], [0, 4], [1, 4], [2, 4]],
      yieldPerHour: 150,
    },
    {
      id: "mirage",
      name: "The Mirage",
      blurb: "Casinos, arcades, and paper that moves fast.",
      cells: [[3, 3], [4, 3], [3, 4], [4, 4], [4, 2]],
      yieldPerHour: 170,
    },
  ];
  return defs.map((d) => {
    const blocks = d.cells.map(([bi, bj]) => ({ bi, bj }));
    const cx = blocks.reduce((s, b) => s + blockCenter(b.bi, b.bj).x, 0) / blocks.length;
    const cz = blocks.reduce((s, b) => s + blockCenter(b.bi, b.bj).z, 0) / blocks.length;
    return {
      id: d.id,
      name: d.name,
      blurb: d.blurb,
      blocks,
      center: { x: cx, z: cz },
      controller: null,
      influence: initialInfluence(),
      feePot: 0,
      yieldPerHour: d.yieldPerHour,
    };
  });
}

/**
 * Tick the economy: accrue yield into each district fee pot,
 * then skim the controller's share. `feeShareMult` comes from the mayor.
 * Returns the skimmed amounts per faction (paper CITY).
 */
export function tickDistricts(
  districts: District[],
  dtHours: number,
  feeShareMult = 1
): { districts: District[]; skim: Record<FactionId, number> } {
  const skim: Record<FactionId, number> = { bulls: 0, bears: 0, whales: 0, apes: 0 };
  const next = districts.map((d) => {
    const earned = d.yieldPerHour * dtHours;
    let feePot = d.feePot + earned;
    if (d.controller) {
      const take = Math.floor(earned * FEE_SHARE_PCT * feeShareMult);
      skim[d.controller] += take;
      feePot -= take;
    }
    return { ...d, feePot };
  });
  return { districts: next, skim };
}

/**
 * Declare a turf war. Attacker stakes paper CITY war bonds; the defender
 * is the current controller (or null for unclaimed streets).
 */
export function declareWar(
  district: District,
  attacker: FactionId,
  stake: number,
  id: string
): TurfWar {
  return {
    id,
    districtId: district.id,
    attacker,
    defender: district.controller,
    bonds: { [attacker]: Math.max(0, Math.floor(stake)) },
    roundsLeft: 3,
    createdAt: Date.now(),
    status: "open",
    log: [`${attacker} threw down for ${district.name} — ${stake} CITY on the line.`],
  };
}

/** Add war bonds for a side. Only firms in the fight may stake. */
export function stakeBonds(war: TurfWar, side: FactionId, amount: number): TurfWar {
  if (war.status === "resolved") return war;
  if (side !== war.attacker && side !== war.defender) return war;
  const cur = war.bonds[side] ?? 0;
  const bonds = { ...war.bonds, [side]: cur + Math.max(0, Math.floor(amount)) };
  return { ...war, status: "fighting", bonds };
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Resolve one war round. Power = influence + bonds/10 + member noise.
 * When rounds run out, the winner takes the district and the pot.
 * Deterministic per (war.id, round) so every client judges the same war.
 */
export function resolveWarRound(war: TurfWar, district: District): { war: TurfWar; district: District } {
  if (war.status === "resolved" || war.roundsLeft <= 0) return { war, district };
  const round = 4 - war.roundsLeft; // 1..3
  const rand = mulberry(hashStr(war.id) + round * 7919);

  const power = (side: FactionId | null): number => {
    if (!side) return 0;
    const inf = district.influence[side] ?? 0;
    const bonds = (war.bonds[side] ?? 0) / 10;
    const noise = rand() * 12; // street chaos
    return inf + bonds + noise;
  };

  const aP = power(war.attacker);
  const dP = power(war.defender);
  const roundWinner: FactionId | null =
    aP === dP ? null : aP > dP ? war.attacker : war.defender;

  const log = [...war.log];
  log.push(
    `Round ${round}: ${war.attacker} ${aP.toFixed(1)} vs ${war.defender ?? "the streets"} ${dP.toFixed(1)}` +
      (roundWinner ? ` — ${roundWinner} takes the round.` : " — dead heat, nobody moves.")
  );

  // shift influence a little toward the round winner
  const influence = { ...district.influence };
  if (roundWinner) {
    for (const f of FACTION_IDS) influence[f] = Math.max(0, influence[f] - 2);
    influence[roundWinner] = Math.min(100, influence[roundWinner] + 6);
  }
  const d2 = { ...district, influence };

  const roundsLeft = war.roundsLeft - 1;
  if (roundsLeft > 0) {
    return { war: { ...war, status: "fighting", roundsLeft, log }, district: d2 };
  }

  // final: most rounds decide; ties keep the defender (streets keep unclaimed)
  const wins = countRoundWins(log, war.attacker, war.defender);
  const winner: FactionId | null =
    wins.a === wins.d ? war.defender : wins.a > wins.d ? war.attacker : war.defender;

  const pot = Object.values(war.bonds).reduce((s, v) => s + (v ?? 0), 0);
  if (winner) {
    log.push(`${winner} takes ${district.name}! The pot (${pot} CITY) goes to the victors.`);
  } else {
    log.push(`Nobody takes ${district.name}. The streets stay unclaimed; bonds returned.`);
  }
  const finalDistrict = winner ? { ...d2, controller: winner } : d2;
  return {
    war: { ...war, status: "resolved", roundsLeft: 0, log, winner: winner ?? undefined },
    district: finalDistrict,
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function countRoundWins(
  log: string[],
  attacker: FactionId,
  defender: FactionId | null
): { a: number; d: number } {
  let a = 0;
  let d = 0;
  for (const line of log) {
    if (!line.startsWith("Round")) continue;
    if (line.endsWith(` — ${attacker} takes the round.`)) a++;
    else if (defender && line.endsWith(` — ${defender} takes the round.`)) d++;
  }
  return { a, d };
}

/** Open (unresolved) wars for a district. */
export function activeWars(wars: TurfWar[], districtId?: string): TurfWar[] {
  return wars.filter(
    (w) => w.status !== "resolved" && (!districtId || w.districtId === districtId)
  );
}
