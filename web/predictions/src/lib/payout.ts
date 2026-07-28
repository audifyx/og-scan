// ============================================================
// Parimutuel payout algorithm for the manual-treasury model.
//
// Model: every wager is a verified SOL deposit into the treasury.
// When a bet resolves, winners get their stake back PLUS a
// proportional share of the losing side's pool, minus a platform fee.
// Losers get nothing. The treasury is ALWAYS solvent because the sum
// of payouts never exceeds what was deposited.
// ============================================================

export const PLATFORM_FEE_BPS = 0; // fee is charged at placement (see lib/fees.ts), so no extra cut at resolution
export const LOSE_REFUND_BPS = 6500; // if a bet resolves with NO winners, each loser is refunded 65%; the platform keeps the other 35%

export interface Wager {
  id: string;
  outcome_index: number;
  amount: number; // lamports actually deposited (verified)
}

export interface PayoutLine {
  id: string;
  status: 'won' | 'lost' | 'refunded';
  payout: number; // lamports the treasury must send to this wager's wallet
}

export interface PayoutSummary {
  results: PayoutLine[];
  grossPool: number;    // total deposited across all outcomes
  winningStakes: number;// total staked on the winning outcome
  losingPool: number;   // total staked on losing outcomes
  fee: number;          // platform fee retained by the house
  prizePool: number;    // distributed to winners
  totalPaid: number;    // sum of all payouts (<= grossPool, guaranteeing solvency)
  refunded: boolean;    // true when the whole bet is refunded (edge case)
}

export function computePayouts(
  wagers: Wager[],
  winningOutcome: number,
  feeBps: number = PLATFORM_FEE_BPS,
): PayoutSummary {
  const grossPool = wagers.reduce((s, w) => s + (w.amount || 0), 0);
  const winningStakes = wagers
    .filter((w) => w.outcome_index === winningOutcome)
    .reduce((s, w) => s + (w.amount || 0), 0);
  const losingPool = grossPool - winningStakes;

  // Edge case A: nobody backed the winning outcome -> EVERYONE lost.
  // Each participant is refunded LOSE_REFUND_BPS (65%); the platform keeps the rest (35%).
  if (winningStakes === 0) {
    const results = wagers.map<PayoutLine>((w) => ({
      id: w.id,
      status: 'refunded',
      payout: Math.floor((w.amount * LOSE_REFUND_BPS) / 10000),
    }));
    const totalPaid = results.reduce((s, r) => s + r.payout, 0);
    return {
      results,
      grossPool,
      winningStakes,
      losingPool,
      fee: grossPool - totalPaid,
      prizePool: 0,
      totalPaid,
      refunded: true,
    };
  }
  // Edge case B: everyone on the winning side, no opposing pool -> nothing to win.
  // Full refund, no fee (this is not a loss).
  if (losingPool === 0) {
    const results = wagers.map<PayoutLine>((w) => ({ id: w.id, status: 'refunded', payout: w.amount }));
    return {
      results,
      grossPool,
      winningStakes,
      losingPool,
      fee: 0,
      prizePool: grossPool,
      totalPaid: results.reduce((s, r) => s + r.payout, 0),
      refunded: true,
    };
  }

  const fee = Math.floor((grossPool * feeBps) / 10000);
  const prizePool = grossPool - fee; // stake-back + winnings distributed pro-rata

  const results = wagers.map<PayoutLine>((w) => {
    if (w.outcome_index === winningOutcome) {
      // proportional share: (my stake / winning stakes) * prize pool
      const payout = Math.floor((w.amount / winningStakes) * prizePool);
      return { id: w.id, status: 'won', payout };
    }
    return { id: w.id, status: 'lost', payout: 0 };
  });

  return {
    results,
    grossPool,
    winningStakes,
    losingPool,
    fee,
    prizePool,
    totalPaid: results.reduce((s, r) => s + r.payout, 0),
    refunded: false,
  };
}

// Quote a single winner's payout for live UI display (before resolution).
export function quotePayout(
  myStake: number,
  myOutcome: number,
  pools: number[],
  winningOutcome: number,
  feeBps: number = PLATFORM_FEE_BPS,
): number {
  const grossPool = pools.reduce((s, p) => s + (p || 0), 0) + myStake;
  const winningStakes = (pools[winningOutcome] || 0) + (myOutcome === winningOutcome ? myStake : 0);
  const losingPool = grossPool - winningStakes;
  if (myOutcome !== winningOutcome) return 0;
  if (losingPool === 0 || winningStakes === 0) return myStake;
  const prizePool = grossPool - Math.floor((grossPool * feeBps) / 10000);
  return Math.floor((myStake / winningStakes) * prizePool);
}
