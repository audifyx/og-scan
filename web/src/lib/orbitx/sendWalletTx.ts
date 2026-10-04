/**
 * Shared wallet send helpers for OrbitX.
 *
 * The in-app (desk) wallet is the only wallet and it signs on the backend —
 * there is no client-side signer anymore (Phantom/Jupiter extension paths
 * removed). `sendWalletTransaction` is kept for import compatibility but
 * throws a clear error: backend-enabled flows (trades via orbitx_app_buy/sell,
 * burns via burnPurchase/spend) call the supercomputer MCP directly.
 *
 * Pure helpers (serialize, fee-payer, confirm) are unchanged.
 */
import {
  Connection,
  Keypair,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { normalizeTxSignatureBase58 } from "@/lib/wallets/walletNormalize";
import { confirmSignatureWithFallback, sendRawWithFallback } from "@/lib/solanaRpc";

export type WalletSendCaps = {
  sendTransaction?: (
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: { skipPreflight?: boolean; maxRetries?: number },
  ) => Promise<string>;
  signTransaction?: <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>;
  /** @deprecated — the in-app wallet is the only wallet now. */
  walletName?: string | null;
  /** @deprecated — Jupiter inject removed. */
  preferJupiter?: boolean;
  /** @deprecated — Phantom removed. */
  preferPhantom?: boolean;
};

export function walletCapsFromAdapter(
  wallet: { adapter?: { name?: string } | null } | undefined,
  caps: Pick<WalletSendCaps, "sendTransaction" | "signTransaction">,
): WalletSendCaps {
  return {
    sendTransaction: caps.sendTransaction,
    signTransaction: caps.signTransaction,
    walletName: wallet?.adapter?.name ?? null,
  };
}

export type WalletSendOptions = {
  /** When true, skip RPC preflight so the wallet prompt opens immediately. */
  skipPreflight?: boolean;
  maxRetries?: number;
};

export function toVersionedTransaction(tx: Transaction | VersionedTransaction): VersionedTransaction {
  if (isVersionedTx(tx)) return tx;
  // Legacy -> versioned is only meaningful pre-sign; the in-app wallet has no
  // client signer, so this is a structural helper for compat call sites.
  throw new Error(
    "Legacy transaction conversion needs a client signer, which no longer exists. " +
      "Use backend-signed trade/burn flows instead.",
  );
}

export function isVersionedTx(
  tx: Transaction | VersionedTransaction,
): tx is VersionedTransaction {
  return "version" in tx;
}

export function transactionFeePayer(tx: Transaction | VersionedTransaction): string | null {
  if (isVersionedTx(tx)) {
    return tx.message.staticAccountKeys[0]?.toBase58() ?? null;
  }
  return tx.feePayer?.toBase58() ?? null;
}

export function serializeSigned(signed: Transaction | VersionedTransaction): Uint8Array {
  if (isVersionedTx(signed)) {
    const missing = signed.signatures.some((s) => !s || s.every((b) => b === 0));
    if (missing) {
      throw new Error("Transaction is missing a signature.");
    }
    return signed.serialize();
  }
  const sigs = signed.signatures ?? [];
  const missing = sigs.find((s) => !s.signature);
  const unsignedKey = missing?.publicKey ?? (sigs.length === 0 ? signed.feePayer : null);
  if (unsignedKey) {
    throw new Error(
      `Transaction is unsigned (missing signature for ${unsignedKey.toBase58()}).`,
    );
  }
  return signed.serialize();
}

/** @deprecated — Jupiter inject removed. Always false. */
export function isPhantomWalletName(_name?: string | null): boolean {
  return false;
}

/** @deprecated — Jupiter inject removed. Always false. */
export function shouldUseJupiterInject(): boolean {
  return false;
}

/** Sign with a Keypair and broadcast (no extension wallet). */
export async function sendWithKeypair(
  connection: Connection,
  keypair: Keypair,
  tx: Transaction | VersionedTransaction,
  options?: WalletSendOptions,
): Promise<string> {
  const opts = {
    skipPreflight: options?.skipPreflight ?? false,
    maxRetries: options?.maxRetries ?? 3,
  };
  if (tx instanceof VersionedTransaction) {
    tx.sign([keypair]);
    return sendRawWithFallback(tx.serialize(), connection, opts);
  }
  tx.partialSign(keypair);
  return sendRawWithFallback(serializeSigned(tx), connection, opts);
}

/**
 * Sign and broadcast one legacy or versioned transaction.
 *
 * The in-app wallet signs on the backend — client-side signing no longer
 * exists. This throws a clear error instead of silently failing.
 */
export async function sendWalletTransaction(
  _connection: Connection,
  _wallet: WalletSendCaps,
  _tx: Transaction | VersionedTransaction,
  _options?: WalletSendOptions,
): Promise<string> {
  throw new Error(
    "Custom transactions need the in-app wallet's backend signer, which isn't enabled yet. " +
      "Trades run through the Trade tab (orbitx_app_buy/sell) and burns through the Shop — both backend-signed.",
  );
}

export type ConfirmSentOptions = {
  blockhash?: string;
  lastValidBlockHeight?: number;
  commitment?: "processed" | "confirmed" | "finalized";
};

/**
 * Confirm a wallet-sent tx. Treats encoding / "already processed" as success.
 */
export async function confirmSentTransaction(
  connection: Connection,
  signature: unknown,
  options?: ConfirmSentOptions,
): Promise<string> {
  const sig = normalizeTxSignatureBase58(signature);
  const commitment = options?.commitment ?? "confirmed";
  try {
    await confirmSignatureWithFallback(sig, connection, {
      blockhash: options?.blockhash,
      lastValidBlockHeight: options?.lastValidBlockHeight,
      commitment,
    });
    return sig;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/already been processed|already processed/i.test(msg)) return sig;
    if (/base58/i.test(msg)) return sig;
    throw error;
  }
}
