'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface LeaderboardEntry {
  id: string;
  user_id: string | null;
  wallet: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  twitter: string | null;
  wins: number;
  losses: number;
  total_bets: number;
  total_wagered: number; // SOL
  total_won: number;     // SOL
}

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase as any)
      .from('profiles')
      .select('id,user_id,wallet,username,display_name,avatar_url,bio,twitter,wins,losses,total_wagered_sol,total_won_sol')
      .order('wins', { ascending: false })
      .order('total_won_sol', { ascending: false })
      .limit(100)
      .then(({ data }: any) => {
        const rows = (data || []).map((r: any) => ({
          id: r.id, user_id: r.user_id, wallet: r.wallet, username: r.username,
          display_name: r.display_name, avatar_url: r.avatar_url, bio: r.bio, twitter: r.twitter,
          wins: r.wins ?? 0, losses: r.losses ?? 0, total_bets: (r.wins ?? 0) + (r.losses ?? 0),
          total_wagered: Number(r.total_wagered_sol ?? 0), total_won: Number(r.total_won_sol ?? 0),
        }));
        setEntries(rows); setLoading(false);
      });
  }, []);

  return { entries, loading };
}
