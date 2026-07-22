/**
 * Global EVM wallet — links an EVM wallet alongside the Solana login and makes
 * it available to every EVM/curve flow. Solana (Phantom/Jupiter) stays the
 * primary account/login; this is the "other wallet, used when needed".
 *
 * - Auto-reconnects silently on load (eth_accounts, no prompt) to the last wallet.
 * - Persists the linked address in localStorage; the header also best-effort
 *   links it to the signed-in Solana pubkey in Supabase.
 * - Exposes a shared connect modal via openConnect().
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Plug, Smartphone, Wallet as WalletIcon, X, Copy } from "lucide-react";
import {
  discoverWallets, connectWallet, connectWalletConnect, shortAddr,
  mobileWalletDeepLinks, WALLETCONNECT_PROJECT_ID,
  type DiscoveredWallet, type Eip1193Provider,
} from "@/lib/evm/wallet";
import { CHAINS } from "@/lib/orbitx/chains";

const ADDR_KEY = "orbitx_evm_addr";
const RDNS_KEY = "orbitx_evm_rdns";

interface EvmWalletCtx {
  wallets: DiscoveredWallet[];
  provider: Eip1193Provider | null;
  account: string;
  linkedAddress: string;
  connecting: string;
  connectInjected: (w: DiscoveredWallet) => Promise<void>;
  connectWC: () => Promise<void>;
  disconnect: () => void;
  openConnect: () => void;
  closeConnect: () => void;
  refresh: () => void;
}

const Ctx = createContext<EvmWalletCtx | null>(null);

export function useEvmWallet(): EvmWalletCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEvmWallet must be used within EvmWalletProvider");
  return v;
}

export function EvmWalletProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [account, setAccount] = useState("");
  const [linkedAddress, setLinkedAddress] = useState(() => {
    try { return localStorage.getItem(ADDR_KEY) ?? ""; } catch { return ""; }
  });
  const [connecting, setConnecting] = useState("");
  const [open, setOpen] = useState(false);

  const refresh = useCallback(() => { discoverWallets().then(setWallets); }, []);

  const persist = useCallback((addr: string, rdns: string) => {
    try {
      if (addr) { localStorage.setItem(ADDR_KEY, addr); localStorage.setItem(RDNS_KEY, rdns); }
      else { localStorage.removeItem(ADDR_KEY); localStorage.removeItem(RDNS_KEY); }
    } catch { /* ignore */ }
    setLinkedAddress(addr);
  }, []);

  const attach = useCallback((p: Eip1193Provider, acct: string, rdns: string) => {
    setProvider(p); setAccount(acct); persist(acct, rdns);
    p.on?.("accountsChanged", (...args: unknown[]) => {
      const accs = args[0] as string[] | undefined;
      if (!accs || accs.length === 0) { setProvider(null); setAccount(""); persist("", ""); }
      else { setAccount(accs[0]); persist(accs[0], rdns); }
    });
  }, [persist]);

  // discover wallets + attempt a silent reconnect to the last-linked wallet
  useEffect(() => {
    let on = true;
    discoverWallets().then(async (ws) => {
      if (!on) return;
      setWallets(ws);
      let storedRdns = ""; let storedAddr = "";
      try { storedRdns = localStorage.getItem(RDNS_KEY) ?? ""; storedAddr = localStorage.getItem(ADDR_KEY) ?? ""; } catch { /* ignore */ }
      if (!storedRdns || storedRdns === "walletconnect") return;
      const match = ws.find((w) => w.info.rdns === storedRdns);
      if (!match) return;
      try {
        const accs = (await match.provider.request({ method: "eth_accounts" })) as string[];
        if (!accs?.length) return;
        if (storedAddr && !accs.some((a) => a.toLowerCase() === storedAddr.toLowerCase())) return;
        if (on) attach(match.provider, accs[0], storedRdns);
      } catch { /* stay disconnected */ }
    });
    return () => { on = false; };
  }, [attach]);

  const connectInjected = useCallback(async (w: DiscoveredWallet) => {
    setConnecting(w.info.uuid);
    try {
      const acct = await connectWallet(w.provider);
      attach(w.provider, acct, w.info.rdns);
      setOpen(false);
    } finally { setConnecting(""); }
  }, [attach]);

  const connectWC = useCallback(async () => {
    if (!WALLETCONNECT_PROJECT_ID) throw new Error("WalletConnect needs VITE_WALLETCONNECT_PROJECT_ID");
    setConnecting("walletconnect");
    try {
      const ids = CHAINS.filter((c) => c.evm).map((c) => parseInt(c.evm!.chainIdHex, 16));
      const { provider: wc, account: acct } = await connectWalletConnect(WALLETCONNECT_PROJECT_ID, ids);
      attach(wc, acct, "walletconnect");
      setOpen(false);
    } finally { setConnecting(""); }
  }, [attach]);

  const disconnect = useCallback(() => { setProvider(null); setAccount(""); persist("", ""); }, [persist]);

  const value = useMemo<EvmWalletCtx>(() => ({
    wallets, provider, account, linkedAddress, connecting,
    connectInjected, connectWC, disconnect,
    openConnect: () => { refresh(); setOpen(true); },
    closeConnect: () => setOpen(false),
    refresh,
  }), [wallets, provider, account, linkedAddress, connecting, connectInjected, connectWC, disconnect, refresh]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <EvmConnectModal open={open} />
    </Ctx.Provider>
  );
}

function EvmConnectModal({ open }: { open: boolean }) {
  const { wallets, connecting, connectInjected, connectWC, closeConnect } = useEvmWallet();
  if (!open || typeof document === "undefined") return null;
  const copyRobinhood = async () => {
    try { await navigator.clipboard.writeText(window.location.href); } catch { /* ignore */ }
  };
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={closeConnect}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a1220] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-black text-white"><WalletIcon className="h-4 w-4 text-og-cyan" /> Link an EVM wallet</h3>
          <button onClick={closeConnect}><X className="h-4 w-4 text-white/50" /></button>
        </div>
        <p className="mb-4 text-[12px] text-white/50">Used for EVM launches &amp; trades (Robinhood Chain + 11 more). Your Solana wallet stays your login.</p>
        <div className="space-y-1.5">
          {wallets.length === 0 && <p className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3 text-[12px] text-white/50">No injected EVM wallet found. Install MetaMask / Rabby, or use WalletConnect / a mobile link below.</p>}
          {wallets.map((w) => (
            <button key={w.info.uuid} type="button" onClick={() => connectInjected(w)} disabled={!!connecting}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-og-cyan/50 hover:bg-white/[0.06] disabled:opacity-50">
              {w.info.icon ? <img src={w.info.icon} alt="" className="h-6 w-6 rounded-md" /> : <WalletIcon className="h-6 w-6 text-white/60" />}
              <span className="flex-1 text-sm font-bold text-white">{w.info.name}</span>
              {connecting === w.info.uuid ? <Loader2 className="h-4 w-4 animate-spin text-og-cyan" /> : <span className="text-[10px] font-bold uppercase tracking-widest text-og-lime">Detected</span>}
            </button>
          ))}
          <button type="button" onClick={() => connectWC().catch(() => undefined)} disabled={!!connecting}
            className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-og-cyan/50 disabled:opacity-50">
            {connecting === "walletconnect" ? <Loader2 className="h-6 w-6 animate-spin text-og-cyan" /> : <Plug className="h-6 w-6 text-white/60" />}
            <span className="flex-1 text-sm font-bold text-white">WalletConnect</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">QR · mobile</span>
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
          {mobileWalletDeepLinks().map((l) => (
            <a key={l.name} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 hover:text-white">
              <Smartphone className="h-3 w-3" /> {l.name}
            </a>
          ))}
          <button onClick={copyRobinhood} className="inline-flex items-center gap-1 rounded-lg border border-[#00C805]/30 px-2 py-1 text-[#00C805] hover:opacity-80">
            <Copy className="h-3 w-3" /> Robinhood link
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export { shortAddr as shortEvmAddr };
