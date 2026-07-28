'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UserBet } from '@/utils/types';

export function useMyBets(wallet: string | null) {
  const [bets, setBets] = useState<UserBet[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet) { setBets([]); return; }
    setLoading(true);
    (supabase as any)
      .from('user_bets')
      .select('*, bet:bets(*)')
      .eq('user_wallet', wallet)
      .order('created_at', { ascending: false })
      .then(({ data }: any) => { setBets(data || []); setLoading(false); });
  }, [wallet]);

  return { bets, loading };
}
