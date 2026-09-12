import {
  PublicKey,
  TransactionInstruction,
  ComputeBudgetProgram,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PUMP_PROGRAM_ID, pumpCreatorVaultPda, pumpEventAuthorityPda } from "@/lib/orbitx/claim";
import { SOL_MINT } from "./types";

export const PUMP_AMM_PROGRAM_ID = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
export const COLLECT_CREATOR_FEE_V2_DISCRIMINATOR = [207, 17, 138, 242, 4, 34, 19, 56];
export const COLLECT_COIN_CREATOR_FEE_DISCRIMINATOR = [160, 57, 89, 42, 181, 139, 43, 66];

export function pumpAmmCreatorVaultPda(creator: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("creator_vault"), creator.toBytes()],
    PUMP_AMM_PROGRAM_ID,
  )[0];
}

function pumpAmmEventAuthorityPda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("__event_authority")],
    PUMP_AMM_PROGRAM_ID,
  )[0];
}

/** Permissionless collect_creator_fee_v2. Anyone may be payer; funds still land in `creator`. */
export function buildCollectCreatorFeeV2Instruction(args: {
  creator: PublicKey;
  quoteMint?: PublicKey;
  quoteTokenProgram?: PublicKey;
}): TransactionInstruction {
  const quoteMint = args.quoteMint ?? new PublicKey(SOL_MINT);
  const quoteTokenProgram = args.quoteTokenProgram ?? TOKEN_PROGRAM_ID;
  const vault = pumpCreatorVaultPda(args.creator);
  const creatorAta = getAssociatedTokenAddressSync(quoteMint, args.creator, true, quoteTokenProgram);
  const vaultAta = getAssociatedTokenAddressSync(quoteMint, vault, true, quoteTokenProgram);
  return new TransactionInstruction({
    programId: PUMP_PROGRAM_ID,
    keys: [
      { pubkey: args.creator, isSigner: false, isWritable: true },
      { pubkey: creatorAta, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: quoteMint, isSigner: false, isWritable: false },
      { pubkey: quoteTokenProgram, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: pumpEventAuthorityPda(), isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Uint8Array.from(COLLECT_CREATOR_FEE_V2_DISCRIMINATOR),
  });
}

export function buildCollectCoinCreatorFeeInstruction(args: {
  creator: PublicKey;
  quoteMint?: PublicKey;
  quoteTokenProgram?: PublicKey;
}): TransactionInstruction {
  const quoteMint = args.quoteMint ?? new PublicKey(SOL_MINT);
  const quoteTokenProgram = args.quoteTokenProgram ?? TOKEN_PROGRAM_ID;
  const vaultAuth = pumpAmmCreatorVaultPda(args.creator);
  const vaultAta = getAssociatedTokenAddressSync(quoteMint, vaultAuth, true, quoteTokenProgram);
  const creatorAta = getAssociatedTokenAddressSync(quoteMint, args.creator, true, quoteTokenProgram);
  return new TransactionInstruction({
    programId: PUMP_AMM_PROGRAM_ID,
    keys: [
      { pubkey: quoteMint, isSigner: false, isWritable: false },
      { pubkey: quoteTokenProgram, isSigner: false, isWritable: false },
      { pubkey: args.creator, isSigner: false, isWritable: false },
      { pubkey: vaultAuth, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: creatorAta, isSigner: false, isWritable: true },
      { pubkey: pumpAmmEventAuthorityPda(), isSigner: false, isWritable: false },
      { pubkey: PUMP_AMM_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Uint8Array.from(COLLECT_COIN_CREATOR_FEE_DISCRIMINATOR),
  });
}

export function sweepCopy(creatorAbbrev: string): string {
  return `You pay network gas. Fees go to the registered creator wallet ${creatorAbbrev}, not to you.`;
}

export function buildSweepInstructions(opts: {
  creator: PublicKey;
  graduated?: boolean;
  quoteMint?: PublicKey;
}): TransactionInstruction[] {
  const ixs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
  ];
  if (opts.graduated) {
    ixs.push(buildCollectCoinCreatorFeeInstruction({ creator: opts.creator, quoteMint: opts.quoteMint }));
  }
  ixs.push(buildCollectCreatorFeeV2Instruction({ creator: opts.creator, quoteMint: opts.quoteMint }));
  return ixs;
}
