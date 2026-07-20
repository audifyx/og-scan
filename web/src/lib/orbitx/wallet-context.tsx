import React, { createContext, useContext, useState, useEffect } from "react";

type PhantomLike = {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect?: () => Promise<void>;
};

interface WalletContextType {
  addr: string | null;
  sol: number | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  loading: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function getPhantom(): PhantomLike | null {
  const w = window as unknown as { solana?: PhantomLike };
  return w.solana ?? null;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [addr, setAddr] = useState<string | null>(null);
  const [sol, setSol] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Auto-connect on mount
  useEffect(() => {
    const p = getPhantom();
    if (!p) {
      setLoading(false);
      return;
    }
    p.connect({ onlyIfTrusted: true })
      .then((r) => setAddr(r.publicKey.toString()))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  // Poll balance
  useEffect(() => {
    if (!addr) {
      setSol(null);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("https://api.helius.xyz/v0/connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [addr] }),
        });
        const j = await r.json();
        const lamports = j?.result?.value;
        if (alive && typeof lamports === "number") setSol(lamports / 1e9);
      } catch {
        /* fail soft */
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [addr]);

  const connect = async () => {
    const p = getPhantom();
    if (!p) {
      window.open("https://phantom.app", "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const r = await p.connect();
      setAddr(r.publicKey.toString());
    } catch {
      /* user rejected */
    }
  };

  const disconnect = async () => {
    const p = getPhantom();
    if (p) {
      try {
        await p.disconnect?.();
      } catch {
        /* noop */
      }
    }
    setAddr(null);
  };

  return (
    <WalletContext.Provider value={{ addr, sol, connect, disconnect, loading }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWalletContext must be used inside WalletProvider");
  return ctx;
}
