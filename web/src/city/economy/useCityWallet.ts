/**
 * OrbitX City — game wallet connection.
 *
 * Wraps the shared OrbitX billing primitive (@/tokenomics/useOrbitxBilling):
 * the user's in-app (desk) wallet, backend-signed. No Phantom / Jupiter
 * injected wallets — those silently fail on mobile, which is why the hub
 * is never used in the city. Exposes live SOL + ORBITX balances for the
 * HUD wallet chip. Same exported interface as before so HUD mounts keep
 * working.
 */
import { useCallback, useEffect, useState } from "react";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { browserWalletRpcUrl } from "@/lib/solanaRpc";

export function shortAddress(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

export interface CityWallet {
  connected: boolean;
  connecting: boolean;
  address: string | null;
  short: string | null;
  walletName: string | null;
  sol: number | null;
  orbitx: number | null;
  balancesLoading: boolean;
  /** Last billing/auth error, for UI display. */
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCityWallet(): CityWallet {
  const billing = useOrbitxBilling();
  const [sol, setSol] = useState<number | null>(null);
  const [solLoading, setSolLoading] = useState(false);

  const refreshSol = useCallback(async (addr: string | null) => {
    if (!addr) {
      setSol(null);
      return;
    }
    setSolLoading(true);
    try {
      const conn = new Connection(browserWalletRpcUrl(), "confirmed");
      const lamports = await conn.getBalance(new PublicKey(addr), "confirmed");
      setSol(lamports / LAMPORTS_PER_SOL);
    } catch {
      setSol(null);
    } finally {
      setSolLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSol(billing.wallet);
  }, [billing.wallet, refreshSol]);

  useEffect(() => {
    if (!billing.wallet) return;
    const t = setInterval(() => {
      refreshSol(billing.wallet);
    }, 30000);
    return () => clearInterval(t);
  }, [billing.wallet, refreshSol]);

  const refresh = useCallback(async () => {
    billing.refresh();
    await refreshSol(billing.wallet);
  }, [billing, refreshSol]);

  const address = billing.wallet;

  return {
    connected: billing.ready && !!address,
    connecting: false,
    address,
    short: address ? shortAddress(address) : null,
    walletName: "OrbitX In-App",
    sol,
    orbitx: billing.balance,
    balancesLoading:
      solLoading || (billing.ready && !!address && billing.balance === null),
    error: billing.error,
    connect: async () => {
      billing.beginAuth();
    },
    disconnect: async () => {
      billing.resetAuth();
      setSol(null);
    },
    refresh,
  };
}
