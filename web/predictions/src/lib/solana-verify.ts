import { Connection } from '@solana/web3.js';

const RPC =
  process.env.SOLANA_RPC_ENDPOINT ||
  process.env.NEXT_PUBLIC_RPC_ENDPOINT ||
  'https://api.mainnet-beta.solana.com';

export interface DepositCheck {
  ok: boolean;
  lamports: number;
  error?: string;
}

/**
 * Verify that `signature` is a confirmed Solana transfer of at least
 * `minLamports` from `fromWallet` into `treasury`. Returns the exact
 * amount the treasury received so we credit the real on-chain value.
 */
export async function verifyDeposit(
  signature: string,
  fromWallet: string,
  treasury: string,
  minLamports: number,
): Promise<DepositCheck> {
  try {
    const conn = new Connection(RPC, 'confirmed');
    const tx = await conn.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
    if (!tx) return { ok: false, lamports: 0, error: 'Transaction not found or not yet confirmed. Wait a few seconds and retry.' };
    if (tx.meta?.err) return { ok: false, lamports: 0, error: 'That transaction failed on-chain.' };

    const keys = tx.transaction.message.accountKeys;
    const tIdx = keys.findIndex((k) => k.pubkey.toBase58() === treasury);
    if (tIdx < 0) return { ok: false, lamports: 0, error: 'This transaction did not pay the treasury wallet.' };

    const fromOk = keys.some((k) => k.pubkey.toBase58() === fromWallet && k.signer);
    if (!fromOk) return { ok: false, lamports: 0, error: 'This transaction was not signed by your connected wallet.' };

    const delta = (tx.meta!.postBalances[tIdx] || 0) - (tx.meta!.preBalances[tIdx] || 0);
    if (delta < minLamports) {
      return { ok: false, lamports: delta, error: `Treasury received ${(delta / 1e9).toFixed(4)} SOL, which is below the minimum.` };
    }
    return { ok: true, lamports: delta };
  } catch (e: any) {
    return { ok: false, lamports: 0, error: e?.message || 'Verification error' };
  }
}

/**
 * Verify that `signature` is a confirmed Solana transfer of at least
 * `minLamports` FROM the treasury TO `toWallet`. Used to prove a winner
 * was actually paid out on-chain. A small fee tolerance is allowed so a
 * payout that's a few thousand lamports short (rounding/fees) still counts.
 */
export async function verifyPayout(
  signature: string,
  treasury: string,
  toWallet: string,
  minLamports: number,
): Promise<DepositCheck> {
  try {
    const conn = new Connection(RPC, 'confirmed');
    const tx = await conn.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
    if (!tx) return { ok: false, lamports: 0, error: 'Transaction not found or not yet confirmed. Wait a few seconds and retry.' };
    if (tx.meta?.err) return { ok: false, lamports: 0, error: 'That transaction failed on-chain.' };

    const keys = tx.transaction.message.accountKeys;
    const toIdx = keys.findIndex((k) => k.pubkey.toBase58() === toWallet);
    if (toIdx < 0) return { ok: false, lamports: 0, error: 'This transaction did not pay the winner wallet.' };

    if (treasury) {
      const fromOk = keys.some((k) => k.pubkey.toBase58() === treasury && k.signer);
      if (!fromOk) return { ok: false, lamports: 0, error: 'This transaction was not sent (signed) by the treasury wallet.' };
    }

    const delta = (tx.meta!.postBalances[toIdx] || 0) - (tx.meta!.preBalances[toIdx] || 0);
    const tolerance = Math.max(5000, Math.floor(minLamports * 0.005));
    if (delta < minLamports - tolerance) {
      return { ok: false, lamports: delta, error: `Winner received ${(delta / 1e9).toFixed(4)} SOL, which is below the owed payout.` };
    }
    return { ok: true, lamports: delta };
  } catch (e: any) {
    return { ok: false, lamports: 0, error: e?.message || 'Verification error' };
  }
}

/** A plausible Solana tx signature (base58, ~87-88 chars). Excludes our 'manual_' placeholders. */
export function looksLikeSignature(s: string | null | undefined): boolean {
  if (!s) return false;
  if (s.startsWith('manual_')) return false;
  return /^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(s);
}
