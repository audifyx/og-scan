/**
 * OrbitXCity — RACING MODULE economy.
 *
 * Currency split (per web/src/city/BILLING_CONTRACT.md):
 * - paper CITY: gameplay pools, winnings, wagers. Local ledger, no chain.
 * - real ORBITX: race entry fees, burned via the backend — no wallet popups,
 *   the game never custodies keys.
 *
 * HARD RULE: this module never imports @/tokenomics/*. The burn path is an
 * injected provider interface. Until the tokenomics team ships primitives,
 * the NullBurnProvider keeps everything running in paper-only mode and the
 * UI renders the entry-fee burn as "pending billing".
 */

export interface BurnOpts {
  /** whole ORBITX tokens */
  amount: number;
  /** ledger reason, e.g. "city:racing:entry-fee" */
  reason: string;
  /** idempotency ref */
  ref: string;
}

export interface BurnReceipt {
  signature: string;
}

/**
 * Backend-signed ORBITX burn provider. The tokenomics team's
 * `useOrbitxBilling().spend()` will satisfy this structurally once it
 * lands; the integrator adapts it. Until then use createNullBurnProvider().
 */
export interface IBurnProvider {
  readonly ready: boolean;
  /** on-chain ORBITX balance, null when unknown */
  readonly balance: number | null;
  burn: (opts: BurnOpts) => Promise<BurnReceipt>;
}

export function randomRef(prefix: string): string {
  const r = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${r}`;
}

/** Paper-only provider: burns are recorded locally, nothing hits the chain. */
export function createNullBurnProvider(): IBurnProvider {
  const localLog: BurnOpts[] = [];
  return {
    ready: false,
    balance: null,
    burn: async (opts: BurnOpts) => {
      localLog.push(opts);
      return { signature: `paper-${opts.ref}` };
    },
  };
}

/**
 * Paper CITY race pool. Every entrant pays `entryFeeCity` into the pot;
 * the winner takes the whole pot. No rake — the house takes its cut in
 * ORBITX entry-fee burns.
 */
export class RacePool {
  private entrants = new Map<string, number>();
  readonly entryFeeCity: number;

  constructor(entryFeeCity: number) {
    this.entryFeeCity = Math.max(0, Math.floor(entryFeeCity));
  }

  enter(racerId: string): void {
    if (this.entrants.has(racerId)) return;
    this.entrants.set(racerId, this.entryFeeCity);
  }

  has(racerId: string): boolean {
    return this.entrants.has(racerId);
  }

  entrantCount(): number {
    return this.entrants.size;
  }

  pot(): number {
    let total = 0;
    for (const fee of this.entrants.values()) total += fee;
    return total;
  }

  /**
   * Pay the whole pot to the winner. Returns per-racer CITY deltas
   * (losers negative, winner positive-net). Empty map if winner never entered.
   */
  payout(winnerId: string): Map<string, number> {
    const deltas = new Map<string, number>();
    if (!this.entrants.has(winnerId)) return deltas;
    const pot = this.pot();
    for (const [id, fee] of this.entrants) {
      deltas.set(id, id === winnerId ? pot - fee : -fee);
    }
    this.entrants.clear();
    return deltas;
  }
}

/**
 * Collect real-ORBITX entry fees for every entrant via the burn provider.
 * Returns the number of ORBITX burned total.
 *
 * If the provider is not ready (billing not wired yet), this resolves with
 * 0 and marks every entrant as paper-only — the race still runs, and the UI
 * must surface the pending fee. It never throws for billing-not-ready; it
 * only throws if the backend burn itself rejects.
 */
export async function collectEntryBurns(
  provider: IBurnProvider,
  racerIds: string[],
  feeOrbitx: number,
  raceId: string,
): Promise<{ burnedOrbitx: number; paperOnly: boolean }> {
  const fee = Math.max(0, Math.floor(feeOrbitx));
  if (fee === 0) return { burnedOrbitx: 0, paperOnly: false };
  if (!provider.ready) return { burnedOrbitx: 0, paperOnly: true };
  let burned = 0;
  for (const id of racerIds) {
    const receipt = await provider.burn({
      amount: fee,
      reason: "city:racing:entry-fee",
      ref: randomRef(`race-${raceId}-${id}`),
    });
    if (!receipt?.signature) throw new Error(`entry burn failed for ${id}`);
    burned += fee;
  }
  return { burnedOrbitx: burned, paperOnly: false };
}
