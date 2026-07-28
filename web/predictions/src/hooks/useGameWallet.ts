"use client";
import { useCallback, useEffect, useState } from 'react';

export function useGameWallet() {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/games/balance', { cache: 'no-store' });
      if (r.status === 401) { setAuthed(false); setLoading(false); return; }
      const d = await r.json();
      if (d.ok) { setBalance(d.balance); setAuthed(true); }
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const withdraw = useCallback(async (lamports: number, wallet?: string) => {
    const r = await fetch('/api/games/withdraw', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lamports, wallet }),
    });
    const d = await r.json();
    if (d.ok) setBalance(d.balance);
    return d;
  }, []);

  return { balance, loading, authed, refresh, withdraw, setBalance };
}
