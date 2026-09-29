/**
 * OrbitXCity — Events module public API.
 *
 * The integrator (merge agent) imports ONLY from this file. Everything else
 * in this directory is internal. No imports from other modules; no imports
 * from `@/tokenomics/*` (that directory does not exist yet — see MODULE.md).
 */

// Runtime (the unified server/city event system)
export { EventsSystem, createEventsSystem } from "./system";
export type {
  EventsSystemOptions,
  RugReport,
  EventsSnapshot,
  TickerItem,
} from "./system";

// Director
export { CityEventDirector } from "./eventDirector";
export type { DirectorOptions } from "./eventDirector";

// Real-data triggers
export {
  evaluateMarketTriggers,
  evaluateParadeTrigger,
  createTriggerMemory,
  DEFAULT_TRIGGER_CONFIG,
  DEFAULT_PARADE_GOALS,
} from "./triggers";
export type {
  MarketTriggerConfig,
  TriggerMemory,
  TriggerResult,
  ParadeGoalTier,
} from "./triggers";

// Scenes
export { startAirdropRun, rollCrateLoot } from "./scenes/airdropCrates";
export type {
  AirdropHandle,
  CrateLoot,
  CrateTier,
} from "./scenes/airdropCrates";

export { startEarthquake, quakeLabel } from "./scenes/earthquake";

export { startFireworks, fireworksCopy } from "./scenes/fireworks";
export type { FireworksOptions, FireworkBarge } from "./scenes/fireworks";

export {
  startNightMarket,
  buyMarketItem,
  NIGHT_MARKET_CATALOG,
  NIGHT_MARKET_SPOTS,
  tonightSpot,
  tonightStock,
} from "./scenes/nightMarket";
export type {
  MarketCurrency,
  MarketItem,
  NightMarketSpot,
  PurchaseContext,
} from "./scenes/nightMarket";

export {
  startBlackMarket,
  buyBlackMarketItem,
  BLACK_MARKET_CATALOG,
  BLACK_MARKET_DOCK,
  tonightCode,
  checkCode,
  isBlackMarketOpen,
} from "./scenes/blackMarket";

export { startParade, paradeCopy } from "./scenes/parade";
export type { ParadeOptions } from "./scenes/parade";

export { startProtest, protestCopy } from "./scenes/protests";
export type { ProtestHandle, ProtestOptions } from "./scenes/protests";

export {
  startWeatherController,
  WeatherController,
  WEATHER_INFO,
  WEATHER_DURATION_MS,
  WEATHER_COOLDOWN_MS,
  canControlWeather,
} from "./scenes/weatherMachine";
export type { WeatherState, WeatherInfo } from "./scenes/weatherMachine";

// React UI (mount points documented in types.ts)
export { EventHud } from "./ui/EventHud";
export type { EventHudProps } from "./ui/EventHud";
export { MarketPanel } from "./ui/MarketPanel";
export type { MarketPanelProps } from "./ui/MarketPanel";
export { WeatherPanel } from "./ui/WeatherPanel";
export type { WeatherPanelProps } from "./ui/WeatherPanel";
export { useEventsSnapshot } from "./ui/useEventsSnapshot";

// Shared types
export type {
  TimedEventKind,
  FeatureKind,
  EventKind,
  MarketQuote,
  MarketSnapshot,
  EventPayload,
  CityEvent,
  EventListener,
  EventEndListener,
  AirdropPayload,
  EarthquakePayload,
  FireworksPayload,
  ParadePayload,
  ProtestPayload,
  SoundName,
  EventsSceneHost,
  CityEffectHandle,
  EventsWallet,
  OrbitxBillingProvider,
  EventsContext,
  EventReward,
  EventUiMount,
} from "./types";
