/**
 * OrbitXCity — Seasons module public API.
 *
 * Self-contained: no imports from other city modules, no `@/tokenomics/*`.
 * Only external dep: `react`.
 *
 * Registering the built-in sample plugin on module load so the seasonal
 * event framework demonstrably works out of the box.
 */

import { registerSeasonalPlugin } from "./eventFramework";
import doubleXpWeekend from "./plugins/doubleXpWeekend";

registerSeasonalPlugin(doubleXpWeekend);

/* UI */
export { SeasonPassPanel, SEASONS_PANEL_ID } from "./components/SeasonPassPanel";
export { EventBoard } from "./components/EventBoard";

/* Progress store + paper-ORBITX ledger */
export { seasonStore, useSeasonStore, usePaperOrbitxHistory, formatPaperOrbitx } from "./store/seasonStore";

/* Defensive billing adapter (premium entry burn) */
export { useSeasonBilling } from "./billing";
export type { SeasonBilling } from "./billing";

/* Seasonal event framework */
export {
  registerSeasonalPlugin,
  unregisterSeasonalPlugin,
  listSeasonalPlugins,
  dispatchSeasonalEvent,
  emitSeasonalCustom,
  currentXpMultiplier,
  startSeasonalTicker,
  stopSeasonalTicker,
  checkSeasonTransitions,
  getSeasonalContext,
} from "./eventFramework";

/* Season catalog */
export {
  SEASONS,
  XP_PER_TIER,
  MAX_TIERS,
  PREMIUM_ENTRY_COST_ORBITX,
  getSeasonById,
  getSeasonInfo,
  tierForXp,
  formatCountdown,
} from "./data/seasons";

/* Types */
export type {
  RewardTrack,
  PaperOrbitxReward,
  SeasonTier,
  Season,
  SeasonInfo,
  SeasonStatus,
  SeasonProgress,
  PaperOrbitxEntry,
  SeasonBillingProvider,
  SeasonalEventType,
  SeasonalEventPayload,
  SeasonalEventCard,
  SeasonalEventContext,
  SeasonalEventPlugin,
} from "./types";
