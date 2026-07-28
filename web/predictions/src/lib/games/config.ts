export const LAMPORTS_PER_SOL = 1_000_000_000;
export const HOUSE_EDGE = 0.005;           // 0.5% reference edge (50% off)
export const JACKPOT_RAKE_BPS = 250;       // 2.5% house rake on jackpot pots (50% off)
export const LOSE_REFUND_BPS = 6500;       // losers get 65% of their stake back (consolation)

export const MIN_WAGER = 1_000_000;        // 0.001 SOL
export const MIN_DEPOSIT = 1_000_000;      // 0.001 SOL
export const MIN_WITHDRAW = 10_000_000;    // 0.01 SOL
export const JACKPOT_MIN_ENTRY = 5_000_000;// 0.005 SOL
export const JACKPOT_COUNTDOWN_SEC = 30;   // round resolves 30s after 2nd player

export const sol = (lamports: number) => lamports / LAMPORTS_PER_SOL;
export const lamports = (s: number) => Math.round(s * LAMPORTS_PER_SOL);

// NOTE: This platform is 2-player only. All games run through the game
// match engine (see match.ts / match-meta.ts). Single-player / vs-house
// game logic has been removed — the system does not support solo play.
