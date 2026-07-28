export type BetStatus = 'open' | 'active' | 'locked' | 'resolved' | 'cancelled' | 'expired';
export type BetSide = 'yes' | 'no';           // backward compat (yes=0, no=1)
export type BetCurrency = 'SOL' | 'USDC';
export type UserBetStatus = 'pending' | 'confirmed' | 'won' | 'lost' | 'refunded' | 'claimed';

export interface Bet {
  id: string;
  title: string;
  description: string;
  category: string;
  creator_wallet: string;
  creator_type: 'user' | 'admin';
  // Multi-outcome (2–10 choices)
  outcomes: string[];
  outcome_pools: number[];
  winning_outcome_index: number | null;
  // Legacy yes/no fields (kept for DB compat)
  yes_label: string;
  no_label: string;
  yes_pool: number;
  no_pool: number;
  total_pool: number;
  // Config
  min_stake: number;
  creator_fee_pct: number;
  currency: BetCurrency;
  is_private: boolean;
  featured: boolean;
  status: BetStatus;
  bet_count: number;
  max_participants: number;   // default 5
  expiry: string;
  created_at: string;
  image_url?: string | null;
  on_chain_pubkey?: string;
  platform_fees_collected?: number;
}

export interface UserBet {
  id: string;
  bet_id: string;
  user_id: string | null;
  user_wallet: string;
  outcome_index: number;
  side: BetSide;            // backward compat
  amount: number;
  fee_paid: number;
  tx_signature: string | null;
  payout: number | null;
  status: UserBetStatus;
  claimed: boolean;
  claim_tx: string | null;
  payout_verified?: boolean;
  created_at: string;
  bet?: Bet;
}

export interface Profile {
  id: string;
  auth_id: string | null;
  wallet: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  twitter: string | null;
  total_bets: number;
  wins: number;
  losses: number;
  total_wagered: number;
  created_at: string;
}
