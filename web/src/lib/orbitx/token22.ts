/**
 * Orbitx custom lane — REAL on-chain token launch (Solana mainnet).
 *
 * Mints a Token-2022 SPL token in a single transaction:
 *   1. Flat $1.50 Orbitx launch fee -> PLATFORM_WALLET (same fee as pump lane)
 *   2. Create mint account (TransferFeeConfig + MetadataPointer extensions)
 *   3. TransferFeeConfig: 0.30% on every buy/sell — the SAME creator-fee rate
 *      pump.fun charges on its bonding curve. Fees accrue on-chain, withheld
 *      per token account, and are claimable ONLY by the creator wallet
 *      (withdraw-withheld authority) at /orbitxlaunch/claim.
 *      Anti-vamp: flagged look-alike launches get their fee authority routed
 *      to the OBX buyback wallet instead of the creator.
 *   4. MetadataPointer + on-chain token metadata (name/symbol/uri) — readable
 *      by Phantom, Solscan, Jupiter, Raydium, Birdeye (Metaplex-compatible
 *      display; the app's Token Manager can edit it later).
 *   5. Creator ATA + mint full supply, optional burn-at-launch
 *   6. Optional authority revokes (mint / freeze) per launch config
 *
 * The mint keypair signs (partialSign) + the creator wallet signs. Nothing
 * custodial — no server ever holds keys.
 */
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  ExtensionType, TOKEN_2022_PROGRAM_ID, getMintLen, getAssociatedTokenAddressSync,
  createInitializeMintInstruction, createInitializeMetadataPointerInstruction,
  createInitializeTransferFeeConfigInstruction, createAssociatedTokenAccountInstruction,
  createMintToCheckedInstruction, createBurnCheckedInstruction, createSetAuthorityInstruction,
  AuthorityType, TYPE_SIZE, LENGTH_SIZE,
} from "@solana/spl-token";
import { createInitializeInstruction, createUpdateAuthorityInstruction, pack, type TokenMetadata } from "@solana/spl-token-metadata";
import { PLATFORM_WALLET, CREATOR_FEE_BPS } from "@/lib/platformFee";

export interface CustomLaunchParams {
  connection: Connection;
  creator: PublicKey;          // connected wallet — payer, creator, fee-claim authority
  mintKeypair: Keypair;        // vanity-ground or random mint keypair
  name: string;
  symbol: string;
  metadataUri: string;
  decimals: number;
  supply: bigint;              // whole tokens (pre-decimals)
  burnPct: number;             // 0-100, burned at launch
  revokeMint: boolean;
  revokeFreeze: boolean;
  immutableMetadata: boolean;  // removes the metadata update authority at launch
  launchFeeLamports: number;   // flat $1.50 in lamports, -> PLATFORM_WALLET
  vampFlagged: boolean;        // true => creator fees force-routed to OBX buyback wallet
}

export interface CustomLaunchBuild {
  tx: Transaction;
  mint: PublicKey;
  creatorAta: PublicKey;
  feeAuthority: PublicKey;     // who can claim the 0.30% trading fees
}

const U64_MAX = BigInt("18446744073709551615");

export async function buildCustomLaunchTransaction(p: CustomLaunchParams): Promise<CustomLaunchBuild> {
  const mint = p.mintKeypair.publicKey;
  const platform = new PublicKey(PLATFORM_WALLET);
  // Anti-vamp enforcement: flagged copycats earn nothing — fee authority = OBX buyback wallet.
  const feeAuthority = p.vampFlagged ? platform : p.creator;

  const extensions = [ExtensionType.TransferFeeConfig, ExtensionType.MetadataPointer];
  const mintLen = getMintLen(extensions);
  const metadata: TokenMetadata = {
    mint,
    name: p.name.slice(0, 32),
    symbol: p.symbol.slice(0, 10),
    uri: p.metadataUri,
    additionalMetadata: [],
  };
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const rent = await p.connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

  const rawSupply = p.supply * BigInt(10) ** BigInt(p.decimals);
  const burnRaw = (rawSupply * BigInt(Math.max(0, Math.min(100, Math.round(p.burnPct))))) / BigInt(100);
  const creatorAta = getAssociatedTokenAddressSync(mint, p.creator, false, TOKEN_2022_PROGRAM_ID);

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));

  /* 1 — flat Orbitx launch fee (same $ amount as the pump lane) */
  if (p.launchFeeLamports > 0) {
    tx.add(SystemProgram.transfer({ fromPubkey: p.creator, toPubkey: platform, lamports: p.launchFeeLamports }));
  }

  /* 2 — mint account with extensions */
  tx.add(SystemProgram.createAccount({
    fromPubkey: p.creator,
    newAccountPubkey: mint,
    space: mintLen,
    lamports: rent,
    programId: TOKEN_2022_PROGRAM_ID,
  }));

  /* 3 — 0.30% creator fee on every transfer (pump.fun bonding-curve creator rate) */
  tx.add(createInitializeTransferFeeConfigInstruction(
    mint,
    feeAuthority,            // can change the fee config
    feeAuthority,            // can withdraw (claim) accrued fees
    CREATOR_FEE_BPS,         // 30 bps = 0.30%
    U64_MAX,                 // no per-transfer fee cap — pure percentage, like pump
    TOKEN_2022_PROGRAM_ID,
  ));

  /* 4 — metadata pointer (self) + init mint + on-chain metadata */
  tx.add(createInitializeMetadataPointerInstruction(mint, p.creator, mint, TOKEN_2022_PROGRAM_ID));
  tx.add(createInitializeMintInstruction(
    mint,
    p.decimals,
    p.creator,                                   // mint authority (needed for mintTo; optionally revoked below)
    p.revokeFreeze ? null : p.creator,           // freeze authority — null = revoked from birth
    TOKEN_2022_PROGRAM_ID,
  ));
  tx.add(createInitializeInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    mint,
    metadata: mint,
    name: metadata.name,
    symbol: metadata.symbol,
    uri: metadata.uri,
    mintAuthority: p.creator,
    updateAuthority: p.creator,
  }));

  /* 5 — full supply to the creator, optional burn-at-launch */
  tx.add(createAssociatedTokenAccountInstruction(p.creator, creatorAta, p.creator, mint, TOKEN_2022_PROGRAM_ID));
  tx.add(createMintToCheckedInstruction(mint, creatorAta, p.creator, rawSupply, p.decimals, [], TOKEN_2022_PROGRAM_ID));
  if (burnRaw > BigInt(0)) {
    tx.add(createBurnCheckedInstruction(creatorAta, mint, p.creator, burnRaw, p.decimals, [], TOKEN_2022_PROGRAM_ID));
  }

  /* 6 — authority revokes */
  if (p.revokeMint) {
    tx.add(createSetAuthorityInstruction(mint, p.creator, AuthorityType.MintTokens, null, [], TOKEN_2022_PROGRAM_ID));
  }
  if (p.immutableMetadata) {
    tx.add(createUpdateAuthorityInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      metadata: mint,
      oldAuthority: p.creator,
      newAuthority: null,
    }));
  }

  return { tx, mint, creatorAta, feeAuthority };
}

/** Lamports for the flat launch fee at the live SOL price. */
export function launchFeeLamports(feeUsd: number, solUsd: number): number {
  if (!solUsd || solUsd <= 0) return 0;
  return Math.ceil((feeUsd / solUsd) * LAMPORTS_PER_SOL);
}
