/**
 * OrbitX City — game wallet connection.
 *
 * Wraps the shared OrbitX billing primitive (@/tokenomics/useOrbitxBilling):
 * the user's in-app (desk) wallet, backend-signed. No Phantom / Jupiter
 * injected wallets — those silently fail on mobile, which is why the hub
 * is never used in the city. Exposes live SOL + ORBITX balances for the
 * HUD wallet chip. Same exported interface as before so HUD mounts keep
 * working.
 *
 * Sign-in aware: the wallet link needs a Supabase session (the backend
 * mints the authCode against it). `signedIn` exposes that state so the
 * chip can route to /auth first instead of failing confusingly. If the
 * user was sent to /auth from here (pending-link flag), the link is
 * auto-retried once they're back with a session.
 */
import { useCallback, useEffect, useState } from "react";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { getBillingAuthCode } from "@/tokenomics/auth";
import { browserWalletRpcUrl } from "@/lib/solanaRpc";

/** sessionStorage flag: user was sent to /auth to sign in, link on return. */
export const CITY_PENDING_LINK_KEY = "ox_city_pending_link";

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
  /** Platform sign-in state: null = still checking, boolean once known. */
  signedIn: boolean | null;
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
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  const checkSession = useCallback(async (): Promise<boolean> => {
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase.auth.getSession();
      const ok = !!data.session;
      setSignedIn(ok);
      return ok;
    } catch {
      setSignedIn(false);
      return false;
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Auto-complete a pending wallet link after returning from sign-in.
  // The flag is consumed on first run, so re-runs are harmless no-ops.
  useEffect(() => {
    let pending = false;
    try {
      pending = sessionStorage.getItem(CITY_PENDING_LINK_KEY) === "1";
    } catch {
      /* storage unavailable */
    }
    if (!pending) return;
    let cancelled = false;
    (async () => {
      const ok = await checkSession();
      if (cancelled) return;
      try {
        sessionStorage.removeItem(CITY_PENDING_LINK_KEY);
      } catch {
        /* noop */
      }
      if (ok && !getBillingAuthCode()) billing.beginAuth();
    })();
    return () => {
      cancelled = true;
    };
  }, [billing, checkSession]);

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
    await checkSession();
    billing.refresh();
    await refreshSol(billing.wallet);
  }, [billing, refreshSol, checkSession]);

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
    signedIn,
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
