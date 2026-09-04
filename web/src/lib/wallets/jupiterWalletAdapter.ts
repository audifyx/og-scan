/**
 * Jupiter Wallet extension adapter — uses window.jupiter.solana (not window.solana,
 * which Phantom may own when both extensions are installed).
 */
import {
  BaseMessageSignerWalletAdapter,
  scopePollingDetectionStrategy,
  WalletAccountError,
  WalletConnectionError,
  WalletDisconnectedError,
  WalletDisconnectionError,
  WalletError,
  WalletNotConnectedError,
  WalletNotReadyError,
  WalletPublicKeyError,
  WalletReadyState,
  WalletSignMessageError,
  WalletSignTransactionError,
  WalletSendTransactionError,
  isVersionedTransaction,
  type WalletName,
} from "@solana/wallet-adapter-base";
import type { SendTransactionOptions, WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PublicKey, VersionedTransaction, type Connection, type Transaction, type TransactionVersion } from "@solana/web3.js";
import { coercePublicKey, normalizeSignatureBytes, normalizeTxSignatureBase58 } from "@/lib/wallets/walletNormalize";

export const JupiterWalletName = "Jupiter" as WalletName<"Jupiter">;

type JupiterProvider = {
  isJupiter?: boolean;
  isConnected?: boolean;
  publicKey: PublicKey | string | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: PublicKey | string } | void>;
  disconnect(): Promise<void>;
  signMessage: (message: Uint8Array) => Promise<unknown>;
  signTransaction?: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  signAllTransactions?: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>;
  signAndSendTransaction?: (
    txOrInput:
      | Transaction
      | VersionedTransaction
      | { transaction: Transaction | VersionedTransaction; options?: SendTransactionOptions },
    opts?: SendTransactionOptions,
  ) => Promise<{ signature: string } | string>;
  on?: (event: "disconnect" | "accountChanged", handler: (...args: unknown[]) => void) => void;
  off?: (event: "disconnect" | "accountChanged", handler: (...args: unknown[]) => void) => void;
};

export function isJupiterWalletName(name?: string | null): boolean {
  return Boolean(name && /jupiter/i.test(name));
}

function extractJupiterSignature(result: unknown): string | null {
  try {
    const sig = normalizeTxSignatureBase58(result);
    return sig.length > 30 ? sig : null;
  } catch {
    return null;
  }
}

function isWalletUserRejection(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /reject|cancel|denied|user.?refus/i.test(msg);
}

/**
 * Legacy Transaction → VersionedTransaction. Jupiter signAndSend rejects unsigned
 * legacy serialize.
 *
 * compileMessage() builds a fresh message with an empty signature array, so any
 * signature already applied — an ephemeral mint keypair, an ATA authority, any
 * options.signers passed to sendTransaction — was silently discarded here. The
 * transaction then reached Jupiter one signer short and the extension failed with
 * "missing signature for public key". Carry the existing signatures over.
 */
export function toVersionedTransaction(
  transaction: Transaction | VersionedTransaction,
): VersionedTransaction {
  if ("version" in transaction) return transaction as VersionedTransaction;
  const legacy = transaction as Transaction;
  if (!legacy.feePayer) throw new Error("Transaction is missing feePayer");
  if (!legacy.recentBlockhash) throw new Error("Transaction is missing recentBlockhash");
  const versioned = new VersionedTransaction(legacy.compileMessage());
  for (const { publicKey, signature } of legacy.signatures) {
    if (signature) versioned.addSignature(publicKey, signature);
  }
  return versioned;
}

/**
 * True when the failure suggests the transaction already reached the network.
 * Retrying with the other argument shape after this would re-prompt the user and
 * risk broadcasting the same transaction twice, so these must propagate.
 */
function isPostBroadcastError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /already (been )?processed|already in flight|duplicate|blockhash not found|block height exceeded|simulation failed|insufficient (funds|lamports)|timed? ?out|expired|confirmed/i.test(
    msg,
  );
}

/**
 * Jupiter inject (window.jupiter.solana) — not Phantom's window.solana.
 * Newer builds take `{ transaction, options }`; older builds take positional args.
 */
export async function jupiterSignAndSendTransaction(
  transaction: Transaction | VersionedTransaction,
  sendOptions?: SendTransactionOptions,
): Promise<string> {
  const wallet = getJupiterProvider();
  if (!wallet) throw new Error("Jupiter wallet is not available in this browser");
  if (!wallet.signAndSendTransaction) {
    throw new Error("This Jupiter build cannot signAndSendTransaction — update the Jupiter extension");
  }
  const versioned = toVersionedTransaction(transaction);
  const fn = wallet.signAndSendTransaction.bind(wallet);

  // Only ONE of these shapes may ever be attempted per user approval. Retrying
  // after a call that already reached the wallet re-prompts for a signature and
  // can broadcast the same transaction twice.
  let acceptedWithoutSignature = false;
  try {
    const objectResult = await fn({ transaction: versioned, options: sendOptions });
    const sig = extractJupiterSignature(objectResult);
    if (sig) return sig;
    // Resolved, so the wallet took it. Do not send it a second time.
    acceptedWithoutSignature = true;
  } catch (error) {
    if (isWalletUserRejection(error)) throw error;
    // Older builds reject the object form outright, before any prompt — that is
    // the case worth retrying positionally. Anything that looks like it already
    // hit the network must not be retried.
    if (isPostBroadcastError(error)) throw error;
  }
  if (acceptedWithoutSignature) {
    throw new Error(
      "Jupiter accepted the transaction but returned no signature — check your wallet activity before retrying",
    );
  }

  const positional = await fn(versioned, sendOptions);
  const sig = extractJupiterSignature(positional);
  if (!sig) throw new Error("Jupiter did not return a transaction signature");
  return sig;
}

export function jupiterProviderPublicKey(): string | null {
  const wallet = getJupiterProvider();
  if (!wallet?.publicKey) return null;
  try {
    return coercePublicKey(wallet.publicKey).toBase58();
  } catch {
    return null;
  }
}

export function getJupiterProvider(): JupiterProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    jupiter?: { solana?: JupiterProvider; isJupiter?: boolean };
    solana?: JupiterProvider;
  };
  // Prefer dedicated Jupiter inject — never steal Phantom's window.solana.
  if (w.jupiter?.solana) return w.jupiter.solana;
  if (w.jupiter && (w.jupiter as JupiterProvider).connect) return w.jupiter as JupiterProvider;
  if (w.solana?.isJupiter) return w.solana;
  return null;
}

export class JupiterWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = JupiterWalletName;
  /**
   * Marks this as the legacy window.jupiter inject. When the extension also
   * registers over Wallet Standard both appear in the wallet list under the
   * same name; the Standard one signs more reliably in Chrome, so the picker
   * uses this flag to break the tie.
   */
  readonly isLegacyInject = true;
  /** Install / mobile page — never the jup.ag swap site (avoids trade→website confusion). */
  url = "https://jup.ag/mobile";
  icon = "https://jup.ag/favicon.ico";
  supportedTransactionVersions: ReadonlySet<TransactionVersion> | null = new Set(["legacy", 0]);

  private _connecting = false;
  private _wallet: JupiterProvider | null = null;
  private _publicKey: PublicKey | null = null;
  private _readyState: WalletReadyState;

  constructor(_network?: WalletAdapterNetwork) {
    super();
    this._readyState =
      typeof window === "undefined" || typeof document === "undefined"
        ? WalletReadyState.Unsupported
        : WalletReadyState.NotDetected;

    if (this._readyState !== WalletReadyState.Unsupported) {
      scopePollingDetectionStrategy(() => {
        if (getJupiterProvider()) {
          this._readyState = WalletReadyState.Installed;
          this.emit("readyStateChange", this._readyState);
          return true;
        }
        return false;
      });
    }
  }

  get publicKey() {
    return this._publicKey;
  }

  get connecting() {
    return this._connecting;
  }

  get readyState() {
    return this._readyState;
  }

  private _disconnected = () => {
    const wallet = this._wallet;
    if (!wallet) return;
    wallet.off?.("disconnect", this._disconnected);
    wallet.off?.("accountChanged", this._accountChanged);
    this._wallet = null;
    this._publicKey = null;
    this.emit("error", new WalletDisconnectedError());
    this.emit("disconnect");
  };

  private _accountChanged = (newPublicKey: PublicKey | string | null) => {
    if (!this._publicKey) return;
    if (!newPublicKey) {
      this._disconnected();
      return;
    }
    try {
      const pk =
        newPublicKey instanceof PublicKey ? newPublicKey : new PublicKey(newPublicKey);
      if (this._publicKey.equals(pk)) return;
      this._publicKey = pk;
      this.emit("connect", pk);
    } catch (error) {
      this.emit(
        "error",
        new WalletPublicKeyError(error instanceof Error ? error.message : String(error), error),
      );
    }
  };

  async connect(): Promise<void> {
    try {
      if (this.connected || this.connecting) return;
      if (this.readyState !== WalletReadyState.Installed) throw new WalletNotReadyError();

      this._connecting = true;
      const wallet = getJupiterProvider();
      if (!wallet) throw new WalletNotReadyError();

      let connectResult: { publicKey?: PublicKey | string } | void;
      try {
        connectResult = await wallet.connect();
      } catch (error) {
        throw new WalletConnectionError(error instanceof Error ? error.message : String(error), error);
      }

      let publicKey: PublicKey;
      try {
        publicKey = coercePublicKey(wallet.publicKey, connectResult);
      } catch (error) {
        throw new WalletPublicKeyError(
          error instanceof Error ? error.message : "Jupiter returned no public key",
          error,
        );
      }
      if (!publicKey) throw new WalletAccountError();

      wallet.on?.("disconnect", this._disconnected);
      wallet.on?.("accountChanged", this._accountChanged);
      this._wallet = wallet;
      this._publicKey = publicKey;
      this.emit("connect", publicKey);
    } catch (error) {
      this.emit("error", error);
      throw error;
    } finally {
      this._connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    const wallet = this._wallet;
    if (wallet) {
      wallet.off?.("disconnect", this._disconnected);
      wallet.off?.("accountChanged", this._accountChanged);
      this._wallet = null;
      this._publicKey = null;
      try {
        await wallet.disconnect();
      } catch (error) {
        this.emit(
          "error",
          new WalletDisconnectionError(error instanceof Error ? error.message : String(error), error),
        );
      }
    }
    this.emit("disconnect");
  }

  async sendTransaction(
    transaction: VersionedTransaction | Transaction,
    connection: Connection,
    options: SendTransactionOptions = {},
  ): Promise<string> {
    try {
      const wallet = this._wallet;
      if (!wallet) throw new WalletNotConnectedError();
      if (!wallet.signAndSendTransaction) {
        return super.sendTransaction(transaction, connection, options);
      }
      try {
        const { signers, ...sendOptions } = options;
        if (isVersionedTransaction(transaction)) {
          signers?.length && transaction.sign(signers);
        } else {
          transaction = await this.prepareTransaction(transaction, connection, sendOptions);
          signers?.length && transaction.partialSign(...signers);
        }
        sendOptions.preflightCommitment = sendOptions.preflightCommitment || connection.commitment;
        return jupiterSignAndSendTransaction(transaction, sendOptions);
      } catch (error) {
        if (error instanceof WalletError) throw error;
        throw new WalletSendTransactionError(error instanceof Error ? error.message : String(error), error);
      }
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    try {
      const wallet = this._wallet;
      if (!wallet?.signTransaction) throw new WalletNotConnectedError();
      try {
        const signed = await wallet.signTransaction(transaction);
        // Never fall back to the unsigned input — that surfaces as
        // "missing signature for public key" on serialize/send.
        if (!signed) throw new Error("Jupiter wallet returned no signed transaction");
        if (!("version" in signed)) {
          const missing = (signed as Transaction).signatures?.find((s) => !s.signature);
          if (missing) {
            throw new Error(
              `Jupiter returned an unsigned transaction (missing signature for ${missing.publicKey.toBase58()}). Reconnect Jupiter and use signAndSend.`,
            );
          }
        }
        return signed;
      } catch (error) {
        throw new WalletSignTransactionError(error instanceof Error ? error.message : String(error), error);
      }
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
    try {
      const wallet = this._wallet;
      if (!wallet?.signAllTransactions) throw new WalletNotConnectedError();
      try {
        const signed = await wallet.signAllTransactions(transactions);
        if (!signed?.length) throw new Error("Jupiter wallet returned no signed transactions");
        return signed;
      } catch (error) {
        throw new WalletSignTransactionError(error instanceof Error ? error.message : String(error), error);
      }
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    try {
      const wallet = this._wallet;
      if (!wallet) throw new WalletNotConnectedError();
      try {
        return normalizeSignatureBytes(await wallet.signMessage(message));
      } catch (error) {
        throw new WalletSignMessageError(error instanceof Error ? error.message : String(error), error);
      }
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }
}
