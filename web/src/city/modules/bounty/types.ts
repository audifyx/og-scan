/**
 * OrbitXCity — Bounty module shared types.
 *
 * Bounties are posted on rival players' heads. Two currencies:
 *  - CITY   — paper bounty (gameplay only). Escrow = local paper-ledger
 *             debit on post, credit to the hunter on claim, refund to the
 *             poster on expiry/cancel.
 *  - ORBITX — real on-chain bounty. Posting executes a backend-signed burn
 *             spend (no wallet popup, ever); the backend escrows the value
 *             server-side and pays the hunter on claim. The game code never
 *             custodies keys or funds — it only carries the ref + burn
 *             signature and calls backend-signed routes.
 */

export type BountyCurrency = "CITY" | "ORBITX";

export type BountyStatus = "open" | "claimed" | "expired" | "cancelled";

/** The rival player whose head carries the bounty. */
export interface BountyTarget {
  /** Stable player id supplied by the identity/players surface (see MODULE.md). */
  playerId: string;
  /** Display name shown on the board. */
  displayName: string;
}

export interface Bounty {
  id: string;
  target: BountyTarget;
  posterId: string;
  posterName: string;
  currency: BountyCurrency;
  /** CITY = paper coins · ORBITX = whole on-chain tokens */
  amount: number;
  /** Optional taunt / terms, shown on the board. */
  note: string;
  createdAt: number; // epoch ms
  expiresAt: number; // epoch ms
  status: BountyStatus;
  claimedBy?: string; // player id of the hunter
  claimedByName?: string;
  claimedAt?: number; // epoch ms
  /** Idempotency ref used across every backend burn/escrow call for this bounty. */
  escrowRef: string;
  /** Burn tx signature for the ORBITX post spend. */
  burnSignature?: string;
  /** Hunter payout signature returned by the backend claim route (ORBITX). */
  payoutSignature?: string;
  cancelledAt?: number;
  expiredAt?: number;
}

/** One line in the module-local lifecycle log (rendered in the board history tab). */
export interface BountyEvent {
  id: string;
  bountyId: string;
  at: number; // epoch ms
  kind:
    | "posted"
    | "claimed"
    | "expired"
    | "cancelled"
    | "refund"
    | "escrow_failed";
  actorName: string;
  detail: string;
}

/** Escrow bookkeeping entry. Local record only — the actual hold is backend-side. */
export interface EscrowRecord {
  bountyId: string;
  currency: BountyCurrency;
  amount: number;
  /** Idempotency ref shared with the burn tx + backend escrow ledger. */
  ref: string;
  /** Present for ORBITX posts: backend-signed burn signature. */
  burnSignature?: string;
  heldAt: number;
  releasedAt?: number;
  refundedAt?: number;
}

/** Current signed-in player, supplied by the integrator. */
export interface BountyPlayer {
  playerId: string;
  displayName: string;
}

/**
 * Paper-CITY ledger port. Implemented by the integrator from the economy
 * module's paper wallet (e.g. debit/credit helpers around its store). The
 * bounty module never touches economy internals directly — module isolation
 * rule.
 */
export interface PaperLedgerPort {
  /** Whole-coin balance (paper CITY). */
  getBalance: () => number;
  /**
   * Move paper CITY out of the poster's wallet into module escrow.
   * Resolves false when funds are insufficient (no throw expected).
   */
  debit: (amount: number, label: string) => Promise<boolean>;
  /** Return paper CITY to a wallet (refund to poster, payout to hunter). */
  credit: (amount: number, label: string) => Promise<void>;
}

/**
 * Billing primitive provided by the tokenomics team
 * (`web/src/tokenomics/useOrbitxBilling` — see `web/src/city/BILLING_CONTRACT.md`).
 * Duplicated here on purpose: the bounty module is self-contained and may not
 * import other modules. Shape must match the contract exactly; when tokenomics
 * lands, the integrator injects `useOrbitxBilling()` into this interface.
 */
export interface OrbitxBillingProvider {
  /** Auth-once complete; backend can sign spends. */
  ready: boolean;
  /** On-chain ORBITX balance in the in-app wallet. Null = unknown/loading. */
  balance: number | null;
  /** Backend-signed burn spend. No wallet popup, ever. */
  spend: (opts: {
    amount: number; // whole ORBITX tokens
    reason: string; // e.g. "city:bounty:<bountyId>"
    ref?: string; // idempotency / ledger ref
  }) => Promise<{ signature: string }>;
  /** Kicks the dashboard auth-code flow if not authed yet. */
  beginAuth: () => void;
}

/** Result of a posting attempt. */
export type PostBountyResult =
  | { ok: true; bounty: Bounty }
  | { ok: false; error: PostBountyError };

export type PostBountyError =
  | "self_target" // poster is the target
  | "bad_amount" // amount <= 0 or not whole for ORBITX
  | "bad_target" // missing target name
  | "bad_duration" // expiry not in the allowed set
  | "insufficient_paper" // not enough paper CITY
  | "billing_not_ready" // ORBITX billing not authed
  | "billing_failed" // backend spend threw / rejected
  | "store_full"; // safety cap on open bounties hit

/** Result of a claim attempt. */
export type ClaimBountyResult =
  | { ok: true; bounty: Bounty }
  | { ok: false; error: ClaimBountyError };

export type ClaimBountyError =
  | "not_found"
  | "not_open" // already claimed / expired / cancelled
  | "self_claim" // hunter is the poster
  | "backend_pending" // ORBITX payout route not yet available / failed
  | "store_error";

export type CancelBountyResult =
  | { ok: true; bounty: Bounty }
  | { ok: false; error: "not_found" | "not_open" | "not_owner" | "backend_pending" };
