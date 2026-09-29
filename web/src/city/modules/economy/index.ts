/**
 * OrbitXCity — Economy module public API.
 * Self-contained: no imports from other city modules. Only external deps:
 *  - react
 *  - @/hooks/useLivePrices (live price data — real data only, no mocks)
 */
export { EconomyHub, ECONOMY_PANEL_ID } from "./components/EconomyHub";
export type { EconomyTab } from "./components/EconomyHub";
export { PaperWalletPanel } from "./components/PaperWalletPanel";
export { OrbitxBankPanel } from "./components/OrbitxBankPanel";
export { CandlePredictor } from "./components/CandlePredictor";
export { Arcade } from "./components/Arcade";

export { useCityBilling } from "./billing";
export type { CityBilling } from "./billing";

export { paperWallet, usePaperWallet, formatCity, formatTime } from "./store/paperWallet";

export { BANK_CATALOG, CANDLE_PREDICTOR, SPEEDRUN_DURATION_MS, SPEEDRUN_START_CITY } from "./data/catalog";
export { FEED_TOKENS, ORBITX_MINT, feedToken } from "./data/mints";
export type { FeedToken } from "./data/mints";

export type {
  Currency,
  CityLedgerEntry,
  PaperWalletState,
  OrbitxBillingProvider,
  BurnRecord,
  BankItem,
  PredictorConfig,
  SpeedrunResult,
} from "./types";
