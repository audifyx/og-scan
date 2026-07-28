'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { HeartHandshake, Plus, Loader2, Clock } from 'lucide-react';
import { CreateFundraiseModal } from '@/components/fundraises/CreateFundraiseModal';
import { supabase } from '@/lib/supabase';
import clsx from 'clsx';

const sol = (l: number) => (Number(l) / LAMPORTS_PER_SOL).toFixed(2);

export default function FundraisesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/fundraises', { cache: 'no-store' });
    const d = await r.json();
    if (d.ok) setItems(d.campaigns);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel('fundraises-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'fundraises' }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><HeartHandshake size={22} className="text-cyan" /> Fundraises</h1>
          <p className="text-gray-500 text-sm mt-0.5">Community campaigns. Contributions go straight to the creator, on-chain verified.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan to-purple text-black font-black rounded-xl text-sm"><Plus size={15} /> Start a fundraise</button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-56 shimmer" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-24 text-gray-600"><HeartHandshake size={36} className="mx-auto mb-3 opacity-30" /><p className="font-medium">No fundraises yet</p><p className="text-xs mt-1">Be the first to start one.</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(c => {
            const pct = c.target_lamports > 0 ? Math.min(100, Math.round((c.raised_lamports / c.target_lamports) * 100)) : 0;
            const ended = !!c.deadline && Date.now() > new Date(c.deadline).getTime();
            return (
              <Link key={c.id} href={`/app/fundraises/${c.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden hover:border-white/20 transition-colors flex flex-col">
                {c.image_url ? <img src={c.image_url} alt="" className="h-28 w-full object-cover" /> : <div className="h-28 bg-gradient-to-br from-cyan/20 to-purple/20 flex items-center justify-center"><HeartHandshake size={28} className="text-white/40" /></div>}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-white text-sm leading-snug">{c.title}</h3>
                    <span className={clsx('shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border', ended ? 'text-gray-300 bg-white/5 border-white/15' : 'text-win bg-win/10 border-win/25')}>{ended ? 'Ended' : 'Active'}</span>
                  </div>
                  {c.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>}
                  <div className="mt-auto pt-3">
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan to-purple" style={{ width: `${pct}%` }} /></div>
                    <div className="flex items-center justify-between mt-1.5 text-xs">
                      <span className="text-white font-bold">◎ {sol(c.raised_lamports)}</span>
                      <span className="text-gray-500">of ◎ {sol(c.target_lamports)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showCreate && <CreateFundraiseModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
