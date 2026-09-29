/**
 * OrbitXCity — Heists module public API.
 *
 * Self-contained: no imports from other modules, core, or `@/tokenomics`.
 * The integrator creates one `HeistDirector`, attaches the core world,
 * ticks it from the game loop, and subscribes React UI to snapshots.
 * See MODULE.md for the integration guide, the core API mapping, and the
 * billing seam.
 */

// ---- director (single integration entry point) ----
export { HeistDirector, createHeistDirector } from "./worldHooks";
export type { HeistDirectorOpts } from "./worldHooks";

// ---- engine ----
export { HeistEngine, computeLoot, splitLoot } from "./heistEngine";
export type { PayoutModifiers } from "./heistEngine";

// ---- catalog & templates ----
export { HEIST_CATALOG, getTemplate } from "./missions";

// ---- casino finale ----
export {
  CASINO_TEMPLATE,
  CASINO_APPROACHES,
  VAULT_TIER_LOOT,
  vaultTierFor,
  casinoAlarmRate,
  consumeScheduleIntel,
} from "./casino";
export type { CasinoApproachSpec, VaultTier } from "./casino";

// ---- crew roles & co-op lobby ----
export {
  ROLE_META,
  makeNpcCrew,
  defaultCuts,
  normalizeCuts,
  CoopSession,
} from "./crew";
export type { CoopEvent } from "./crew";

// ---- networking seam (v1: local simulation) ----
export { LocalNet } from "./net";

// ---- armored trucks ----
export { TruckDirector } from "./armored";
export type { TruckDirectorOpts } from "./armored";

// ---- data heists / intel ----
export {
  RIVAL_CREWS,
  FENCES,
  planDataHeist,
  resolveDataOp,
  sellIntel,
  activeIntelBoosts,
  expiredIntel,
} from "./dataHeists";

// ---- paper-CITY ledger ----
export { PaperLedger, heistLedger } from "./ledger";
export type { LedgerEntry } from "./ledger";

// ---- premium billing seam (injected, never imported) ----
export {
  setBillingProvider,
  isBillingReady,
  tryBurnPremium,
  PREMIUM_SKUS,
} from "./billing";
export type { PremiumBurnOpts, PremiumBurnResult } from "./billing";

// ---- 3D FX (additive on the core scene) ----
export { spawnObjectiveBeacon, spawnAlarmPulse } from "./fx";
export type { FxHandle } from "./fx";

// ---- shared types ----
export type {
  HeistKind,
  HeistStage,
  CrewRole,
  Approach,
  CrewMember,
  RoleMeta,
  CasingTask,
  StageObjective,
  StageDef,
  PremiumEntry,
  HeistTemplate,
  HeistPlan,
  SessionStatus,
  HeistSession,
  LootPayout,
  HeistResult,
  IntelEffectKind,
  IntelEffect,
  IntelItem,
  RivalCrew,
  Fence,
  DataOp,
  TruckWaypoint,
  TruckStatus,
  ArmoredTruck,
  BreachResult,
  NetMessage,
  NetAdapter,
  CoopSnapshot,
  HeistPlayerState,
  HeistWorldLike,
  DirectorSnapshot,
} from "./types";
