use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Btr98movTV3jHYy1kNX8L2zYVEk7m33QTr2YtU96hLqM");

// ── Platform configuration ──────────────────────────────────────────────────
pub const TREASURY_WALLET:     &str = "9ZygxJ8AsvQLK9368uyuxQ4uTkmSj2EsjwAy3UdSQWgY";
pub const GLOBAL_POOL_WALLET:  &str = "45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE";

pub const MAX_OUTCOMES: usize = 10;
pub const MAX_TITLE_LEN: usize = 100;
pub const MAX_DESC_LEN: usize = 500;

// Fee tiers in USD cents (1_000 = $10.00)
pub const FEE_SMALL_USD_CENTS: u64 = 100;    // $1 for pool < $50
pub const FEE_MEDIUM_USD_CENTS: u64 = 500;   // $5 for pool $50-$500
pub const FEE_LARGE_USD_CENTS: u64 = 1000;   // $10 for pool > $500

pub const PLATFORM_FEE_BPS: u64 = 500; // 5% fallback if no oracle

#[program]
pub mod betting {
    use super::*;

    // Initialize global platform state (admin only)
    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        admin: Pubkey,
    ) -> Result<()> {
        let state = &mut ctx.accounts.platform_state;
        state.admin = admin;
        state.treasury = TREASURY_WALLET.parse().unwrap();
        state.global_pool = GLOBAL_POOL_WALLET.parse().unwrap();
        state.total_volume = 0;
        state.total_bets = 0;
        state.total_fees = 0;
        state.bump = ctx.bumps.platform_state;
        emit!(PlatformInitialized { admin, treasury: state.treasury });
        Ok(())
    }

    // Create a new bet with multiple outcomes
    pub fn create_bet(
        ctx: Context<CreateBet>,
        params: CreateBetParams,
    ) -> Result<()> {
        require!(params.outcomes.len() >= 2, BettingError::TooFewOutcomes);
        require!(params.outcomes.len() <= MAX_OUTCOMES, BettingError::TooManyOutcomes);
        require!(params.title.len() <= MAX_TITLE_LEN, BettingError::TitleTooLong);
        require!(params.description.len() <= MAX_DESC_LEN, BettingError::DescTooLong);
        require!(params.creator_fee_bps <= 500, BettingError::CreatorFeeTooHigh);
        require!(params.expiry > Clock::get()?.unix_timestamp, BettingError::ExpiryInPast);

        let bet = &mut ctx.accounts.bet;
        bet.creator = ctx.accounts.creator.key();
        bet.title = params.title;
        bet.description = params.description;
        bet.outcomes = params.outcomes.clone();
        bet.outcome_pools = vec![0u64; params.outcomes.len()];
        bet.winning_outcome = None;
        bet.status = BetStatus::Open;
        bet.is_usdc = params.is_usdc;
        bet.min_stake = params.min_stake;
        bet.creator_fee_bps = params.creator_fee_bps;
        bet.expiry = params.expiry;
        bet.is_private = params.is_private;
        bet.total_pool = 0;
        bet.bet_count = 0;
        bet.bet_id = params.bet_id;
        bet.bump = ctx.bumps.bet;

        let platform = &mut ctx.accounts.platform_state;
        platform.total_bets += 1;

        emit!(BetCreated {
            bet: bet.key(),
            creator: bet.creator,
            outcomes: params.outcomes,
            expiry: params.expiry,
        });
        Ok(())
    }

    // Place a bet on an outcome — SOL transfer to escrow PDA
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        outcome_index: u8,
        amount: u64,
        // fee_lamports computed off-chain using oracle price (sent separately to treasury)
        fee_lamports: u64,
    ) -> Result<()> {
        let bet = &mut ctx.accounts.bet;
        require!(bet.status == BetStatus::Open, BettingError::BetNotOpen);
        require!(!bet.is_usdc, BettingError::UseTokenInstruction);
        require!(Clock::get()?.unix_timestamp < bet.expiry, BettingError::BetExpired);
        require!((outcome_index as usize) < bet.outcomes.len(), BettingError::InvalidOutcome);
        require!(amount >= bet.min_stake, BettingError::BelowMinStake);
        require!(amount > fee_lamports, BettingError::AmountTooSmall);

        let user_amount = amount - fee_lamports;

        // Transfer fee to treasury
        if fee_lamports > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.user.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                fee_lamports,
            )?;
        }

        // Transfer user amount to escrow PDA
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            user_amount,
        )?;

        // Update bet state
        bet.outcome_pools[outcome_index as usize] += user_amount;
        bet.total_pool += user_amount;
        bet.bet_count += 1;

        // Record entry
        let entry = &mut ctx.accounts.bet_entry;
        entry.user = ctx.accounts.user.key();
        entry.bet = bet.key();
        entry.outcome_index = outcome_index;
        entry.amount = user_amount;
        entry.fee_paid = fee_lamports;
        entry.claimed = false;
        entry.payout = 0;
        entry.bump = ctx.bumps.bet_entry;

        // Update platform stats
        let platform = &mut ctx.accounts.platform_state;
        platform.total_volume += user_amount;
        platform.total_fees += fee_lamports;

        emit!(BetPlaced {
            bet: bet.key(),
            user: ctx.accounts.user.key(),
            outcome_index,
            amount: user_amount,
            fee: fee_lamports,
        });
        Ok(())
    }

    // Admin resolves bet and selects winning outcome
    pub fn resolve_bet(
        ctx: Context<ResolveBet>,
        winning_outcome: u8,
    ) -> Result<()> {
        let bet = &mut ctx.accounts.bet;
        require!(
            ctx.accounts.admin.key() == ctx.accounts.platform_state.admin,
            BettingError::Unauthorized
        );
        require!(bet.status == BetStatus::Open || bet.status == BetStatus::Closed, BettingError::AlreadyResolved);
        require!((winning_outcome as usize) < bet.outcomes.len(), BettingError::InvalidOutcome);

        bet.status = BetStatus::Resolved;
        bet.winning_outcome = Some(winning_outcome);

        // Calculate payouts for each entry (off-chain claim model)
        // Winners call claim_winnings to pull their share from escrow

        emit!(BetResolved {
            bet: bet.key(),
            winning_outcome,
            total_pool: bet.total_pool,
        });
        Ok(())
    }

    // Winner claims their proportional payout
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let bet = &ctx.accounts.bet;
        let entry = &mut ctx.accounts.bet_entry;

        require!(bet.status == BetStatus::Resolved, BettingError::NotResolved);
        require!(!entry.claimed, BettingError::AlreadyClaimed);

        let winning_idx = bet.winning_outcome.ok_or(BettingError::NotResolved)?;
        require!(entry.outcome_index == winning_idx, BettingError::NotAWinner);

        let winning_pool = bet.outcome_pools[winning_idx as usize];
        require!(winning_pool > 0, BettingError::EmptyPool);

        // Proportional payout: (user_stake / winning_pool) * total_pool
        let payout = (entry.amount as u128)
            .checked_mul(bet.total_pool as u128)
            .unwrap()
            .checked_div(winning_pool as u128)
            .unwrap() as u64;

        // Transfer from escrow to user (escrow is a PDA signer)
        let bet_key = bet.key();
        let seeds = &[b"escrow", bet_key.as_ref(), &[ctx.bumps.escrow]];
        let signer_seeds = &[&seeds[..]];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.user.to_account_info(),
                },
                signer_seeds,
            ),
            payout,
        )?;

        entry.claimed = true;
        entry.payout = payout;

        emit!(WinningsClaimed {
            bet: bet.key(),
            user: ctx.accounts.user.key(),
            payout,
        });
        Ok(())
    }

    // Admin cancels bet and refunds all participants
    pub fn cancel_bet(ctx: Context<CancelBet>) -> Result<()> {
        let bet = &mut ctx.accounts.bet;
        require!(
            ctx.accounts.admin.key() == ctx.accounts.platform_state.admin,
            BettingError::Unauthorized
        );
        require!(bet.status != BetStatus::Resolved, BettingError::AlreadyResolved);
        bet.status = BetStatus::Cancelled;
        emit!(BetCancelled { bet: bet.key(), total_refunded: bet.total_pool });
        Ok(())
    }

    // User claims refund on cancelled bet
    pub fn claim_refund(ctx: Context<ClaimWinnings>) -> Result<()> {
        let bet = &ctx.accounts.bet;
        let entry = &mut ctx.accounts.bet_entry;

        require!(bet.status == BetStatus::Cancelled, BettingError::NotCancelled);
        require!(!entry.claimed, BettingError::AlreadyClaimed);

        let bet_key = bet.key();
        let seeds = &[b"escrow", bet_key.as_ref(), &[ctx.bumps.escrow]];
        let signer_seeds = &[&seeds[..]];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.user.to_account_info(),
                },
                signer_seeds,
            ),
            entry.amount, // full refund
        )?;

        entry.claimed = true;
        entry.payout = entry.amount;
        Ok(())
    }

    // Admin updates fee configuration
    pub fn update_fees(
        ctx: Context<AdminOnly>,
        fee_small: u64,
        fee_medium: u64,
        fee_large: u64,
    ) -> Result<()> {
        require!(ctx.accounts.admin.key() == ctx.accounts.platform_state.admin, BettingError::Unauthorized);
        // Fees stored in lamports (convert from USD off-chain)
        emit!(FeesUpdated { fee_small, fee_medium, fee_large });
        Ok(())
    }
}

// ── Account structs ─────────────────────────────────────────────────────────

#[account]
#[derive(Default)]
pub struct PlatformState {
    pub admin:        Pubkey,
    pub treasury:     Pubkey,
    pub global_pool:  Pubkey,
    pub total_volume: u64,
    pub total_bets:   u64,
    pub total_fees:   u64,
    pub bump:         u8,
}

#[account]
pub struct BetState {
    pub creator:       Pubkey,
    pub title:         String,
    pub description:   String,
    pub outcomes:      Vec<String>,
    pub outcome_pools: Vec<u64>,
    pub winning_outcome: Option<u8>,
    pub status:        BetStatus,
    pub is_usdc:       bool,
    pub min_stake:     u64,
    pub creator_fee_bps: u16,  // 0-500 = 0-5%
    pub expiry:        i64,
    pub is_private:    bool,
    pub total_pool:    u64,
    pub bet_count:     u32,
    pub bet_id:        u64,
    pub bump:          u8,
}

impl BetState {
    pub const INIT_SPACE: usize = 8 + 32 + 4 + MAX_TITLE_LEN + 4 + MAX_DESC_LEN
        + 4 + (MAX_OUTCOMES * (4 + 30)) + 4 + (MAX_OUTCOMES * 8)
        + 2 + 1 + 1 + 8 + 2 + 8 + 1 + 8 + 4 + 8 + 1;
}

#[account]
pub struct BetEntry {
    pub user:          Pubkey,
    pub bet:           Pubkey,
    pub outcome_index: u8,
    pub amount:        u64,
    pub fee_paid:      u64,
    pub claimed:       bool,
    pub payout:        u64,
    pub bump:          u8,
}

impl BetEntry {
    pub const INIT_SPACE: usize = 8 + 32 + 32 + 1 + 8 + 8 + 1 + 8 + 1;
}

// ── Context structs ─────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(
        init, payer = payer,
        space = 8 + std::mem::size_of::<PlatformState>(),
        seeds = [b"platform"], bump
    )]
    pub platform_state: Account<'info, PlatformState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(params: CreateBetParams)]
pub struct CreateBet<'info> {
    #[account(
        init, payer = creator,
        space = BetState::INIT_SPACE,
        seeds = [b"bet", creator.key().as_ref(), &params.bet_id.to_le_bytes()],
        bump
    )]
    pub bet: Account<'info, BetState>,
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(seeds = [b"platform"], bump = platform_state.bump)]
    pub platform_state: Account<'info, PlatformState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(outcome_index: u8, amount: u64, fee_lamports: u64)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub bet: Account<'info, BetState>,
    #[account(
        init, payer = user,
        space = BetEntry::INIT_SPACE,
        seeds = [b"entry", bet.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub bet_entry: Account<'info, BetEntry>,
    /// CHECK: escrow PDA receives SOL
    #[account(mut, seeds = [b"escrow", bet.key().as_ref()], bump)]
    pub escrow: UncheckedAccount<'info>,
    /// CHECK: treasury wallet receives fees
    #[account(mut, address = TREASURY_WALLET.parse::<Pubkey>().unwrap())]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [b"platform"], bump = platform_state.bump)]
    pub platform_state: Account<'info, PlatformState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveBet<'info> {
    #[account(mut)]
    pub bet: Account<'info, BetState>,
    pub admin: Signer<'info>,
    #[account(seeds = [b"platform"], bump = platform_state.bump)]
    pub platform_state: Account<'info, PlatformState>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    pub bet: Account<'info, BetState>,
    #[account(
        mut,
        seeds = [b"entry", bet.key().as_ref(), user.key().as_ref()],
        bump = bet_entry.bump,
        has_one = user,
        has_one = bet,
    )]
    pub bet_entry: Account<'info, BetEntry>,
    /// CHECK: escrow PDA, signer for transfer
    #[account(mut, seeds = [b"escrow", bet.key().as_ref()], bump)]
    pub escrow: UncheckedAccount<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelBet<'info> {
    #[account(mut)]
    pub bet: Account<'info, BetState>,
    pub admin: Signer<'info>,
    #[account(seeds = [b"platform"], bump = platform_state.bump)]
    pub platform_state: Account<'info, PlatformState>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [b"platform"], bump = platform_state.bump)]
    pub platform_state: Account<'info, PlatformState>,
}

// ── Parameter structs ───────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateBetParams {
    pub bet_id:          u64,
    pub title:           String,
    pub description:     String,
    pub outcomes:        Vec<String>,
    pub min_stake:       u64,
    pub creator_fee_bps: u16,
    pub expiry:          i64,
    pub is_usdc:         bool,
    pub is_private:      bool,
}

// ── Enums ───────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum BetStatus {
    Open,
    Closed,
    Resolved,
    Cancelled,
}

// ── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct PlatformInitialized { pub admin: Pubkey, pub treasury: Pubkey }

#[event]
pub struct BetCreated {
    pub bet:      Pubkey,
    pub creator:  Pubkey,
    pub outcomes: Vec<String>,
    pub expiry:   i64,
}

#[event]
pub struct BetPlaced {
    pub bet:          Pubkey,
    pub user:         Pubkey,
    pub outcome_index: u8,
    pub amount:       u64,
    pub fee:          u64,
}

#[event]
pub struct BetResolved {
    pub bet:             Pubkey,
    pub winning_outcome: u8,
    pub total_pool:      u64,
}

#[event]
pub struct WinningsClaimed { pub bet: Pubkey, pub user: Pubkey, pub payout: u64 }
#[event]
pub struct BetCancelled    { pub bet: Pubkey, pub total_refunded: u64 }
#[event]
pub struct FeesUpdated     { pub fee_small: u64, pub fee_medium: u64, pub fee_large: u64 }

// ── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum BettingError {
    #[msg("Too few outcomes (min 2)")]          TooFewOutcomes,
    #[msg("Too many outcomes (max 10)")]         TooManyOutcomes,
    #[msg("Title too long (max 100 chars)")]     TitleTooLong,
    #[msg("Description too long (max 500)")]     DescTooLong,
    #[msg("Creator fee too high (max 5%)")]      CreatorFeeTooHigh,
    #[msg("Expiry must be in the future")]       ExpiryInPast,
    #[msg("Bet is not open for bets")]           BetNotOpen,
    #[msg("Bet has expired")]                    BetExpired,
    #[msg("Invalid outcome index")]              InvalidOutcome,
    #[msg("Amount below minimum stake")]         BelowMinStake,
    #[msg("Amount too small after fee")]         AmountTooSmall,
    #[msg("Use USDC token instruction")]         UseTokenInstruction,
    #[msg("Unauthorized")]                       Unauthorized,
    #[msg("Bet already resolved")]               AlreadyResolved,
    #[msg("Bet not resolved yet")]               NotResolved,
    #[msg("Already claimed")]                    AlreadyClaimed,
    #[msg("Not a winner")]                       NotAWinner,
    #[msg("Winning pool is empty")]              EmptyPool,
    #[msg("Bet is not cancelled")]               NotCancelled,
}
