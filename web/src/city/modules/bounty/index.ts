/**
 * OrbitXCity — Bounty module public API.
 *
 * Self-contained: no imports from other modules or core. The integrator
 * supplies identity, the paper-CITY ledger port, and (when ready) the
 * tokenomics billing provider; see MODULE.md.
 */

export { BountyBoard } from "./BountyBoard";
export type { BountyBoardProps } from "./BountyBoard";

export { PostBountyModal } from "./PostBountyModal";
export type { PostBountyModalProps } from "./PostBountyModal";

export { ClaimBountyModal } from "./ClaimBountyModal";
export type { ClaimBountyModalProps } from "./ClaimBountyModal";

export {
  BountyStore,
  getBountyStore,
  BOUNTY_STORAGE_KEY,
  BOUNTY_DURATIONS,
  MIN_CITY_BOUNTY,
  MIN_ORBITX_BOUNTY,
  MAX_CITY_BOUNTY,
  MAX_ORBITX_BOUNTY,
  MAX_OPEN_BOUNTIES,
} from "./store";
export type { BountyDurationId, PostBountyInput, BountyPorts } from "./store";

export { useBountyStore } from "./useBounties";

export {
  POST_ERROR_COPY,
  CLAIM_ERROR_COPY,
  currencyLabel,
  currencySymbol,
  timeLeft,
} from "./ui";

export type {
  Bounty,
  BountyCurrency,
  BountyStatus,
  BountyTarget,
  BountyEvent,
  BountyPlayer,
  EscrowRecord,
  PaperLedgerPort,
  OrbitxBillingProvider,
  PostBountyResult,
  PostBountyError,
  ClaimBountyResult,
  ClaimBountyError,
  CancelBountyResult,
} from "./types";
