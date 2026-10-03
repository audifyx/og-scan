/**
 * OrbitX City — game wallet connection.
 *
 * Wraps the app's OrbitxWalletHub (@/wallets/hub): Phantom / Jupiter inject,
 * no wallet-adapter-react. This is the wallet that signs in-world swaps and
 * token launches. Exposes live SOL + ORBITX balances for the HUD wallet chip.
 */
import { useCallback, useEffect, useState } from "react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { useConnection, useWallet } from "@/wallets/hub";
import { ORBITX_MINT } from "@/tokenomics/constants";

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
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCityWallet(): CityWallet {
  const hub = useWallet();
  const { connection } = useConnection();
  const [sol, setSol] = useState<number | null>(null);
  const [orbitx, setOrbitx] = useState<number | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);

  const refresh = useCallback(async () => {
    const pk = hub.publicKey;
    if (!pk) {
      setSol(null);
      setOrbitx(null);
      return;
    }
    setBalancesLoading(true);
    try {
      const lamports = await connection.getBalance(pk, "confirmed");
      setSol(lamports / LAMPORTS_PER_SOL);
    } catch {
      setSol(null);
    }
    try {
      const ata = await getAssociatedTokenAddress(new PublicKey(ORBITX_MINT), pk);
      const bal = await connection.getTokenAccountBalance(ata, "confirmed");
      setOrbitx(Number(bal.value.uiAmount ?? 0));
    } catch {
      setOrbitx(0);
    }
    setBalancesLoading(false);
  }, [connection, hub.publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!hub.publicKey) return;
    const t = setInterval(() => {
      refresh();
    }, 30000);
    return () => clearInterval(t);
  }, [hub.publicKey, refresh]);

  return {
    connected: hub.connected,
    connecting: hub.connecting,
    address: hub.publicKey ? hub.publicKey.toBase58() : null,
    short: hub.publicKey ? shortAddress(hub.publicKey.toBase58()) : null,
    walletName: hub.wallet?.adapter?.name ?? null,
    sol,
    orbitx,
    balancesLoading,
    connect: hub.connect,
    disconnect: hub.disconnect,
    refresh,
  };
}
