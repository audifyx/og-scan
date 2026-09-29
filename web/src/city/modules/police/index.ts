/**
 * OrbitXCity — Police module public API.
 *
 * Self-contained: no imports from other modules, core, or `@/tokenomics/*`.
 * The integrator supplies identity, the paper-CITY ledger port, the
 * pursuit world port, and (when ready) the tokenomics billing provider;
 * see MODULE.md.
 */

export { PolicePanel, POLICE_PANEL_ID } from "./PolicePanel";
export type { PolicePanelProps } from "./PolicePanel";

export { WantedBadge } from "./WantedBadge";
export type { WantedBadgeProps } from "./WantedBadge";

export {
  PoliceStore,
  getPoliceStore,
  POLICE_STORAGE_KEY,
  CRIME_HEAT,
  UNWITNESSED_FACTOR,
  BRIBE_PRICE,
  FINE_PER_STAR,
  CREW_BAIL_PER_STAR,
  SENTENCE_SEC_PER_STAR,
  DECAY_IN_SIGHT,
  DECAY_EVADED,
  COURT_ROUNDS,
  heatToStars,
  repeatOffenderFactor,
  courtThreshold,
} from "./store";
export type { ReportCrimeResult } from "./store";

export { PursuitDirector } from "./ai";

export { usePoliceStore } from "./usePolice";

export {
  CRIME_LABELS,
  COPY,
  starGlyph,
  tacticLabel,
  heatColor,
  fmtCountdown,
  fmtClock,
} from "./ui";

export type {
  WantedStars,
  CrimeKind,
  CrimeReport,
  CrimeRecord,
  RapSheet,
  PaperLedgerPort,
  OrbitxBillingProvider,
  BribeResult,
  FineResult,
  Sentence,
  CourtCase,
  CourtRound,
  PoliceEvent,
  PoliceEventType,
  Vec2,
  PlayerSnapshot,
  CopKind,
  PursuitTactic,
  PursuitEvent,
  PursuitWorldPort,
  CopUnit,
  PursuitSnapshot,
  PolicePorts,
} from "./types";
