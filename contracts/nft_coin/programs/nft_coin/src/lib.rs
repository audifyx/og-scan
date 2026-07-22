// OrbitX NFT-coin — pump.fun-style bonding-curve market attached to an NFT.
//
// STATUS: reference program. NOT deployed. Handles user funds -> MUST be audited
// before mainnet. Fee model matches web/src/pages/nft/nftCoin.ts:
//   total 1.00% per trade = 0.50% creator (claimable) + 0.50% platform.
//
// Accounts/PDAs
//   Market  (per NFT)      seeds = [b"market", nft_mint]
//   SolVault (curve escrow) seeds = [b"sol_vault", market]
//   CreatorVault           seeds = [b"creator_vault", market]  <- claimable creator fees
//   PlatformVault          seeds = [b"platform_vault"]         <- protocol fees
use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Nftco1nMarketProgram1111111111111111111111");

const CREATOR_FEE_BPS: u64 = 50;   // 0.50%
const PLATFORM_FEE_BPS: u64 = 50;  // 0.50%
const BPS_DENOM: u64 = 10_000;
const GRADUATION_LAMPORTS: u64 = 85 * 1_000_000_000; // ~85 SOL reserve target

#[program]
pub mod nft_coin {
    use super::*;

    /// Enable a coin market for an NFT the caller created.
    pub fn initialize_market(ctx: Context<InitializeMarket>, virtual_sol: u64, virtual_tokens: u64) -> Result<()> {
        let m = &mut ctx.accounts.market;
        m.nft_mint = ctx.accounts.nft_mint.key();
        m.creator = ctx.accounts.creator.key();
        m.virtual_sol = virtual_sol;
        m.virtual_tokens = virtual_tokens;
        m.real_sol = 0;
        m.tokens_sold = 0;
        m.graduated = false;
        m.bump = ctx.bumps.market;
        Ok(())
    }

    /// Buy curve tokens with SOL. Constant-product pricing on virtual reserves;
    /// fees are skimmed from the SOL in and routed to the creator/platform vaults.
    pub fn buy(ctx: Context<Trade>, sol_in: u64, min_tokens_out: u64) -> Result<()> {
        let creator_fee = sol_in * CREATOR_FEE_BPS / BPS_DENOM;
        let platform_fee = sol_in * PLATFORM_FEE_BPS / BPS_DENOM;
        let net = sol_in - creator_fee - platform_fee;

        let m = &mut ctx.accounts.market;
        require!(!m.graduated, ErrorCode::Graduated);
        let x = m.virtual_sol + m.real_sol;
        let y = m.virtual_tokens - m.tokens_sold;
        // dy = y - k/(x+net), k = x*y
        let k = (x as u128) * (y as u128);
        let new_y = (k / ((x as u128) + (net as u128))) as u64;
        let tokens_out = y - new_y;
        require!(tokens_out >= min_tokens_out, ErrorCode::Slippage);

        // move SOL: buyer -> vaults
        pay(&ctx.accounts.buyer, &ctx.accounts.sol_vault, net, &ctx.accounts.system_program)?;
        pay(&ctx.accounts.buyer, &ctx.accounts.creator_vault, creator_fee, &ctx.accounts.system_program)?;
        pay(&ctx.accounts.buyer, &ctx.accounts.platform_vault, platform_fee, &ctx.accounts.system_program)?;

        m.real_sol += net;
        m.tokens_sold += tokens_out;
        if m.real_sol >= GRADUATION_LAMPORTS { m.graduated = true; }
        // (token mint/transfer of `tokens_out` to buyer omitted in skeleton)
        Ok(())
    }

    /// Creator withdraws accrued fees from the creator vault (claim in-app).
    pub fn claim_creator_fees(ctx: Context<Claim>) -> Result<()> {
        let market_key = ctx.accounts.market.key();
        let seeds: &[&[u8]] = &[b"creator_vault", market_key.as_ref(), &[ctx.bumps.creator_vault]];
        let lamports = ctx.accounts.creator_vault.lamports();
        let rent = Rent::get()?.minimum_balance(0);
        let payout = lamports.saturating_sub(rent);
        require!(payout > 0, ErrorCode::NothingToClaim);
        **ctx.accounts.creator_vault.try_borrow_mut_lamports()? -= payout;
        **ctx.accounts.creator.try_borrow_mut_lamports()? += payout;
        let _ = seeds; // signer seeds used when vault is a data PDA
        Ok(())
    }
}

fn pay<'a>(from: &AccountInfo<'a>, to: &AccountInfo<'a>, lamports: u64, sys: &Program<'a, System>) -> Result<()> {
    if lamports == 0 { return Ok(()); }
    system_program::transfer(CpiContext::new(sys.to_account_info(), system_program::Transfer { from: from.clone(), to: to.clone() }), lamports)
}

#[account]
pub struct Market {
    pub nft_mint: Pubkey,
    pub creator: Pubkey,
    pub virtual_sol: u64,
    pub virtual_tokens: u64,
    pub real_sol: u64,
    pub tokens_sold: u64,
    pub graduated: bool,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    #[account(init, payer = creator, space = 8 + 32 + 32 + 8 * 4 + 1 + 1, seeds = [b"market", nft_mint.key().as_ref()], bump)]
    pub market: Account<'info, Market>,
    /// CHECK: NFT mint this market is bound to
    pub nft_mint: UncheckedAccount<'info>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Trade<'info> {
    #[account(mut, seeds = [b"market", market.nft_mint.as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(mut)] pub buyer: Signer<'info>,
    /// CHECK: SOL escrow PDA
    #[account(mut, seeds = [b"sol_vault", market.key().as_ref()], bump)] pub sol_vault: UncheckedAccount<'info>,
    /// CHECK: creator fee vault PDA
    #[account(mut, seeds = [b"creator_vault", market.key().as_ref()], bump)] pub creator_vault: UncheckedAccount<'info>,
    /// CHECK: platform fee vault PDA
    #[account(mut, seeds = [b"platform_vault"], bump)] pub platform_vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(seeds = [b"market", market.nft_mint.as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(mut, address = market.creator)] pub creator: Signer<'info>,
    /// CHECK: creator fee vault PDA
    #[account(mut, seeds = [b"creator_vault", market.key().as_ref()], bump)] pub creator_vault: UncheckedAccount<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("market has graduated")] Graduated,
    #[msg("slippage exceeded")] Slippage,
    #[msg("nothing to claim")] NothingToClaim,
}
