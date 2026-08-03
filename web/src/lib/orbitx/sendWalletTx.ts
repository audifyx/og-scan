/**
 * Shared wallet send helper for OrbitX Trade tools (burn, claim, rent, unwrap).
 *
 * Prefer `sendTransaction` (Phantom/Jupiter `signAndSendTransaction`) — same path as
 * TradingTerminal. Manual `signTransaction` + `sendRawTransaction` can return an
 * unsigned tx from some adapters, which then throws:
 * "Signature verification failed. Missing signature for public key …" on serialize.
 */
import {
  Connection,
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

/** Sign and broadcast one legacy or versioned transaction. */
export async function sendWalletTransaction(
  connection: Connection,
  wallet: WalletSendCaps,
  tx: Transaction | VersionedTransaction,
): Promise<string> {
  if (wallet.sendTransaction) {
    return wallet.sendTransaction(tx, connection, { skipPreflight: false, maxRetries: 3 });
  }
  if (wallet.signTransaction) {
    const signed = await wallet.signTransaction(tx);
    return connection.sendRawTransaction(serializeSigned(signed), {
      skipPreflight: false,
      maxRetries: 3,
    });
  }
  throw new Error("This wallet can't sign here — connect Phantom or Jupiter");
}
