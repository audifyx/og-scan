import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { setWatchlistWallet } from "./api";

// Multi-wallet provider access — Phantom, Jupiter, Solflare, Backpack (and any
// injected Solana wallet). No @solana/web3.js dependency so the wallet context
// stays out of the heavy web3 bundle (loaded lazily at trade time).
type AnyProv = any;
interface Detector { name: string; get: () => AnyProv | null; icon?: string }

const DETECTORS: Detector[] = [
  { name: "Phantom", get: () => { const w = window as any; return w?.phantom?.solana?.isPhantom ? w.phantom.solana : (w?.solana?.isPhantom ? w.solana : null); } },
  { name: "Jupiter", get: () => { const w = window as any; return w?.jupiter?.solana ?? (w?.solana?.isJupiter ? w.solana : null); } },
  { name: "Solflare", get: () => { const w = window as any; return w?.solflare?.isSolflare ? w.solflare : null; } },
  { name: "Backpack", get: () => { const w = window as any; return w?.backpack?.isBackpack ? w.backpack : null; } },
];

export interface DetectedWallet { name: string; provider: AnyProv }

export function listWallets(): DetectedWallet[] {
  const found: DetectedWallet[] = [];
  for (const d of DETECTORS) { const p = d.get(); if (p && !found.some((f) => f.provider === p)) found.push({ name: d.name, provider: p }); }
  const w = window as any;
  if (w?.solana && !found.some((f) => f.provider === w.solana)) found.push({ name: "Solana Wallet", provider: w.solana });
  return found;
}

const SEL_KEY = "ogdex_wallet";

// Returns the currently selected/connected provider (falls back to the first
// detected wallet, then Phantom). Kept named getPhantom for backward compat so
// existing signing paths sign with whatever wallet is connected.
export function getProvider(): AnyProv | null {
  const list = listWallets();
  const sel = localStorage.getItem(SEL_KEY);
  if (sel) { const hit = list.find((w) => w.name === sel); if (hit) return hit.provider; }
  return list[0]?.provider ?? null;
}
export const getPhantom = getProvider;

interface WalletCtx {
  address: string | null;
  connecting: boolean;
  wallets: DetectedWallet[];
  connect: (name?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  hasPhantom: boolean;
}

const Ctx = createContext<WalletCtx>({
  address: null, connecting: false, wallets: [], connect: async () => {}, disconnect: async () => {}, hasPhantom: false,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    const refresh = () => setWallets(listWallets());
    refresh();
    const t = setTimeout(refresh, 800); // some wallets inject slightly late
    window.addEventListener("wallet-standard:register-wallet", refresh as any);
    // eager-connect the last used / trusted provider
    const p = getProvider();
    p?.connect?.({ onlyIfTrusted: true }).then((r: any) => setAddress(r?.publicKey?.toString() || null)).catch(() => {});
    return () => { clearTimeout(t); window.removeEventListener("wallet-standard:register-wallet", refresh as any); };
  }, []);

  useEffect(() => { setWatchlistWallet(address); }, [address]);

  const bind = (p: AnyProv) => {
    p?.on?.("disconnect", () => setAddress(null));
    p?.on?.("accountChanged", (pk: any) => setAddress(pk ? pk.toString() : null));
  };

  const connectNamed = async (name: string) => {
    const hit = listWallets().find((w) => w.name === name);
    if (!hit) { window.open("https://phantom.app/", "_blank"); return; }
    setConnecting(true);
    try {
      localStorage.setItem(SEL_KEY, name);
      const r = await hit.provider.connect();
      setAddress(r?.publicKey?.toString?.() || hit.provider.publicKey?.toString?.() || null);
      bind(hit.provider);
      setPicker(false);
    } catch { /* user rejected */ }
    finally { setConnecting(false); }
  };

  const connect = async (name?: string) => {
    const list = listWallets();
    if (name) return connectNamed(name);
    if (list.length === 0) { window.open("https://phantom.app/", "_blank"); return; }
    if (list.length === 1) return connectNamed(list[0].name);
    setPicker(true);
  };

  const disconnect = async () => {
    try { await getProvider()?.disconnect?.(); } catch { /* noop */ }
    localStorage.removeItem(SEL_KEY);
    setAddress(null);
  };

  return (
    <Ctx.Provider value={{ address, connecting, wallets, connect, disconnect, hasPhantom: wallets.length > 0 }}>
      {children}
      {picker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)" }} onClick={() => setPicker(false)}>
          <div style={{ width: "100%", maxWidth: 340, borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)", background: "#0a1220", padding: 18 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, color: "#fff", marginBottom: 4 }}>Connect a wallet</div>
            <div style={{ fontSize: 12, color: "#8a93a6", marginBottom: 12 }}>Phantom, Jupiter, Solflare, Backpack and more.</div>
            {wallets.map((w) => (
              <button key={w.name} onClick={() => connectNamed(w.name)} disabled={connecting}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", padding: "10px 12px", marginBottom: 8, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                {w.name}
              </button>
            ))}
            {wallets.length === 0 && <div style={{ color: "#8a93a6", fontSize: 12 }}>No Solana wallet detected. Install Phantom or Jupiter and reload.</div>}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useWallet() { return useContext(Ctx); }
