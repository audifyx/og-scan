'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Bet } from '@/utils/types';

export function useBets(opts?: { status?: string; category?: string; limit?: number }) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      let q = (supabase as any)
        .from('bets')
        .select('*')
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });
      if (opts?.status) q = q.eq('status', opts.status);
      if (opts?.category && opts.category !== 'All') q = q.eq('category', opts.category);
      if (opts?.limit) q = q.limit(opts.limit);
      const { data, error: err } = await q;
      if (err) throw err;
      setBets(data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [opts?.status, opts?.category, opts?.limit]);

  useEffect(() => {
    fetch();
    const ch = (supabase as any)
      .channel('bets-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, fetch)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [fetch]);

  return { bets, loading, error, refetch: fetch };
}
