/**
 * Custom Phantom Wallet adapter — robust detection for Phantom extension.
 * Handles the case where Phantom is installed but not detected by the standard adapter.
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
import { PublicKey, type Connection, type Transaction, type TransactionVersion, type VersionedTransaction } from "@solana/web3.js";

export const PhantomWalletName = "Phantom" as WalletName<"Phantom">;

type PhantomProvider = {
  isPhantom?: boolean;
  isConnected?: boolean;
  publicKey: PublicKey | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signMessage: (message: Uint8Array, display?: string) => Promise<{ signature: Uint8Array; publicKey: PublicKey }>;
  signTransaction?: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  signAllTransactions?: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>;
  signAndSendTransaction?: (
    tx: Transaction | VersionedTransaction,
    opts?: SendTransactionOptions,
  ) => Promise<{ signature: string }>;
  on?: (event: "disconnect" | "accountChanged" | "connect", handler: (...args: unknown[]) => void) => void;
  off?: (event: "disconnect" | "accountChanged" | "connect", handler: (...args: unknown[]) => void) => void;
  request?: (method: string, params: unknown) => Promise<unknown>;
};

export function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { phantom?: { solana?: PhantomProvider }; solana?: PhantomProvider };
  
  // Try window.phantom.solana first (most reliable when multiple wallets installed)
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
  
  // Fallback to window.solana if it's Phantom
  if (w.solana?.isPhantom) return w.solana;
  
  // Additional check for newer Phantom versions
  if (w.phantom?.solana) return w.phantom.solana;
  if (w.solana) return w.solana;
  
  return null;
}

function normalizeSignature(result: Uint8Array | { signature: Uint8Array }): Uint8Array {
  if (result instanceof Uint8Array) return result;
  if (result && typeof result === "object" && result.signature instanceof Uint8Array) return result.signature;
  throw new Error("wallet returned an invalid signature");
}

export class PhantomWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = PhantomWalletName;
  url = "https://phantom.app";
  icon = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIxIiB5PSIxIiB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHJ4PSI2IiBmaWxsPSIjQUE2RkZGIi8+PC9zdmc+";
  supportedTransactionVersions: ReadonlySet<TransactionVersion> | null = new Set(["legacy", 0]);

  private _connecting = false;
  private _wallet: PhantomProvider | null = null;
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
        const provider = getPhantomProvider();
        if (provider) {
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
    wallet.off?.("connect", this._connected);
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
      const pk = newPublicKey instanceof PublicKey ? newPublicKey : new PublicKey(newPublicKey);
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

  private _connected = () => {
    const wallet = this._wallet;
    if (!wallet?.publicKey) return;
    try {
      const pk = new PublicKey(wallet.publicKey.toBytes());
      if (this._publicKey?.equals(pk)) return;
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
      const wallet = getPhantomProvider();
      if (!wallet) throw new WalletNotReadyError();

      if (!wallet.isConnected) {
        try {
          await wallet.connect();
        } catch (error) {
          throw new WalletConnectionError(error instanceof Error ? error.message : String(error), error);
        }
      }

      if (!wallet.publicKey) throw new WalletAccountError();

      let publicKey: PublicKey;
      try {
        publicKey = new PublicKey(wallet.publicKey.toBytes());
      } catch (error) {
        throw new WalletPublicKeyError(error instanceof Error ? error.message : String(error), error);
      }

      wallet.on?.("disconnect", this._disconnected);
      wallet.on?.("accountChanged", this._accountChanged);
      wallet.on?.("connect", this._connected);
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
      wallet.off?.("connect", this._connected);
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
        const result = await wallet.signAndSendTransaction(transaction, sendOptions);
        return result.signature;
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
        if (!signed) throw new Error("Phantom wallet returned no signed transaction");
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
        if (!signed?.length) throw new Error("Phantom wallet returned no signed transactions");
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
        const result = await wallet.signMessage(message);
        return normalizeSignature(result.signature);
      } catch (error) {
        throw new WalletSignMessageError(error instanceof Error ? error.message : String(error), error);
      }
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }
}
