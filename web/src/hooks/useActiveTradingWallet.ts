/**
 * Active trading identity for OrbitX Trade tools.
 *
 * The in-app (desk) wallet is the ONLY trading wallet — one wallet, one
 * address, everywhere. The old "local keypair import" and "connected
 * extension" modes are retired.
 *
 * - Identity: desk wallet address via useOrbitxBilling().
 * - Trades: `buy` / `sell` via the backend-signed orbitx_app_buy/sell MCP tools.
 * - Custom transactions: the desk wallet has no client-side signer, so
 *   `sendTx` / `signMessage` throw a clear error directing to supported flows.
 */
import { useCallback, useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { deskBuy, deskSell, solscanTxUrl } from "@/lib/deskTrades";

function shortAddr(a: string, n = 4): string {
  return a.length > n * 2 ? `${a.slice(0, n)}…${a.slice(-n)}` : a;
}

function backendSigningError(action = "This action"): Error {
  return new Error(
    `${action} needs the in-app wallet's backend signer, which isn't enabled for custom transactions yet. ` +
      "Use the Trade tab for buys/sells and the Shop for burns — both are backend-signed.",
  );
}

export function useActiveTradingWallet() {
  const billing = useOrbitxBilling();

  const publicKey = useMemo(() => {
    if (!billing.wallet) return null;
    try {
      return new PublicKey(billing.wallet);
    } catch {
      return null;
    }
  }, [billing.wallet]);

  const address = billing.wallet;
  const ready = billing.ready && Boolean(publicKey);
  const connected = ready;

  const label = useMemo(() => {
    if (!address) return null;
    return `In-App ${shortAddr(address)}`;
  }, [address]);

  /** Backend-signed market buy. Returns the tx signature. */
  const buy = useCallback(
    async (mint: string, amountSol: number, slippageBps = 200): Promise<string> => {
      return deskBuy(mint, amountSol, slippageBps);
    },
    [],
  );

  /** Backend-signed market sell of `percent` (1-100). Returns the tx signature. */
  const sell = useCallback(
    async (mint: string, percent: number, slippageBps = 200): Promise<string> => {
      return deskSell(mint, percent, slippageBps);
    },
    [],
  );

  /** Link the in-app wallet (one-time dashboard auth-code flow). */
  const connectNamedWallet = useCallback(
    async (_name?: string): Promise<string | null> => {
      billing.beginAuth();
      return billing.wallet;
    },
    [billing],
  );

  /** @deprecated alias — there is only the in-app wallet now. */
  const connectPhantom = useCallback(async () => {
    return connectNamedWallet("In-App");
  }, [connectNamedWallet]);

  /** Custom transactions are not client-signed — throws a clear error. */
  const sendTx = useCallback(async (): Promise<string> => {
    throw backendSigningError("Sending this transaction");
  }, []);

  /** The desk wallet signs on the backend — no client-side message signing. */
  const signMessage = useCallback(async (): Promise<Uint8Array> => {
    throw backendSigningError("Signing this message");
  }, []);

  return {
    // core identity (same names as before)
    mode: "connected" as const,
    setMode: (_mode: string) => {},
    localActive: false,
    publicKey,
    address,
    ready,
    label,
    shortAddress: address ? shortAddr(address) : null,
    defaultWallet: null,
    localWallets: [] as never[],
    connected,
    adapterPublicKey: publicKey,
    // trading (backend-signed)
    buy,
    sell,
    solscanTxUrl,
    // legacy compat — custom tx paths now throw honest errors
    sendTx,
    signMessage,
    loadDefaultKeypair: async () => null,
    connectNamedWallet,
    connectPhantom,
    signingSource: "connected" as const,
    // billing passthrough
    billing,
  };
}
