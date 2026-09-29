/**
 * OrbitXCity — Gadgets module public API.
 *
 * The integrator (merge agent) imports ONLY from this file. Everything else in
 * this directory is internal. No imports from other modules; no imports from
 * `@/tokenomics/*` (that directory does not exist yet — see MODULE.md).
 */

// Types
export type {
  GadgetId,
  GadgetBillingProvider,
  GadgetBurnRecord,
  GadgetInventoryState,
  TokenQuote,
  GrappleLifecycle,
  GadgetRuntimeSnapshot,
  ScanHitView,
} from "./types";

// Catalog
export {
  GADGET_CATALOG,
  SCAN_MINTS,
  SCAN_SYMBOLS,
  SCAN_BUILDING_NAMES,
  getGadget,
  catalogBurnTotal,
} from "./catalog";
export type { GadgetCatalogItem } from "./catalog";

// Store: inventory hook + runtime pub/sub
export {
  GadgetRuntime,
  useGadgetInventory,
  useGadgetRuntime,
  useSyncRuntimeEquipped,
  applyPurchase,
  applyEquip,
} from "./store";
export type { GadgetInventory } from "./store";

// 3D controllers (framework-free)
export { GrapplingHook } from "./GrapplingHook";
export type { GrappleOptions, GrappleAim, GrappleFrame } from "./GrapplingHook";
export { TokenScanner } from "./TokenScanner";
export type { ScannerOptions, ScanHit } from "./TokenScanner";

// React UI
export { GadgetShop } from "./GadgetShop";
export type { GadgetShopProps } from "./GadgetShop";
export { GadgetHud } from "./GadgetHud";
export type { GadgetHudProps, GadgetAim as HudAim } from "./GadgetHud";
