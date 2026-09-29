/**
 * ORBITXCITY — Factions module: shared types.
 * Trading firms, turf, graffiti crews, wars, mayoral elections.
 */

export type FactionId = "bulls" | "bears" | "whales" | "apes";

export interface FactionDef {
  id: FactionId;
  name: string;
  short: string;
  motto: string;
  /** primary brand color (css) */
  color: string;
  /** secondary brand color (css) */
  accent: string;
  /** trading-style passive: description + numeric modifier */
  buff: { label: string; earnPct: number };
  logoSvg: string; // inline SVG path markup (viewBox 0 0 64 64)
}

export interface RankDef {
  name: string;
  rep: number; // rep required to reach this rank
}

export interface PlayerFactionProfile {
  factionId: FactionId | null;
  rank: string;
  rep: number; // paper rep points
  lifetimeContributed: number; // paper CITY contributed to firm causes
  joinedAt: number; // epoch ms
}

/* ------------------------------- turf ---------------------------------- */

export interface BlockCell {
  bi: number; // 0..4
  bj: number; // 0..4
}

export interface District {
  id: string;
  name: string;
  blurb: string;
  blocks: BlockCell[];
  /** world-space center of the district (meters, y=0) */
  center: { x: number; z: number };
  /** current controlling faction (null = unclaimed streets) */
  controller: FactionId | null;
  /** influence 0..100 per faction; sums need not be 100 */
  influence: Record<FactionId, number>;
  /** paper CITY collected in the district fee pot since last payout */
  feePot: number;
  /** paper CITY per hour the district yields when traded in */
  yieldPerHour: number;
}

export interface TurfWar {
  id: string;
  districtId: string;
  attacker: FactionId;
  defender: FactionId | null;
  /** paper CITY staked by each side */
  bonds: Partial<Record<FactionId, number>>;
  /** scheduled contest ticks (rounds); when empty the war resolves */
  roundsLeft: number;
  createdAt: number;
  status: "open" | "fighting" | "resolved";
  winner?: FactionId;
  log: string[];
}

/* ----------------------------- graffiti --------------------------------- */

export interface GraffitiWall {
  id: string;
  name: string;
  districtId: string;
  /** world-space placement */
  pos: { x: number; y: number; z: number; rotY: number };
  width: number;
  height: number;
  /** faction currently holding the wall (null = blank) */
  heldBy: FactionId | null;
  /** total tags ever painted on this wall */
  tagCount: number;
  /** style points of the current piece (decays, buff scales with it) */
  style: number;
}

export interface GraffitiTag {
  id: string;
  wallId: string;
  factionId: FactionId;
  painter: string; // player label
  createdAt: number;
  style: number; // style points added
  overpainted: boolean;
}

export interface GraffitiWar {
  id: string;
  wallId: string;
  crewA: FactionId;
  crewB: FactionId;
  pot: number; // paper CITY prize
  /** seconds the battle runs once started */
  durationSec: number;
  startedAt: number | null;
  status: "challenge" | "live" | "judged";
  /** live tag contributions per crew */
  tagsA: number;
  tagsB: number;
  winner?: FactionId;
  judgeNote?: string;
}

/* ----------------------------- elections -------------------------------- */

export interface ElectionCandidate {
  id: string;
  name: string;
  factionId: FactionId | null; // endorsement; null = independent
  platform: string;
  /** real ORBITX committed (settled when billing lands) */
  votes: number;
  /** votes still pending ORBITX settlement (paper pledges) */
  pendingVotes: number;
}

export interface Election {
  id: string;
  term: number;
  startsAt: number;
  endsAt: number;
  candidates: ElectionCandidate[];
  status: "open" | "tally" | "closed";
  winnerId?: string;
}

export interface MayorOffice {
  holderName: string;
  holderCandidateId: string | null;
  termEndsAt: number;
  /** city burn tax % on premium burns, 0..5 */
  burnTaxPct: number;
  /** paper fee-share multiplier for firms, 1.0..2.0 */
  feeShareMultiplier: number;
}

/* ------------------------------ persistence ------------------------------ */

export interface FactionsState {
  version: 1;
  player: PlayerFactionProfile;
  districts: District[];
  wars: TurfWar[];
  walls: GraffitiWall[];
  tags: GraffitiTag[];
  graffitiWars: GraffitiWar[];
  election: Election;
  office: MayorOffice;
  /** cumulative paper CITY the player's tags/fees earned */
  paperEarned: number;
  feed: { at: number; text: string }[];
}
