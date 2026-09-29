/**
 * ORBITXCITY sports — premium billing adapter (REAL ORBITX, burned).
 *
 * The tokenomics team owns `web/src/tokenomics/useOrbitxBilling` (not yet
 * present — BILLING_CONTRACT.md). This adapter codes against that contract
 * defensively: until the primitive lands, premium purchases resolve
 * `{ ok: false, reason: "auth-required" }` and the HUD renders the
 * "coming soon / auth required" state. The game never builds its own burn
 * path and never custodies keys.
 */
import type { PremiumResult } from "./types";

declare global {
  interface Window {
    /** Injected by the tokenomics team when their primitive lands. */
    __orbitxBilling?: {
      ready: boolean;
      balance: number | null;
      spend: (opts: { amount: number; reason: string; ref?: string }) => Promise<{ signature: string }>;
    };
  }
}

const REF_PREFIX = "city-sports";

export interface PremiumBilling {
  /** True when backend-signed spends are possible. */
  readonly available: boolean;
  readonly balance: number | null;
  spend(amount: number, itemId: string): Promise<PremiumResult>;
}

class TokenomicsAdapter implements PremiumBilling {
  get available(): boolean {
    return typeof window !== "undefined" && !!window.__orbitxBilling?.ready;
  }
  get balance(): number | null {
    return window.__orbitxBilling?.balance ?? null;
  }
  async spend(amount: number, itemId: string): Promise<PremiumResult> {
    const billing = typeof window !== "undefined" ? window.__orbitxBilling : undefined;
    if (!billing || !billing.ready) {
      return { ok: false, reason: "Premium purchases need the ORBITX auth flow (coming soon)." };
    }
    try {
      const ref = `${REF_PREFIX}:${itemId}:${Date.now()}`;
      const { signature } = await billing.spend({ amount, reason: `city-sports:${itemId}`, ref });
      return { ok: true, reason: "Burned.", signature };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "Burn failed." };
    }
  }
}

/** Singleton used by all sport sims. Safe to call before tokenomics lands. */
export const premiumBilling: PremiumBilling = new TokenomicsAdapter();

/** Premium catalogue referenced by sports UI. Amounts are whole ORBITX. */
export const PREMIUM_CATALOG = {
  sponsorProContract: { cost: 5, label: "Sponsor PRO contract (ORBITX Decks)" },
  tournamentGoldenBracket: { cost: 3, label: "Golden Bracket entry (2x prize)" },
  dojoMasterStyle: { cost: 8, label: "Master style: Shadow Fist" },
  surfProBoard: { cost: 2, label: "Pro surfboard (style +25%)" },
  golfChampionTee: { cost: 4, label: "Champion tee time (wager x2)" },
} as const;

export type PremiumItemId = keyof typeof PREMIUM_CATALOG;
