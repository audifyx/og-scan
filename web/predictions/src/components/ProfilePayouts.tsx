'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PayoutProof, isRealSig } from '@/components/PayoutProof';
import { Trophy } from 'lucide-react';

const LAMPORTS = 1_000_000_000;
const fmt = (l: number) => (l / LAMPORTS).toFixed(3);

export function ProfilePayouts({ wallet }: { wallet?: string | null }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!wallet) { setLoaded(true); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from('user_bets')
        .select('id, payout, claim_tx, payout_verified, claimed_at, bet:bets(title)')
        .eq('user_wallet', wallet)
        .eq('claimed', true)
        .order('claimed_at', { ascending: false })
        .limit(15);
      setRows((data || []).filter((r: any) => isRealSig(r.claim_tx)));
      setLoaded(true);
    })();
  }, [wallet]);

  if (!loaded || rows.length === 0) return null;

  return (
    <div className="bg-card border border-white/10 rounded-2xl p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-white mb-4">
        <Trophy size={15} className="text-gold" /> Verified payouts
        <span className="text-gray-500 font-normal">({rows.length})</span>
      </h3>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
            <span className="text-sm text-gray-300 flex-1 truncate">{r.bet?.title || 'Market'}</span>
            <span className="text-win font-bold text-sm shrink-0">+◎ {fmt(Number(r.payout || 0))}</span>
            <PayoutProof claimTx={r.claim_tx} verified={r.payout_verified} size="xs" />
          </div>
        ))}
      </div>
    </div>
  );
}
