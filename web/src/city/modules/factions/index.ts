/**
 * ORBITXCITY — Factions module: public surface.
 *
 * Trading firms, turf wars, graffiti crews, graffiti wars, mayoral elections.
 * Single import point for integrators: `import { ... } from "@/city/modules/factions"`.
 *
 * RULES (module law):
 *  - No imports from other city modules. No `@/tokenomics/*` imports
 *    (billing primitives don't exist yet; see BILLING_CONTRACT.md).
 *  - Paper CITY for gameplay; real ORBITX (burned, backend-signed) for
 *    premium — the settlement hook is `settleVotes` in elections.ts,
 *    inert until the tokenomics team ships primitives.
 *  - Game never custodies keys or funds.
 */

export type {
  FactionId,
  FactionDef,
  RankDef,
  PlayerFactionProfile,
  BlockCell,
  District,
  TurfWar,
  GraffitiWall,
  GraffitiTag,
  GraffitiWar,
  ElectionCandidate,
  Election,
  MayorOffice,
  FactionsState,
} from "./types";

/* firms */
export {
  FACTIONS,
  FACTION_IDS,
  RANKS,
  faction,
  rankForRep,
  repToNextRank,
  blankProfile,
  joinFaction,
  leaveFaction,
  awardRep,
  contributeToFirm,
} from "./factions";

/* turf */
export {
  buildDistricts,
  blockCenter,
  districtAt,
  tickDistricts,
  declareWar,
  stakeBonds,
  resolveWarRound,
  activeWars,
  FEE_SHARE_PCT,
} from "./turf";

/* graffiti */
export {
  buildWalls,
  tagStyle,
  tagWall,
  overpaintTags,
  wallBuffPct,
  challengeCrew,
  startWar,
  addWarTag,
  judgeWar,
  makeTagDecal,
  makeBlankDecal,
  placeWallDecal,
  TAG_COST,
  OVERPAINT_COST,
  WALL_BUFF_PCT,
  MAX_WALL_BUFF,
} from "./graffiti";

/* elections */
export {
  newElection,
  seedCandidates,
  registerCandidate,
  castVote,
  settleVotes,
  tally,
  seatMayor,
  setBurnTax,
  setFeeShareMultiplier,
  msUntilTermEnd,
  rotateTerm,
  TERM_MS,
  VOTE_COST_ORBITX,
  MAX_BURN_TAX_PCT,
  MAX_FEE_MULT,
} from "./elections";

/* state + react + ui */
export { FactionsStore, getFactionsStore, initialState } from "./store";
export { useFactions, playerLabel, setPlayerLabel } from "./useFactions";
export { FactionsRoot, FirmBadge } from "./FactionsUI";
