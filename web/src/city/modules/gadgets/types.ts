/**
 * OrbitXCity — Gadgets module shared types.
 *
 * Currency rule (locked by the user): EVERY in-game premium purchase burns
 * real ORBITX via the backend-signed burn path. The game never custodies keys
 * or shows wallet popups. Until the tokenomics team's primitives land
 * (`web/src/tokenomics/useOrbitxBilling` — see `web/src/city/BILLING_CONTRACT.md`),
 * the shop renders in "auth required" state. This module never imports
 * `@/tokenomics/*`; the integrator injects a provider implementing
 * `GadgetBillingProvider` (same shape as the contract's `useOrbitxBilling`).
 */

/** Gadget ids sold in the shop. */
export type GadgetId = "grappling-hook" | "token-scanner";

/**
 * Expected shape of the tokenomics-provided billing primitive.
 * Mirrors `web/src/city/BILLING_CONTRACT.md`. Injected by the integrator —
 * NOT imported from `@/tokenomics/*` (that directory does not exist yet).
 */
export interface GadgetBillingProvider {
  /** Auth-once complete; backend can sign spends. */
  ready: boolean;
  /** On-chain ORBITX balance in the in-app wallet. Null = unknown/loading. */
  balance: number | null;
  /** Backend-signed burn spend. No wallet popup, ever. */
  spend: (opts: {
    amount: number; // whole ORBITX tokens
    reason: string; // e.g. "city:gadget:grappling-hook"
    ref?: string; // idempotency / ledger ref
  }) => Promise<{ signature: string }>;
  /** Kicks the dashboard auth-code flow if not authed yet. */
  beginAuth: () => void;
}

/** One record of a real ORBITX burn made from the gadget shop. */
export interface GadgetBurnRecord {
  at: number; // epoch ms
  gadgetId: GadgetId;
  gadgetLabel: string;
  amount: number; // ORBITX burned
  signature: string; // backend-signed burn tx signature
  ref: string;
}

/** Persisted gadget inventory (localStorage). */
export interface GadgetInventoryState {
  owned: GadgetId[];
  equipped: GadgetId | null;
  burns: GadgetBurnRecord[];
}

/** Live token quote as delivered by `useLivePrices`. */
export interface TokenQuote {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  lastUpdated: number;
}

/** Grappling hook lifecycle state (for HUD + integrator). */
export type GrappleLifecycle = "idle" | "flying" | "attached" | "cooldown";

/** Mutable runtime snapshot the 3D controllers push into for the HUD. */
export interface GadgetRuntimeSnapshot {
  equipped: GadgetId | null;
  grapple: GrappleLifecycle;
  /** Anchor point in world coords while attached, else null. */
  grappleAnchor: [number, number, number] | null;
  scannerActive: boolean;
  scanHit: ScanHitView | null;
  pricesConnected: boolean;
}

/** What the HUD renders for the currently scanned building. */
export interface ScanHitView {
  mint: string;
  symbol: string;
  name: string;
  distance: number; // meters from camera
  quote: TokenQuote | null; // null = price feed hasn't returned it yet
  scannedAt: number; // epoch ms
}
