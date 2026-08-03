/**
 * Shared wallet send helper for OrbitX Trade tools (burn, claim, rent, unwrap).
 *
 * Prefer `sendTransaction` (Phantom/Jupiter `signAndSendTransaction`) — same path as
 * TradingTerminal. Manual `signTransaction` + `sendRawTransaction` can return an
 * unsigned tx from some adapters, which then throws:
 * "Signature verification failed. Missing signature for public key …" on serialize.
 *
 * Local trading wallets: pass a Keypair to `sendWithKeypair` (partialSign / sign + sendRaw).
 */
import {
  Connection,
  Keypair,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

export type WalletSendCaps = {
  sendTransaction?: (
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: { skipPreflight?: boolean; maxRetries?: number },
  ) => Promise<string>;
  signTransaction?: <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>;
};

export type WalletSendOptions = {
  /** When true, skip RPC preflight so the wallet prompt opens immediately. */
  skipPreflight?: boolean;
  maxRetries?: number;
};

function serializeSigned(signed: Transaction | VersionedTransaction): Uint8Array {
  if (signed instanceof VersionedTransaction) return signed.serialize();
  const sigs = signed.signatures ?? [];
  const missing = sigs.find((s) => !s.signature);
  if (missing) {
    throw new Error(
      `Wallet returned an unsigned transaction (missing signature for ${missing.publicKey.toBase58()}). Reconnect Phantom/Jupiter and try again.`,
    );
  }
  return signed.serialize();
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
  if (wallet.sendTransaction) {
    return wallet.sendTransaction(tx, connection, opts);
  }
  if (wallet.signTransaction) {
    const signed = await wallet.signTransaction(tx);
    return connection.sendRawTransaction(serializeSigned(signed), opts);
  }
  throw new Error("This wallet can't sign here — connect Phantom or Jupiter");
}
