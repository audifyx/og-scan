/**
 * OrbitXCity — Economy module shared types.
 *
 * Currency split (locked by the user):
 *  - CITY  — paper coins for gameplay earnings/loot/wagers. Local ledger only,
 *            never touches a chain.
 *  - ORBITX — real on-chain token for premium spends. Every spend executes a
 *            backend-signed burn (buy-and-burn). The game never custodies keys.
 * No staking anywhere.
 */

export type Currency = "CITY" | "ORBITX";

/** One paper-CITY ledger movement. */
export interface CityLedgerEntry {
  id: string;
  at: number; // epoch ms
  kind: "earn" | "spend" | "wager" | "win" | "loss" | "adjust";
  amount: number; // signed: +earn/+win, -spend/-loss
  label: string;
  /** Game / feature that produced this entry, e.g. "arcade:chart-guess". */
  source: string;
  /** Links a premium ORBITX burn to the paper record when relevant. */
  burnSignature?: string;
}

/** Paper wallet state (persisted to localStorage by the store). */
export interface PaperWalletState {
  balance: number;
  ledger: CityLedgerEntry[];
}

/**
 * Expected interface of the tokenomics-provided billing primitive
 * (`web/src/tokenomics/useOrbitxBilling` — see
 * `web/src/city/BILLING_CONTRACT.md`).
 *
 * The economy module does NOT import `@/tokenomics/*` directly (the directory
 * does not exist yet — importing it would break the build). Instead the
 * integrator injects a provider implementing this interface into the economy
 * UI (see `billing.ts` + MODULE.md). When tokenomics lands, the integrator
 * wires `useOrbitxBilling()` through this interface unchanged.
 */
export interface OrbitxBillingProvider {
  /** Auth-once complete; backend can sign spends. */
  ready: boolean;
  /** On-chain ORBITX balance in the in-app wallet. Null = unknown/loading. */
  balance: number | null;
  /** Backend-signed burn spend. No wallet popup, ever. */
  spend: (opts: {
    amount: number; // whole ORBITX tokens
    reason: string; // e.g. "city-bank:neon-underglow"
    ref?: string; // idempotency / ledger ref
  }) => Promise<{ signature: string }>;
  /** Kicks the dashboard auth-code flow if not authed yet. */
  beginAuth: () => void;
}

/** One record of a real ORBITX burn made from the bank. */
export interface BurnRecord {
  at: number;
  itemId: string;
  itemLabel: string;
  amount: number; // ORBITX burned
  signature: string;
  ref: string;
}

/** Premium bank catalog item (paid in real ORBITX, burned per tx). */
export interface BankItem {
  id: string;
  label: string;
  description: string;
  priceOrbitx: number; // whole ORBITX
  icon: string; // emoji/text glyph — no asset deps
  tag: "vehicle" | "property" | "cosmetic" | "utility" | "event";
}

/** Candle-predictor game config. */
export interface PredictorConfig {
  mint: string;
  label: string;
  candleMs: number; // candle duration
  payoutMultiplier: number; // e.g. 1.9 = stake back + 90%
  maxStake: number; // paper CITY
}

/** Arcade speedrun result summary. */
export interface SpeedrunResult {
  startedAt: number;
  endedAt: number;
  trades: number;
  pnlCity: number;
  finalBalance: number;
}
