import { useCallback, useEffect, useRef, useState } from "react";

/**
 * rpcFeed — live ORBITX trade + burn data straight from Solana public RPC.
 * (The hardcoded Helius key went 401, so the /token page no longer depends on it.)
 */

export interface RpcTrade {
  signature: string;
  timestamp: number; // unix seconds
  side: "BUY" | "SELL" | "BURN" | "TRANSFER";
  tokenAmount: number;
  solAmount: number;
  wallet: string;
}

const RPC_URL = "https://api.mainnet-beta.solana.com";
const INCINERATOR = "1nc1nerator11111111111111111111111111111111";

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Math.floor(Math.random() * 1e9), method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || "RPC error");
  return j.result as T;
}

interface SigInfo { signature: string; blockTime: number | null; err: unknown }

function parseTrade(tx: any, mint: string): RpcTrade | null {
  try {
    const sig: string = tx.transaction.signatures[0];
    const keys: string[] = tx.transaction.message.accountKeys;
    const meta = tx.meta;
    if (!meta || meta.err) return null;
    const preB: number[] = meta.preBalances ?? [];
    const postB: number[] = meta.postBalances ?? [];

    const sumBy = (list: any[]) => {
      const m = new Map<string, number>();
      for (const b of list ?? []) {
        if (b.mint !== mint) continue;
        m.set(b.owner, (m.get(b.owner) ?? 0) + (b.uiTokenAmount?.uiAmount ?? 0));
      }
      return m;
    };
    const preT = sumBy(meta.preTokenBalances);
    const postT = sumBy(meta.postTokenBalances);
    const owners = new Set([...preT.keys(), ...postT.keys()]);

    let best: { owner: string; delta: number } | null = null;
    for (const o of owners) {
      const d = (postT.get(o) ?? 0) - (preT.get(o) ?? 0);
      if (!best || Math.abs(d) > Math.abs(best.delta)) best = { owner: o, delta: d };
    }
    if (!best || Math.abs(best.delta) < 1e-9) return null;

    const idx = keys.indexOf(best.owner);
    const ownerSolDelta = idx >= 0 && preB[idx] != null ? (preB[idx] - postB[idx]) / 1e9 : 0;
    const incineratorIn = (postT.get(INCINERATOR) ?? 0) - (preT.get(INCINERATOR) ?? 0);

    let side: RpcTrade["side"] = "TRANSFER";
    if (best.owner === INCINERATOR || incineratorIn > 1e-9) side = "BURN";
    else if (best.delta > 0 && ownerSolDelta > 0.0000005) side = "BUY";
    else if (best.delta < 0 && ownerSolDelta < -0.0000005) side = "SELL";

    return {
      signature: sig,
      timestamp: tx.blockTime ?? 0,
      side,
      tokenAmount: Math.abs(best.delta),
      solAmount: Math.abs(ownerSolDelta),
      wallet: best.owner,
    };
  } catch {
    return null;
  }
}

export function useRpcTrades(mint: string, limit = 15, intervalMs = 20000) {
  const [trades, setTrades] = useState<RpcTrade[]>([]);
  const [burns, setBurns] = useState<RpcTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());

  const fetchDirect = useCallback(async () => {
    const sigs = await rpc<SigInfo[]>("getSignaturesForAddress", [mint, { limit }]);
    const fresh = sigs.filter((s) => !s.err && !seen.current.has(s.signature)).slice(0, limit);
    const parsed: RpcTrade[] = [];
    for (const s of fresh) {
      seen.current.add(s.signature);
      try {
        const tx = await rpc<any>("getTransaction", [
          s.signature,
          { encoding: "json", maxSupportedTransactionVersion: 1 },
        ]);
        if (!tx) continue;
        const t = parseTrade({ ...tx, blockTime: tx.blockTime ?? s.blockTime }, mint);
        if (t) parsed.push(t);
      } catch {
        /* skip unparseable tx */
      }
    }
    return parsed;
  }, [mint, limit]);

  const fetchServer = useCallback(async () => {
    const r = await fetch(`/api/token-feed?action=trades&mint=${mint}&limit=${limit}`);
    if (!r.ok) throw new Error(`feed ${r.status}`);
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "feed failed");
    const parsed: RpcTrade[] = [];
    for (const t of j.trades ?? []) {
      if (seen.current.has(t.signature)) continue;
      seen.current.add(t.signature);
      parsed.push(t);
    }
    return parsed;
  }, [mint, limit]);

  const poll = useCallback(async () => {
    try {
      // Prefer the server feed (reliable RPC + CDN cache); fall back to direct RPC.
      let parsed: RpcTrade[];
      try {
        parsed = await fetchServer();
      } catch {
        parsed = await fetchDirect();
      }
      if (parsed.length > 0) {
        setTrades((prev) =>
          [...parsed, ...prev].sort((a, b) => b.timestamp - a.timestamp).slice(0, 60),
        );
        setBurns((prev) =>
          [...parsed.filter((t) => t.side === "BURN"), ...prev]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 30),
        );
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "feed failed");
    } finally {
      setLoading(false);
    }
  }, [fetchServer, fetchDirect]);

  useEffect(() => {
    seen.current.clear();
    setTrades([]);
    setBurns([]);
    setLoading(true);
    setError(null);
    void poll();
    const id = setInterval(() => void poll(), intervalMs);
    return () => clearInterval(id);
  }, [mint, poll, intervalMs]);

  return { trades, burns, loading, error, refresh: poll };
}

export async function fetchRpcSupply(mint: string): Promise<number | null> {
  try {
    const r = await fetch(`/api/token-feed?action=supply&mint=${mint}`);
    if (r.ok) {
      const j = await r.json();
      if (j.ok && typeof j.supply === "number") return j.supply;
    }
  } catch {
    /* fall through to direct RPC */
  }
  try {
    const r = await rpc<{ value?: { uiAmount?: number } }>("getTokenSupply", [mint]);
    return r?.value?.uiAmount ?? null;
  } catch {
    return null;
  }
}

export function shortSig(sig: string): string {
  return sig.length > 12 ? `${sig.slice(0, 6)}…${sig.slice(-4)}` : sig;
}

export function timeAgo(ts: number): string {
  if (!ts) return "—";
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
