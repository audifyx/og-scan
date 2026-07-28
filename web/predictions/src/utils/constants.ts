import { PublicKey } from '@solana/web3.js';

// Platform wallets (hardcoded for security)
export const TREASURY_WALLET = new PublicKey('9ZygxJ8AsvQLK9368uyuxQ4uTkmSj2EsjwAy3UdSQWgY');
export const GLOBAL_POOL_WALLET = new PublicKey('45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE');

const SYSTEM_PROGRAM = '11111111111111111111111111111111';

function safePublicKey(value: string | undefined, fallback = SYSTEM_PROGRAM): PublicKey {
  try { return new PublicKey(value || fallback); } catch { return new PublicKey(fallback); }
}

export const PROGRAM_ID = safePublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID);
export const LAMPORTS_PER_SOL = 1_000_000_000;

// Dynamic fee tiers (USD denominated, converted to SOL at placement)
export const FEE_TIERS = {
  small:  { maxUsd: 50,  feeUsd: 1  },
  medium: { maxUsd: 500, feeUsd: 5  },
  large:  { maxUsd: 500, feeUsd: 10 },
} as const;

// Calculate platform fee in SOL given pool size in SOL and SOL/USD price
export function calcFeeSOL(poolSizeSOL: number, solPriceUsd: number): number {
  const poolUsd = poolSizeSOL * solPriceUsd;
  if (poolUsd < 50)  return FEE_TIERS.small.feeUsd  / solPriceUsd;
  if (poolUsd < 500) return FEE_TIERS.medium.feeUsd / solPriceUsd;
  return FEE_TIERS.large.feeUsd / solPriceUsd;
}

// USDC SPL token mint (devnet + mainnet same address)
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

export const CATEGORIES = ['Crypto', 'Trenches', 'Politics', 'Sports', 'Stocks', 'Memes', 'Pop Culture', 'Entertainment', 'Tech', 'Custom'];

export const getBetPDA = async (creator: PublicKey, betId: bigint) => {
  const [pda] = await PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), creator.toBuffer(), Buffer.from(new BigInt64Array([betId]).buffer)],
    PROGRAM_ID
  );
  return pda;
};

export const getEscrowPDA = async (betPubkey: PublicKey) => {
  const [pda] = await PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), betPubkey.toBuffer()],
    PROGRAM_ID
  );
  return pda;
};

export const shortenAddress = (address: string, chars = 4) =>
  `${address.slice(0, chars)}...${address.slice(-chars)}`;

export const formatSOL = (lamports: number) =>
  (lamports / LAMPORTS_PER_SOL).toFixed(3);

export const formatExpiry = (ts: number) => {
  const diff = ts - Date.now() / 1000;
  if (diff < 0) return 'Expired';
  if (diff < 3600) return `${Math.floor(diff / 60)}m left`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h left`;
  return `${Math.floor(diff / 86400)}d left`;
};

export const formatCountdown = (expiryISO: string) => {
  const diff = Math.max(0, new Date(expiryISO).getTime() - Date.now());
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
};
