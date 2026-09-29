/**
 * OrbitXCity — RACING MODULE public API.
 *
 * Street racing circuits (PvP/multiplayer-ready, AI bots v1), midnight
 * pink-slip duels, and desert rally raids. GTA-style, Three.js, realistic.
 *
 * This module is deliberately self-contained: it never imports core/ or any
 * other city module, and never imports `@/tokenomics/*` (it does not exist
 * yet — importing it would break the build). Vehicle access is structural
 * (`VehicleLike`, satisfied by core's `CarPhysics`); the burn path is an
 * injected `IBurnProvider` the integrator adapts from the tokenomics hook
 * once it lands (see MODULE.md).
 */

export type {
  Vec2,
  VehicleLike,
  DriveCommand,
  DriveContext,
  EntrantKind,
  IRacer,
  StreetCircuit,
  RallyRoute,
  RaceStanding,
  RaceResult,
  RaceEvents,
  RacePhase,
} from "./types";

export {
  buildStreetCircuits,
  buildRallyRoutes,
  startGridSlots,
  startHeading,
} from "./tracks";

export {
  RaceSession,
} from "./races";
export type { RaceConfig } from "./races";

export {
  createBotRacer,
  createPlayerRacer,
  createRemoteRacer,
  randomBotProfile,
} from "./ai";
export type { BotProfile } from "./ai";

export {
  RacePool,
  collectEntryBurns,
  createNullBurnProvider,
  randomRef,
} from "./economy";
export type {
  BurnOpts,
  BurnReceipt,
  IBurnProvider,
} from "./economy";

export {
  CarTitleRegistry,
  proposeDuel,
  acceptDuel,
  declineDuel,
  beginDuelRace,
  createDuelRaceSession,
  settleDuel,
  isMidnightWindow,
  dayTToHour,
} from "./pinkSlip";
export type {
  StakedCar,
  DuelState,
  PinkSlipDuel,
  DuelProposal,
  DuelRaceOpts,
  DuelSettlement,
} from "./pinkSlip";

export {
  RallyRaid,
  RallyStageRun,
  fmtRaceTime,
} from "./rally";
export type {
  RallyStageResult,
  RallyOverallRow,
  RallyRaidConfig,
  RallyRaidResult,
} from "./rally";

/**
 * Minimal structural shape of the tokenomics billing hook
 * (`useOrbitxBilling` per web/src/city/BILLING_CONTRACT.md).
 * NOT imported from `@/tokenomics/*` — structural only, per the hard rule.
 */
export interface BillingLike {
  ready: boolean;
  balance: number | null;
  spend: (opts: { amount: number; reason: string; ref?: string }) =>
    Promise<{ signature: string }>;
}

/**
 * Adapt the tokenomics billing hook into the racing module's IBurnProvider.
 * The integrator calls this ONCE (e.g. in the page shell) when billing lands:
 *
 * ```ts
 * import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
 * import { adaptBillingToBurnProvider, createNullBurnProvider } from "@/city/modules/racing";
 * const billing = useOrbitxBilling();
 * const provider = billing?.ready ? adaptBillingToBurnProvider(billing) : createNullBurnProvider();
 * ```
 *
 * Until then, pass `createNullBurnProvider()` — races run in paper-only mode
 * and the UI renders the entry-fee burn as "pending billing".
 */
export function adaptBillingToBurnProvider(billing: BillingLike): import("./economy").IBurnProvider {
  return {
    get ready() {
      return billing.ready;
    },
    get balance() {
      return billing.balance;
    },
    burn: (opts: { amount: number; reason: string; ref: string }) =>
      billing.spend({ amount: opts.amount, reason: opts.reason, ref: opts.ref }),
  };
}
