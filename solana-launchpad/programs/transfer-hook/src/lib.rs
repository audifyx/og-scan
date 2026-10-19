use anchor_lang::prelude::*;
use spl_transfer_hook_interface::instruction::TransferHookInstruction;

declare_id!("9WobRvPGR37kHaSiMyiss1LCDXvBHBAfJ3VpSJcfZTtW");

/// OrbitX Transfer Hook — enforced on every Token-2022 transfer.
///
/// Rules:
/// 1. Max transaction: no single transfer can exceed max_tx_bps of total supply.
/// 2. Sniper tax: transfers within sniper_window_slots of launch pay sniper_tax_bps.
///    (Tax is logged; actual collection happens via the fee mechanism.)
///
/// The hook reads the TokenConfig PDA (from the launchpad program) to get
/// the per-token parameters.

#[program]
pub mod orbitx_transfer_hook {
    use super::*;

    /// Called by Token-2022 on every transfer.
    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        let token_config = &ctx.accounts.token_config;

        // 1. Enforce max transaction size
        let max_amount = (token_config.total_supply as u128)
            .checked_mul(token_config.max_tx_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        require!(
            amount <= max_amount,
            TransferHookError::ExceedsMaxTx
        );

        // 2. Check sniper window
        let current_slot = Clock::get()?.slot;
        let slots_since_launch = current_slot.saturating_sub(token_config.launch_slot);

        if slots_since_launch < token_config.sniper_window_slots {
            let tax_amount = (amount as u128)
                .checked_mul(token_config.sniper_tax_bps as u128)
                .unwrap()
                .checked_div(10000)
                .unwrap() as u64;

            msg!(
                "OrbitX sniper tax: {} tokens taxed at {}bps ({} slots since launch)",
                tax_amount,
                token_config.sniper_tax_bps,
                slots_since_launch
            );
            // Note: actual tax collection would transfer to a fee vault.
            // For the MVP, we log and enforce. Full fee collection in v2.
        }

        msg!(
            "OrbitX transfer approved: {} tokens (max: {})",
            amount,
            max_amount
        );
        Ok(())
    }

    /// Fallback for unknown instructions (required by transfer hook interface).
    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        let instruction = TransferHookInstruction::unpack(data)?;

        match instruction {
            TransferHookInstruction::Execute { amount } => {
                let amount_bytes = amount.to_le_bytes();
                __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
            }
            _ => Err(ProgramError::InvalidInstructionData.into()),
        }
    }
}

#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(
        seeds = [b"token", mint.key().as_ref()],
        bump,
        seeds::program = launchpad_program.key(),
    )]
    pub token_config: Account<'info, TokenConfigLite>,
    pub mint: UncheckedAccount<'info>,
    pub launchpad_program: UncheckedAccount<'info>,
}

/// Minimal TokenConfig for the hook (must match launchpad program layout).
#[account]
pub struct TokenConfigLite {
    pub mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub creator: Pubkey,
    pub launch_slot: u64,
    pub max_tx_bps: u16,
    pub sniper_tax_bps: u16,
    pub sniper_window_slots: u64,
    pub total_supply: u64,
    pub bump: u8,
}

#[error_code]
pub enum TransferHookError {
    #[msg("Transfer exceeds max transaction limit")]
    ExceedsMaxTx,
}
