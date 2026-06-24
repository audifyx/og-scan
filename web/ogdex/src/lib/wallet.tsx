import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { setWatchlistWallet } from "./api";
// Phantom provider access — intentionally has NO @solana/web3.js dependency so
// the wallet context stays out of the heavy web3 bundle (loaded lazily at trade time).
export function getPhantom(): any {
  const w = window as any;
  if (w?.phantom?.solana?.isPhantom) return w.phantom.solana;
  if (w?.solana?.isPhantom) return w.solana;
  return null;
}

interface WalletCtx {
  address: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  hasPhantom: boolean;
}

const Ctx = createContext<WalletCtx>({
  address: null, connecting: false, connect: async () => {}, disconnect: async () => {}, hasPhantom: false,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hasPhantom, setHasPhantom] = useState(false);

  useEffect(() => {
    const p = getPhantom();
    setHasPhantom(!!p);
    if (!p) return;
    // Eager-connect if the user previously trusted this site.
    (p as any).connect?.({ onlyIfTrusted: true })
      .then((r: any) => setAddress(r?.publicKey?.toString() || null))
      .catch(() => {});
    const onConn = (pk: any) => setAddress(pk?.toString?.() || null);
    const onDisc = () => setAddress(null);
    (p as any).on?.("connect", onConn);
    (p as any).on?.("disconnect", onDisc);
    (p as any).on?.("accountChanged", (pk: any) => setAddress(pk ? pk.toString() : null));
    return () => {
      (p as any).removeListener?.("connect", onConn);
      (p as any).removeListener?.("disconnect", onDisc);
    };
  }, []);

  useEffect(() => { setWatchlistWallet(address); }, [address]);

  const connect = async () => {
    const p = getPhantom();
    if (!p) { window.open("https://phantom.app/", "_blank"); return; }
    setConnecting(true);
    try {
      const r = await p.connect();
      setAddress(r.publicKey.toString());
    } catch { /* user rejected */ }
    finally { setConnecting(false); }
  };

  const disconnect = async () => {
    const p = getPhantom();
    try { await p?.disconnect(); } catch { /* noop */ }
    setAddress(null);
  };

  return <Ctx.Provider value={{ address, connecting, connect, disconnect, hasPhantom }}>{children}</Ctx.Provider>;
}

export function useWallet() { return useContext(Ctx); }
