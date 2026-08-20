/**
 * Shared wallet send helper for OrbitX Trade tools (burn, claim, rent, unwrap).
 *
 * Prefer Jupiter `signAndSendTransaction` (window.jupiter.solana) when the
 * connected wallet is Jupiter or the fee-payer matches the Jupiter inject.
 * Manual `signTransaction` + `sendRawTransaction` can return an unsigned
 * legacy tx from some adapters, which then throws:
 * "Signature verification failed. Missing signature for public key …"
 */
import {
  Connection,
  Keypair,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getJupiterProvider,
  isJupiterWalletName,
  jupiterProviderPublicKey,
  jupiterSignAndSendTransaction,
  toVersionedTransaction,
} from "@/lib/wallets/jupiterWalletAdapter";
import { normalizeTxSignatureBase58 } from "@/lib/wallets/walletNormalize";

export type WalletSendCaps = {
  sendTransaction?: (
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: { skipPreflight?: boolean; maxRetries?: number },
  ) => Promise<string>;
  signTransaction?: <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>;
  /** Adapter display name — "Jupiter" / "Jupiter Wallet" routes to the Jupiter inject. */
  walletName?: string | null;
  /** Force the Jupiter inject even when the adapter name is missing. */
  preferJupiter?: boolean;
};

export type WalletSendOptions = {
  /** When true, skip RPC preflight so the wallet prompt opens immediately. */
  skipPreflight?: boolean;
  maxRetries?: number;
};

export { toVersionedTransaction };

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
      throw new Error(
        "Wallet returned an unsigned versioned transaction. Reconnect Jupiter and try again.",
      );
    }
    return signed.serialize();
  }
  const sigs = signed.signatures ?? [];
  const missing = sigs.find((s) => !s.signature);
  const unsignedKey = missing?.publicKey ?? (sigs.length === 0 ? signed.feePayer : null);
  if (unsignedKey) {
    throw new Error(
      `Wallet returned an unsigned transaction (missing signature for ${unsignedKey.toBase58()}). Reconnect Jupiter and try again.`,
    );
  }
  return signed.serialize();
}

export function shouldUseJupiterInject(
  wallet: Pick<WalletSendCaps, "walletName" | "preferJupiter">,
  feePayer?: string | null,
): boolean {
  if (!getJupiterProvider()?.signAndSendTransaction) return false;
  if (wallet.preferJupiter) return true;
  if (isJupiterWalletName(wallet.walletName)) return true;
  const jupiterPk = jupiterProviderPublicKey();
  return Boolean(feePayer && jupiterPk && feePayer === jupiterPk);
}

/** Sign with a local Keypair and broadcast (no extension wallet). */
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
    return connection.sendRawTransaction(tx.serialize(), opts);
  }
  tx.partialSign(keypair);
  return connection.sendRawTransaction(serializeSigned(tx), opts);
}

/** Sign and broadcast one legacy or versioned transaction. */
export async function sendWalletTransaction(
  connection: Connection,
  wallet: WalletSendCaps,
  tx: Transaction | VersionedTransaction,
  options?: WalletSendOptions,
): Promise<string> {
  const opts = {
    skipPreflight: options?.skipPreflight ?? false,
    maxRetries: options?.maxRetries ?? 3,
  };
  const feePayer = transactionFeePayer(tx);

  if (shouldUseJupiterInject(wallet, feePayer)) {
    return normalizeTxSignatureBase58(await jupiterSignAndSendTransaction(tx, opts));
  }

  const versioned = toVersionedTransaction(tx);
  if (wallet.sendTransaction) {
    return normalizeTxSignatureBase58(await wallet.sendTransaction(versioned, connection, opts));
  }
  if (wallet.signTransaction) {
    const signed = await wallet.signTransaction(tx);
    return normalizeTxSignatureBase58(await connection.sendRawTransaction(serializeSigned(signed), opts));
  }
  throw new Error("This wallet can't sign here — connect Phantom");
}

export type ConfirmSentOptions = {
  blockhash?: string;
  lastValidBlockHeight?: number;
  commitment?: "processed" | "confirmed" | "finalized";
};

/**
 * Confirm a wallet-sent tx. Always normalizes Phantom base64 signatures first.
 * If the swap already landed, treat encoding / "already processed" as success
 * so the sign page can finish the workflow.
 */
export async function confirmSentTransaction(
  connection: Connection,
  signature: unknown,
  options?: ConfirmSentOptions,
): Promise<string> {
  const sig = normalizeTxSignatureBase58(signature);
  const commitment = options?.commitment ?? "confirmed";
  try {
    if (options?.blockhash && options.lastValidBlockHeight != null) {
      await connection.confirmTransaction(
        { signature: sig, blockhash: options.blockhash, lastValidBlockHeight: options.lastValidBlockHeight },
        commitment,
      );
    } else {
      await connection.confirmTransaction(sig, commitment);
    }
    return sig;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/already been processed|already processed/i.test(msg)) return sig;
    try {
      const st = await connection.getSignatureStatus(sig);
      if (st?.value && !st.value.err) return sig;
    } catch {
      /* RPC status is best-effort */
    }
    if (/base58/i.test(msg)) return sig;
    throw error;
  }
}
