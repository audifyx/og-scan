# solana-betting reference

Repo: `audifyx/solana-betting` · App dir: `app/`

## Supabase migrations (run in order)

| File | Domain |
|------|--------|
| `001_init.sql` | `profiles`, `bets`, `user_bets`, `notifications`, leaderboard view |
| `002_games.sql` | Game balance ledger |
| `003_games_state.sql` | Game state |
| `004_matches.sql` | 1v1 duels |
| `005_game_catalog.sql` | Arcade catalog |
| `006_match_scores.sql` | Match scores |
| `007_fundraises.sql` | Fundraise campaigns |
| `008_social_and_autoresolve.sql` | Comments, follows, auto-resolve fields |
| `009_payout_proofs.sql` | Verified payout txs |
| `010_harden_comment_author.sql` | Comment RLS |
| `011_admin_login_rate_limit.sql` | Admin brute-force limit |
| `012_half_fees_rake.sql` | Fee rake split |
| `013_support_chat.sql` | Support tickets |
| `014_site_settings.sql` | Maintenance mode |

Storage bucket: `bet-images` (public read).

## Core tables

### `bets` (markets)

- `outcomes[]`, `outcome_pools[]` — multi-outcome parimutuel
- `status`, `winning_outcome_index`, `resolves_at`
- `auto_resolve`, `resolution_kind`, `resolution_config` (JSONB oracle config)

### `user_bets` (wagers)

- Links user, bet, outcome side, lamports, **tx signature**
- Payout status fields for admin settlement

### `profiles`

- Linked to `auth.users`, wallet address, win stats

## API routes (`app/src/app/api/`)

### User

| Route | Method | Notes |
|-------|--------|-------|
| `/api/bets/place` | POST | Verify treasury deposit, insert wager |
| `/api/price` | GET | SOL/USD |
| `/api/payouts/recent` | GET | Public payout proofs |
| `/api/treasury/public` | GET | Treasury transparency |
| `/api/upload-image` | POST | Bet image → Storage |
| `/api/support` | GET, POST | Support chat |
| `/api/fundraises` | GET, POST | Campaigns |
| `/api/fundraises/contribute` | POST | Verify contribution tx |

### Games

| Route | Method |
|-------|--------|
| `/api/games/catalog` | GET |
| `/api/games/matches` | GET, POST |
| `/api/games/balance` | GET |
| `/api/games/wallet` | GET |
| `/api/games/withdraw` | POST |

### Admin (PIN cookie)

`/api/admin/login`, `logout`, `me`, `stats`, `create-bet`, `resolve`, `payout`, `cancel`, `delete`, `lock`, `treasury`, `withdrawals`, `fundraises`, `support`, `settings`

### Cron

`/api/cron/resolve` — daily auto-resolution

## Frontend routes

| Route | Page |
|-------|------|
| `/` | Marketing landing |
| `/auth` | Email auth + wallet connect |
| `/app` | Market browse |
| `/app/bet/[id]` | Market detail (public shareable) |
| `/app/my-bets` | User history |
| `/app/leaderboard` | Rankings |
| `/app/wallet` | Game wallet |
| `/app/games`, `/app/arcade` | Duels |
| `/app/fundraises` | Campaigns |
| `/app/u/[handle]` | Public profile |
| `/admin` | Admin dashboard |
| `/treasury` | Public treasury |

## Bet placement flow

1. User picks outcome in `PlaceBetModal`
2. Sends SOL to `NEXT_PUBLIC_TREASURY_WALLET` from Phantom/Solflare
3. Pastes transaction signature
4. `POST /api/bets/place` → `solana-verify.ts` confirms deposit
5. `user_bets` row inserted; pools updated via DB trigger

## Resolution

- **Manual:** Admin `/api/admin/resolve`
- **Auto:** Cron calls oracles in `lib/oracles/crypto.ts`, `lib/oracles/sports.ts`
- **Payout:** Admin `/api/admin/payout` sends SOL to winners; proof stored

## Key components

- `PlaceBetModal.tsx` — treasury deposit UX
- `CreateBetModal.tsx` — user-created markets
- `BetCard.tsx`, `OutcomeBar.tsx` — market UI
- `MarketComments.tsx` — social
- `WalletContextProvider` — Phantom + Solflare only (add Jupiter from og-scan if needed)

## Deploy (Vercel)

- Root directory: **`app`**
- `vercel.json` at repo root enables cron
- Node runtime on all API routes
