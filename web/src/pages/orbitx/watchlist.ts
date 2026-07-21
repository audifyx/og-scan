// OrbitX Launchpad — watchlist. DB-backed (orbitx_watchlist + the
// orbitx_watchlist_toggle RPC) when a wallet is connected, so a watchlist
// follows you across devices; falls back to a local, per-device list when
// no wallet is connected (guest mode) so the star still works pre-connect.
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/lib/supabase";

const KEY = "orbitx_watchlist";
const EVT = "orbitx-watchlist-change";

function readLocal(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function writeLocal(list: string[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
}

async function fetchRemote(wallet: string): Promise<string[]> {
  const { data, error } = await supabase.from("orbitx_watchlist").select("mint_address").eq("wallet", wallet);
  if (error) return [];
  return (data ?? []).map((r) => r.mint_address as string);
}

async function toggleRemote(wallet: string, mint: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("orbitx_watchlist_toggle", { p_wallet: wallet, p_mint: mint });
  if (error) throw error;
  return !!data;
}

/** Non-hook helper for one-off checks (e.g. inside TokenCard without re-render wiring). */
export function isWatchedLocal(mint: string): boolean { return readLocal().includes(mint); }

export function useWatchlist() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();
  const [list, setList] = useState<string[]>(readLocal);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet) { setList(readLocal()); return; }
    let alive = true;
    setLoading(true);
    fetchRemote(wallet).then((remote) => { if (alive) { setList(remote); setLoading(false); } });
    return () => { alive = false; };
  }, [wallet]);

  useEffect(() => {
    if (wallet) return; // remote mode doesn't listen to local storage events
    const on = () => setList(readLocal());
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener(EVT, on); window.removeEventListener("storage", on); };
  }, [wallet]);

  const toggle = useCallback(async (mint: string) => {
    if (wallet) {
      const nowWatching = await toggleRemote(wallet, mint);
      setList((prev) => (nowWatching ? [...prev, mint] : prev.filter((m) => m !== mint)));
      return;
    }
    const prev = readLocal();
    const next = prev.includes(mint) ? prev.filter((m) => m !== mint) : [...prev, mint];
    writeLocal(next);
    setList(next);
  }, [wallet]);

  return { list, toggle, loading, remote: !!wallet };
}

/** Hook form for a single token's watched state + toggle — used by TokenCard's star button. */
export function useIsWatched(mint: string) {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();
  const [watched, setWatched] = useState(() => (wallet ? false : isWatchedLocal(mint)));

  useEffect(() => {
    if (!wallet) { setWatched(isWatchedLocal(mint)); return; }
    let alive = true;
    fetchRemote(wallet).then((remote) => { if (alive) setWatched(remote.includes(mint)); });
    return () => { alive = false; };
  }, [wallet, mint]);

  const toggle = useCallback(async () => {
    if (wallet) {
      const nowWatching = await toggleRemote(wallet, mint);
      setWatched(nowWatching);
      return;
    }
    const prev = readLocal();
    const next = prev.includes(mint) ? prev.filter((m) => m !== mint) : [...prev, mint];
    writeLocal(next);
    setWatched(next.includes(mint));
  }, [wallet, mint]);

  return { watched, toggle };
}
