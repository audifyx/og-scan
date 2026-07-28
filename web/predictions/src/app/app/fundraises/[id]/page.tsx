'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { HeartHandshake, ArrowLeft, Loader2, ExternalLink, ShieldCheck, Clock, Send } from 'lucide-react';
import { ContributeModal } from '@/components/fundraises/ContributeModal';
import { supabase } from '@/lib/supabase';
import clsx from 'clsx';

const sol = (l: number) => (Number(l) / LAMPORTS_PER_SOL).toFixed(3);
const short = (w?: string | null) => (w ? w.slice(0, 4) + '…' + w.slice(-4) : '—');

export default function FundraiseDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<any>(null);
  const [contribs, setContribs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGive, setShowGive] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/fundraises?id=${id}`, { cache: 'no-store' });
    const d = await r.json();
    if (d.ok) { setC(d.campaign); setContribs(d.contributions); }
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel(`fr-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fundraise_contributions', filter: `campaign_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fundraises', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  if (loading) return <div className="max-w-2xl mx-auto py-20 flex items-center justify-center text-gray-500"><Loader2 className="animate-spin mr-2" /> Loading…</div>;
  if (!c) return <div className="max-w-2xl mx-auto py-20 text-center text-gray-500"><p>Campaign not found.</p><button onClick={() => router.push('/app/fundraises')} className="mt-4 text-cyan font-bold">Back</button></div>;

  const pct = c.target_lamports > 0 ? Math.min(100, Math.round((c.raised_lamports / c.target_lamports) * 100)) : 0;
  const ended = !!c.deadline && Date.now() > new Date(c.deadline).getTime();

  return (
    <div className="max-w-2xl mx-auto space-y-5 py-2">
      <button onClick={() => router.push('/app/fundraises')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white"><ArrowLeft size={15} /> Fundraises</button>

      <div className="bg-card border border-white/10 rounded-2xl overflow-hidden">
        {c.image_url ? <img src={c.image_url} alt="" className="h-44 w-full object-cover" /> : <div className="h-32 bg-gradient-to-br from-cyan/20 to-purple/20 flex items-center justify-center"><HeartHandshake size={36} className="text-white/40" /></div>}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-black text-white">{c.title}</h1>
            <span className={clsx('shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border', ended ? 'text-gray-300 bg-white/5 border-white/15' : 'text-win bg-win/10 border-win/25')}>{ended ? 'Ended' : 'Active'}</span>
          </div>
          {c.description && <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">{c.description}</p>}
          {c.link && <a href={c.link} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan hover:underline inline-flex items-center gap-1 mt-2">Learn more <ExternalLink size={11} /></a>}

          <div className="mt-4">
            <div className="h-3 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan to-purple" style={{ width: `${pct}%` }} /></div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-lg font-black text-white">◎ {sol(c.raised_lamports)} <span className="text-sm text-gray-500 font-normal">raised</span></p>
              <p className="text-sm text-gray-500">goal ◎ {sol(c.target_lamports)} · {c.contribution_count} gifts</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3"><p className="text-gray-500">Creator</p><p className="text-white font-semibold mt-0.5">{c.creator_username || short(c.creator_wallet)}</p></div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3"><p className="text-gray-500">Funds go to</p><p className="text-white font-mono mt-0.5">{short(c.recipient_wallet)}</p></div>
          </div>
          {c.deadline && <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5"><Clock size={12} /> Ends {new Date(c.deadline).toLocaleString()}</p>}

          {!ended ? (
            <button onClick={() => setShowGive(true)} className="mt-4 w-full bg-gradient-to-r from-cyan to-purple text-black font-black py-3.5 rounded-xl flex items-center justify-center gap-2"><Send size={16} /> Contribute</button>
          ) : (
            <p className="mt-4 text-center text-sm text-gray-500">This fundraiser has ended.</p>
          )}
        </div>
      </div>

      <div className="bg-cyan/5 border border-cyan/15 rounded-xl p-3 flex gap-2.5 text-xs text-gray-400">
        <ShieldCheck size={16} className="text-cyan shrink-0 mt-0.5" />
        <span>Contributions go <b className="text-white">directly to the creator&apos;s wallet</b>, are verified on-chain, and are <b className="text-white">final and non-refundable</b>. The campaign stays live until its deadline. The platform only charges a one-time $12.50 creation fee.</span>
      </div>

      <div>
        <h2 className="text-sm font-bold text-white mb-2">Contributions ({contribs.length})</h2>
        <div className="space-y-1.5">
          {contribs.length === 0 ? <p className="text-gray-600 text-sm">No contributions yet. Be the first.</p> : contribs.map(x => (
            <div key={x.id} className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 flex items-center justify-between text-sm">
              <div className="min-w-0"><p className="text-white font-semibold">◎ {sol(x.lamports)}</p><p className="text-[11px] text-gray-500">{x.contributor_username || short(x.contributor_wallet)} · {new Date(x.created_at).toLocaleDateString()}</p></div>
              <a href={`https://solscan.io/tx/${x.tx_signature}`} target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline text-xs inline-flex items-center gap-1 shrink-0">tx <ExternalLink size={11} /></a>
            </div>
          ))}
        </div>
      </div>

      {showGive && <ContributeModal campaign={c} onClose={() => setShowGive(false)} onDone={() => { setShowGive(false); load(); }} />}
    </div>
  );
}
