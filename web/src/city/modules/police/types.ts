/**
 * OrbitXCity — Police module types.
 *
 * Self-contained: no imports from other modules, core, or `@/tokenomics/*`.
 * All integration surfaces are ports (dependency injection) defined here;
 * the integrator implements them against the world / economy / billing.
 */

/** Wanted stars 0 (clean) through 5 (maximum heat). */
export type WantedStars = 0 | 1 | 2 | 3 | 4 | 5;

/** Kinds of crime the world (and other modules) can report. */
export type CrimeKind =
  | "petty_theft" // shoplifting, snatch-and-run
  | "assault_ped" // hurting a civilian
  | "grand_theft_auto" // carjacking a driven/parked car
  | "assault_officer" // hurting a cop
  | "kill_officer" // killing a cop
  | "reckless_driving" // speeding through traffic / running peds down
  | "heist_offense" // bank / store robbery (reported by heists module)
  | "jailbreak"; // escaping custody / breaking someone out

export interface CrimeReport {
  kind: CrimeKind;
  /** True when a cop or civilian visibly witnessed it (full heat). False → suspicion only. */
  witnessed: boolean;
  /** Optional world coordinates, for the AI's last-known-position logic. */
  x?: number;
  z?: number;
  /** Free text for the rap sheet, e.g. "Grand theft auto — Vinewood Blvd". */
  label?: string;
}

export interface CrimeRecord extends CrimeReport {
  id: string;
  at: number; // Date.now()
  heatAdded: number; // actual heat added after modifiers
}

export interface RapSheet {
  /** Lifetime reported offenses (heat-bearing). */
  offenses: number;
  /** Times busted / convicted. */
  convictions: number;
  /** Times escaped custody. */
  escapes: number;
  /** Times bought out of heat with an ORBITX bribe. */
  bribes: number;
  /** Times talked out of charges in court. */
  acquittals: number;
  /** Total ORBITX burned on bribes (lifetime). */
  orbitxBurnedOnBribes: number;
  /** Total paper CITY paid in fines/bail (lifetime). */
  cityPaidInFines: number;
}

/** Paper-CITY ledger port — same shape as the bounty module's. */
export interface PaperLedgerPort {
  getBalance: () => number;
  debit: (amount: number, label: string) => Promise<boolean>;
  credit: (amount: number, label: string) => Promise<boolean>;
}

/**
 * ORBITX billing provider — verbatim copy of
 * `web/src/city/BILLING_CONTRACT.md` (self-containment rule forbids importing
 * `@/tokenomics/*`). The integrator passes the real hook's return value;
 * until `web/src/tokenomics/useOrbitxBilling` exists, bribes render in
 * "auth required / coming soon" state.
 */
export interface OrbitxBillingProvider {
  /** Auth-once complete, backend spendable. */
  ready: boolean;
  /** On-chain ORBITX in the in-app wallet. */
  balance: number | null;
  spend: (opts: {
    amount: number; // whole ORBITX tokens
    reason: string; // e.g. "city:police-bribe"
    ref?: string; // idempotency / ledger ref
  }) => Promise<{ signature: string }>; // backend-signed burn tx signature
  /** Kicks the dashboard auth-code flow if not authed. */
  beginAuth: () => void;
}

export interface BribeResult {
  ok: boolean;
  error?: "not_wanted" | "billing_not_ready" | "billing_failed" | "insufficient_balance";
  signature?: string;
  amount?: number; // ORBITX burned
}

/** Paper fine payment outcome. */
export interface FineResult {
  ok: boolean;
  error?: "no_fine_due" | "insufficient_city";
  amount?: number; // paper CITY paid
}

/** Prison sentence state. */
export interface Sentence {
  id: string;
  stars: number;
  /** Total real-seconds to serve. */
  durationSec: number;
  /** Seconds remaining. */
  remainingSec: number;
  /** When the sentence started (Date.now). */
  startedAt: number;
  /** Busted location label, for flavor. */
  location?: string;
  status: "serving" | "served" | "escaped";
}

/** Court case state. */
export interface CourtCase {
  id: string;
  stars: number;
  /** Real timestamp the hearing starts (Date.now ms). */
  hearingAt: number;
  /** Paper CITY fine if you just pay. */
  fineCity: number;
  status: "pending" | "acquitted" | "convicted" | "paid" | "missed";
}

/** One round of the court minigame. */
export interface CourtRound {
  prompt: string;
  options: { id: string; text: string; points: number }[];
}

/** Lifecycle events, persisted for the rap-sheet / history UI. */
export type PoliceEventType =
  | "crime"
  | "heat_changed"
  | "wanted_cleared"
  | "bribe_paid"
  | "bribe_failed"
  | "busted"
  | "sentence_started"
  | "sentence_served"
  | "jailbreak"
  | "jailbreak_failed"
  | "crew_bail"
  | "fine_paid"
  | "court_scheduled"
  | "court_acquitted"
  | "court_convicted"
  | "court_paid"
  | "court_missed";

export interface PoliceEvent {
  id: string;
  at: number;
  type: PoliceEventType;
  detail: string;
}

/* ------------------------------------------------------------------ */
/* Pursuit AI ports                                                    */
/* ------------------------------------------------------------------ */

/** Minimal 2D vector (the city is flat — y handled by core). */
export interface Vec2 {
  x: number;
  z: number;
}

export interface PlayerSnapshot {
  pos: Vec2;
  onFoot: boolean;
  /** m/s */
  speed: number;
  /** radians, direction of travel */
  heading: number;
}

export type CopKind = "foot" | "cruiser";

export type PursuitTactic =
  | "search" // wandering last-known position
  | "chase" // closing on the player
  | "pit" // cruiser alongside player's car, forcing slowdown
  | "roadblock" // cruisers forming a wall ahead of the player
  | "spike"; // spike strip deployed ahead (flavor + slowdown events)

/** Events the director emits; the integrator applies them to the world. */
export type PursuitEvent =
  | { type: "bust_imminent"; reason: "foot" | "vehicle" }
  | { type: "pit_hit"; copId: string } // cruiser slammed the player: integrator slows the car
  | { type: "spike_hit" } // player crossed the spike strip: integrator pops tires (slows car)
  | { type: "lost_sight" } // cops lost the player; heat decays faster
  | { type: "spotted" }; // cops re-acquired the player

/**
 * World port for the pursuit simulation. The integrator implements this
 * against `GTAWorld` (see MODULE.md §"Core needs"). The director never
 * moves the player — additive cop visuals only.
 */
export interface PursuitWorldPort {
  player: () => PlayerSnapshot;
  /** Create a cop visual; returns an id the director uses in moveCop/despawnCop. */
  spawnCop: (kind: CopKind) => string;
  despawnCop: (id: string) => void;
  moveCop: (id: string, pos: Vec2, heading: number) => void;
  /** True when the segment between a and b is blocked (optional; defaults to false). */
  lineOfSightClear?: (a: Vec2, b: Vec2) => boolean;
  /** Emit-style sink for pursuit events (HUD, audio, slowdown effects). */
  onEvent: (ev: PursuitEvent) => void;
}

/** Serialized cop unit (owned by the director). */
export interface CopUnit {
  id: string;
  kind: CopKind;
  pos: Vec2;
  heading: number;
  speed: number;
  tactic: PursuitTactic;
  /** World position the unit is converging on (player pos or last-known). */
  target: Vec2;
  /** Seconds since the unit last saw the player. */
  lastSeenAgo: number;
  /** Cooldown before this unit can PIT again. */
  pitCooldown: number;
}

/** Snapshot the HUD panel reads each frame. */
export interface PursuitSnapshot {
  active: boolean;
  unitCount: number;
  tactic: PursuitTactic;
  /** Closest cop distance, meters. */
  closest: number;
}

export interface PolicePorts {
  paper: PaperLedgerPort;
  billing?: OrbitxBillingProvider;
}
