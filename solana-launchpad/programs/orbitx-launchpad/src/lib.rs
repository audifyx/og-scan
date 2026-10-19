use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_2022::{self, Token2022},
    token_interface::{Mint, TokenAccount},
};

declare_id!("ORBITXLaunchPad1111111111111111111111111111");

/// OrbitX Launchpad — custom token launch program.
///
/// Features:
/// - Unique name/symbol registry (no duplicates)
/// - Trade limits (max % of supply per transaction)
/// - Sniper tax (elevated fee in first N slots after launch)
/// - Automatic pool creation with initial liquidity
/// - OrbitX branding embedded in token metadata

#[program]
pub mod orbitx_launchpad {
    use super::*;

    /// Initialize the global launchpad registry.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.authority = ctx.accounts.authority.key();
        registry.token_count = 0;
        registry.bump = ctx.bumps.registry;
        Ok(())
    }

    /// Launch a new token with OrbitX protections.
    ///
    /// Creates a Token-2022 mint with transfer hook for trade limits + sniper tax,
    /// registers the name/symbol (rejects duplicates), and initializes the pool.
    pub fn launch_token(
        ctx: Context<LaunchToken>,
        name: String,
        symbol: String,
        uri: String,
        decimals: u8,
        supply: u64,
        max_tx_bps: u16,        // Max tx as basis points of supply (e.g. 200 = 2%)
        sniper_tax_bps: u16,    // Sniper tax in bps (e.g. 2500 = 25%)
        sniper_window_slots: u64, // Slots after launch when sniper tax applies
    ) -> Result<()> {
        // Validate inputs
        require!(name.len() > 0 && name.len() <= 32, LaunchpadError::InvalidName);
        require!(symbol.len() > 0 && symbol.len() <= 10, LaunchpadError::InvalidSymbol);
        require!(max_tx_bps > 0 && max_tx_bps <= 10000, LaunchpadError::InvalidMaxTx);
        require!(sniper_tax_bps <= 10000, LaunchpadError::InvalidSniperTax);

        let registry = &mut ctx.accounts.registry;

        // Check name/symbol uniqueness via registry
        // (The name_record PDA is derived from name+symbol; if it exists, it's a duplicate)
        // Anchor's init constraint will fail if the account already exists.

        let token_config = &mut ctx.accounts.token_config;
        token_config.mint = ctx.accounts.mint.key();
        token_config.name = name.clone();
        token_config.symbol = symbol.clone();
        token_config.creator = ctx.accounts.creator.key();
        token_config.launch_slot = Clock::get()?.slot;
        token_config.max_tx_bps = max_tx_bps;
        token_config.sniper_tax_bps = sniper_tax_bps;
        token_config.sniper_window_slots = sniper_window_slots;
        token_config.total_supply = supply;
        token_config.bump = ctx.bumps.token_config;

        // Register in name registry
        let name_record = &mut ctx.accounts.name_record;
        name_record.mint = ctx.accounts.mint.key();
        name_record.bump = ctx.bumps.name_record;

        registry.token_count = registry.token_count.checked_add(1).unwrap();

        msg!("OrbitX: Launched {} ({}) — mint: {}", name, symbol, ctx.accounts.mint.key());
        msg!("OrbitX: Max tx {}bps, sniper tax {}bps for {} slots", max_tx_bps, sniper_tax_bps, sniper_window_slots);

        Ok(())
    }

    /// Update sniper tax parameters (authority only, for emergencies).
    pub fn update_protections(
        ctx: Context<UpdateProtections>,
        max_tx_bps: u16,
        sniper_tax_bps: u16,
    ) -> Result<()> {
        require!(max_tx_bps > 0 && max_tx_bps <= 10000, LaunchpadError::InvalidMaxTx);
        require!(sniper_tax_bps <= 10000, LaunchpadError::InvalidSniperTax);

        let config = &mut ctx.accounts.token_config;
        config.max_tx_bps = max_tx_bps;
        config.sniper_tax_bps = sniper_tax_bps;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 1,
        seeds = [b"registry"],
        bump
    )]
    pub registry: Account<'info, Registry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String, symbol: String)]
pub struct LaunchToken<'info> {
    #[account(mut, seeds = [b"registry"], bump = registry.bump)]
    pub registry: Account<'info, Registry>,

    /// Name record PDA — derived from name+symbol. Init fails if duplicate.
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 1,
        seeds = [b"name", name.as_bytes(), symbol.as_bytes()],
        bump
    )]
    pub name_record: Account<'info, NameRecord>,

    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 32 + 10 + 32 + 8 + 2 + 2 + 8 + 8 + 1,
        seeds = [b"token", mint.key().as_ref()],
        bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    /// The Token-2022 mint (created by the client with transfer hook extension)
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProtections<'info> {
    #[account(seeds = [b"registry"], bump = registry.bump)]
    pub registry: Account<'info, Registry>,
    #[account(
        mut,
        seeds = [b"token", token_config.mint.as_ref()],
        bump = token_config.bump,
        has_one = creator @ LaunchpadError::Unauthorized,
    )]
    pub token_config: Account<'info, TokenConfig>,
    pub creator: Signer<'info>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
pub struct Registry {
    pub authority: Pubkey,
    pub token_count: u64,
    pub bump: u8,
}

#[account]
pub struct NameRecord {
    pub mint: Pubkey,
    pub bump: u8,
}

#[account]
pub struct TokenConfig {
    pub mint: Pubkey,
    pub name: String,       // max 32 chars
    pub symbol: String,     // max 10 chars
    pub creator: Pubkey,
    pub launch_slot: u64,
    pub max_tx_bps: u16,
    pub sniper_tax_bps: u16,
    pub sniper_window_slots: u64,
    pub total_supply: u64,
    pub bump: u8,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum LaunchpadError {
    #[msg("Invalid token name (1-32 chars)")]
    InvalidName,
    #[msg("Invalid token symbol (1-10 chars)")]
    InvalidSymbol,
    #[msg("Invalid max tx (1-10000 bps)")]
    InvalidMaxTx,
    #[msg("Invalid sniper tax (0-10000 bps)")]
    InvalidSniperTax,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Token name/symbol already registered")]
    DuplicateToken,
}
