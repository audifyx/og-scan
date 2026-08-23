/**
 * Shared wallet send helper for OrbitX Trade tools (buy, burn, claim, rent).
 *
 * Prefer Jupiter `signAndSendTransaction` (window.jupiter.solana) when the
 * connected wallet is Jupiter or the fee-payer matches the Jupiter inject.
 * Manual `signTransaction` + `sendRawTransaction` can return an unsigned
 * legacy tx from some adapters, which then throws:
 * "Signature verification failed. Missing signature for public key …"
 *
 * Chrome buys use Jupiter `signAndSendTransaction` (`preferJupiter`), never
 * Phantom `signTransaction` + `serialize()` — that throws
 * "Missing signature for public key [jYbHk588…]".
 * Platform fee wallets are destinations only — never extra required signers.
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
import { PLATFORM_WALLET } from "@/lib/platformFee";
import { ROUTED_FEE_WALLET } from "@/lib/orbitx/feeRouting";

/** Desk / owner wallets that receive SOL. They must never be required signers. */
export const FEE_DESTINATION_WALLETS = [PLATFORM_WALLET, ROUTED_FEE_WALLET] as const;

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
  /** Legacy flag — ignored when preferJupiter is set. Sign page never uses Phantom Connect. */
  preferPhantom?: boolean;
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

/** Caps from `@solana/wallet-adapter-react` `useWallet()`. */
export function walletCapsFromAdapter(
  wallet: {
    sendTransaction?: WalletSendCaps["sendTransaction"] | null;
    signTransaction?: WalletSendCaps["signTransaction"] | null;
    wallet?: { adapter?: { name?: string | null } | null } | null;
  },
  extras?: Pick<WalletSendCaps, "preferJupiter" | "preferPhantom">,
): WalletSendCaps {
  return {
    sendTransaction: wallet.sendTransaction ?? undefined,
    signTransaction: wallet.signTransaction ?? undefined,
    walletName: wallet.wallet?.adapter?.name ?? null,
    preferJupiter: extras?.preferJupiter,
    preferPhantom: extras?.preferPhantom,
  };
}

export function decodeBase64Transaction(b64: string): VersionedTransaction | Transaction {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
}

export function transactionFeePayer(tx: Transaction | VersionedTransaction): string | null {
  if (isVersionedTx(tx)) {
    return tx.message.staticAccountKeys[0]?.toBase58() ?? null;
  }
  return tx.feePayer?.toBase58() ?? null;
}

/** Required signers for a compiled message (fee payer first). */
export function requiredSignerKeys(tx: Transaction | VersionedTransaction): string[] {
  if (isVersionedTx(tx)) {
    const n = tx.message.header.numRequiredSignatures;
    return tx.message.staticAccountKeys.slice(0, n).map((k) => k.toBase58());
  }
  const keys = new Set<string>();
  if (tx.feePayer) keys.add(tx.feePayer.toBase58());
  for (const sig of tx.signatures ?? []) {
    keys.add(sig.publicKey.toBase58());
  }
  for (const ix of tx.instructions ?? []) {
    for (const meta of ix.keys ?? []) {
      if (meta.isSigner) keys.add(meta.pubkey.toBase58());
    }
  }
  return [...keys];
}

/**
 * A Chrome buy/swap may list the desk wallet as a writable destination.
 * It must not list that wallet as a required signer unless it is the buyer.
 */
export function unexpectedFeeWalletSigners(
  tx: Transaction | VersionedTransaction,
  userPublicKey?: string | null,
): string[] {
  const user = userPublicKey || transactionFeePayer(tx);
  return requiredSignerKeys(tx).filter(
    (key) =>
      (FEE_DESTINATION_WALLETS as readonly string[]).includes(key) && key !== user,
  );
}

export function assertSwapSigners(
  tx: Transaction | VersionedTransaction,
  userPublicKey?: string | null,
): void {
  const extra = unexpectedFeeWalletSigners(tx, userPublicKey);
  if (extra[0]) {
    throw new Error(
      `Buy transaction incorrectly requires a platform fee wallet to sign (${extra[0]}). Rebuild the swap — fee wallets are destinations only.`,
    );
  }
}

function rewriteMissingSignatureError(error: unknown): never {
  const msg = error instanceof Error ? error.message : String(error);
  const match = msg.match(/Missing signature for public key \[`?([^\]`]+)`?\]/i);
  if (match?.[1]) {
    throw new Error(
      `Wallet returned an unsigned transaction (missing signature for ${match[1]}). Open Jupiter Wallet in Chrome and Buy again — do not use Phantom serialize.`,
    );
  }
  throw error instanceof Error ? error : new Error(msg);
}

export function serializeSigned(signed: Transaction | VersionedTransaction): Uint8Array {
  if (isVersionedTx(signed)) {
    const missing = signed.signatures.some((s) => !s || s.every((b) => b === 0));
    if (missing) {
      const payer = transactionFeePayer(signed);
      throw new Error(
        payer
          ? `Wallet returned an unsigned transaction (missing signature for ${payer}). Open Jupiter Wallet in Chrome and Buy again — do not use Phantom serialize.`
          : "Wallet returned an unsigned versioned transaction. Open Jupiter Wallet in Chrome and try again.",
      );
    }
    try {
      return signed.serialize();
    } catch (error) {
      rewriteMissingSignatureError(error);
    }
  }
  const sigs = signed.signatures ?? [];
  const missing = sigs.find((s) => !s.signature);
  const unsignedKey = missing?.publicKey ?? (sigs.length === 0 ? signed.feePayer : null);
  if (unsignedKey) {
    throw new Error(
      `Wallet returned an unsigned transaction (missing signature for ${unsignedKey.toBase58()}). Open Jupiter Wallet in Chrome and Buy again — do not use Phantom serialize.`,
    );
  }
  try {
    return signed.serialize();
  } catch (error) {
    rewriteMissingSignatureError(error);
  }
}

export function isPhantomWalletName(name?: string | null): boolean {
  return Boolean(name && /phantom/i.test(name));
}

export function shouldUseJupiterInject(
  wallet: Pick<WalletSendCaps, "walletName" | "preferJupiter" | "preferPhantom">,
  feePayer?: string | null,
): boolean {
  if (!getJupiterProvider()?.signAndSendTransaction) return false;
  // Chrome buys set preferJupiter so Jupiter signs even when the adapter
  // still says "Phantom" (both extensions installed).
  if (wallet.preferJupiter) return true;
  if (wallet.preferPhantom) return false;
  if (isPhantomWalletName(wallet.walletName)) return false;
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
  assertSwapSigners(tx, feePayer);

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
  throw new Error("This wallet can't sign here — connect Jupiter Wallet in Chrome");
}

/**
 * Chrome buy/swap: Jupiter `signAndSend` only.
 * Phantom `signTransaction` + `serialize()` is what throws
 * "Missing signature for public key [jYbHk588…]".
 */
export async function sendBuyTransaction(
  connection: Connection,
  wallet: WalletSendCaps,
  tx: Transaction | VersionedTransaction,
  options?: WalletSendOptions,
): Promise<string> {
  if (!getJupiterProvider()?.signAndSendTransaction) {
    throw new Error("Connect Jupiter Wallet in Chrome to buy. Phantom cannot serialize this swap.");
  }
  const feePayer = transactionFeePayer(tx);
  const jupiterPk = jupiterProviderPublicKey();
  if (feePayer && jupiterPk && jupiterPk !== feePayer) {
    throw new Error(
      `Jupiter is connected as ${jupiterPk.slice(0, 4)}…${jupiterPk.slice(-4)} but this buy needs ${feePayer.slice(0, 4)}…${feePayer.slice(-4)}. Switch Jupiter to that account.`,
    );
  }
  return sendWalletTransaction(
    connection,
    { ...wallet, preferJupiter: true, preferPhantom: false },
    tx,
    options,
  );
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
