'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Bet, UserBet } from '@/utils/types';
import { OutcomeBar, OUTCOME_COLORS } from '@/components/OutcomeBar';
import { CountdownTimer } from '@/components/CountdownTimer';
import { PlaceBetModal } from '@/components/PlaceBetModal';
import { useAuth } from '@/hooks/useAuth';
import { MarketComments } from '@/components/MarketComments';
import { PayoutProof } from '@/components/PayoutProof';
import { useWallet } from '@solana/wallet-adapter-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { Users, TrendingUp, ArrowLeft, Star, Info, Share2, Check, ShieldCheck, ExternalLink, Clock } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import { useSolPrice, usdFromSol } from '@/hooks/useSolPrice';

const LAMPORTS = 1_000_000_000;
const fmt = (l: number) => (l / LAMPORTS).toFixed(3);
const tdate = (d:any)=>d?new Date(d).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';

export default function BetDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { publicKey } = useWallet();
  const router = useRouter();
  const { user } = useAuth();
  const solPrice = useSolPrice();
  const [bet, setBet] = useState<Bet | null>(null);
  const [participants, setParticipants] = useState<UserBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBetModal, setShowBetModal] = useState(false);
  const requireBet = (i?: number) => {
    if (!user) { router.push('/auth?redirect=' + encodeURIComponent('/app/bet/' + (id || ''))); return; }
    if (i !== undefined && i !== null) setSelectedOutcome(i);
    setShowBetModal(true);
  };
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const share = () => { try { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} };
  const shareX = () => { const t = `${bet?.title || ''} 🎲 on @solnobet`; window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(window.location.href)}`, '_blank', 'noopener'); };

  const loadBet = async () => {
    if (!id) return;
    const { data } = await (supabase as any).from('bets').select('*').eq('id', id).single();
    setBet(data);
    const { data: ubs } = await (supabase as any).from('user_bets').select('*').eq('bet_id', id).order('amount', { ascending: false }).limit(20);
    setParticipants(ubs || []);
    setLoading(false);
  };

  useEffect(() => { loadBet(); }, [id]);

  if (loading) return (
    <div className="max-w-5xl mx-auto space-y-4">
      {[1,2,3].map(i => <div key={i} className="glass-card rounded-2xl h-32 shimmer" />)}
    </div>
  );
  if (!bet) return (
    <div className="text-center py-24 text-gray-500">
      <p>Bet not found.</p>
      <Link href="/app" className="text-cyan mt-4 block">← Back to Browse</Link>
    </div>
  );

  const outcomes = bet.outcomes?.length ? bet.outcomes : [bet.yes_label || 'Yes', bet.no_label || 'No'];
  const pools = (bet.outcome_pools?.length ? bet.outcome_pools : [bet.yes_pool || 0, bet.no_pool || 0]).map(Number);
  const totalPool = pools.reduce((s,p) => s+p, 0);
  const isOpen = ['open','active'].includes(bet.status);

  const chartData = outcomes.map((o, i) => ({
    name: o,
    value: pools[i] || 0,
    pct: totalPool > 0 ? pools[i]/totalPool*100 : 100/outcomes.length,
    color: OUTCOME_COLORS[i % OUTCOME_COLORS.length].bar,
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Back */}
      <div className="flex items-center justify-between">
        <Link href="/app" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={14}/> Back to Browse
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={shareX} className="btn-ghost !py-2 !px-3 text-xs">𝕏 Share</button>
          <button onClick={share} className="btn-ghost !py-2 !px-3 text-xs">
            {copied ? <><Check size={13} className="text-win"/> Copied</> : <><Share2 size={13}/> Link</>}
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {bet.image_url && (
          <div className="h-44 md:h-56 w-full overflow-hidden relative">
            <img src={bet.image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e1c] to-transparent" />
          </div>
        )}
        <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <span className={clsx('text-xs font-semibold px-3 py-1 rounded-full border capitalize',
            bet.status === 'open' ? 'text-win bg-win/10 border-win/20'
            : bet.status === 'resolved' ? 'text-purple bg-purple/10 border-purple/20'
            : 'text-gray-400 bg-white/5 border-white/10')}>
            {bet.status}
          </span>
          <span className="text-xs text-gray-500 capitalize bg-white/5 px-3 py-1 rounded-full">{bet.category}</span>
          {bet.featured && <span className="text-xs text-cyan flex items-center gap-1"><Star size={10}/> Featured</span>}
          {bet.creator_type === 'admin' && <span className="text-xs text-purple bg-purple/10 px-2 py-0.5 rounded-full border border-purple/20">Admin Bet</span>}
        </div>

        <h1 className="text-2xl md:text-3xl font-black leading-tight">{bet.title || bet.description}</h1>
        {bet.title && bet.description && (
          <p className="text-gray-400 leading-relaxed">{bet.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-gray-600">Time Remaining</p>
            <CountdownTimer expiry={bet.expiry} size="md" className="mt-1" />
          </div>
          <div>
            <p className="text-xs text-gray-600">Total Pool</p>
            <p className="text-xl font-black text-cyan">◎ {fmt(totalPool)}</p>
            <p className="text-xs text-slate-500">{usdFromSol(totalPool/LAMPORTS, solPrice)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Participants</p>
            <p className="text-xl font-black flex items-center gap-1"><Users size={16}/>{bet.bet_count || 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Min Stake</p>
            <p className="text-xl font-black">◎ {((bet.min_stake||0)/LAMPORTS).toFixed(2)}</p>
            <p className="text-xs text-slate-500">{usdFromSol((bet.min_stake||0)/LAMPORTS, solPrice)}</p>
          </div>
        </div>
        </div>
      </div>

      {/* Timeline + on-chain verification */}
      <div className="grid sm:grid-cols-4 gap-3">
        {[
          { l: 'Created', v: tdate(bet.created_at), icon: Clock },
          { l: ['resolved','cancelled'].includes(bet.status) ? 'Closed' : 'Closes', v: tdate(bet.expiry), icon: Clock },
          { l: 'Pool size', v: `◎ ${fmt(totalPool)} · ${usdFromSol(totalPool/LAMPORTS, solPrice)}`, icon: TrendingUp },
          { l: bet.status === 'resolved' ? 'Resolved' : 'Status', v: bet.status === 'resolved' && bet.winning_outcome_index != null ? `Winner: ${outcomes[bet.winning_outcome_index]}` : bet.status, icon: ShieldCheck },
        ].map((x) => (
          <div key={x.l} className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1"><x.icon size={12}/> {x.l}</div>
            <p className="text-sm font-bold text-white capitalize">{x.v}</p>
          </div>
        ))}
      </div>
      <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-2 text-xs text-slate-400">
        <ShieldCheck size={14} className="text-win shrink-0"/>
        Every wager in this pool is a real SOL deposit, verified on-chain before it counts. {participants.length} verified deposit{participants.length === 1 ? '' : 's'}.
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: outcomes + chart */}
        <div className="lg:col-span-2 space-y-5">
          {/* Outcomes */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-bold mb-4">Outcomes</h2>
            <OutcomeBar
              outcomes={outcomes} pools={pools}
              winningIndex={bet.winning_outcome_index}
              size="lg"
              onSelect={isOpen ? (i) => requireBet(i) : undefined}
              selectedIndex={selectedOutcome ?? undefined}
            />
          </div>

          {/* Charts */}
          {totalPool > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="font-bold mb-4">Pool Distribution</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Pie */}
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`◎ ${fmt(v)}`, '']} contentStyle={{ background:'#111118', border:'1px solid rgba(255,255,255,.1)', borderRadius:'8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Bar */}
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} width={60} />
                      <Tooltip formatter={(v: any) => [`◎ ${fmt(v)}`, '']} contentStyle={{ background:'#111118', border:'1px solid rgba(255,255,255,.1)', borderRadius:'8px' }} />
                      <Bar dataKey="value" radius={4}>
                        {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Participants */}
          {participants.length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="font-bold mb-4 flex items-center gap-2"><Users size={15} className="text-cyan"/> Participants ({participants.length})</h2>
              <div className="space-y-2">
                {participants.slice(0,10).map((p, i) => {
                  const c = OUTCOME_COLORS[(p.outcome_index||0) % OUTCOME_COLORS.length];
                  return (
                    <div key={p.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                      <span className="text-gray-600 text-sm w-5">{i+1}</span>
                      <span className="font-mono text-xs text-gray-400 flex-1 truncate">{p.user_wallet.slice(0,8)}...{p.user_wallet.slice(-4)}</span>
                      {p.tx_signature && (
                        <a href={`https://solscan.io/tx/${p.tx_signature}`} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-win flex items-center gap-0.5 hover:underline shrink-0" title="Verified on-chain">
                          <ShieldCheck size={11}/> verified <ExternalLink size={9}/>
                        </a>
                      )}
                      <PayoutProof claimTx={(p as any).claim_tx} verified={(p as any).payout_verified} size="xs" />
                      <span className={['text-xs font-semibold px-2 py-0.5 rounded-full shrink-0', c.bg, c.text].join(' ')}>
                        {outcomes[p.outcome_index||0] || '?'}
                      </span>
                      <span className="text-white font-bold text-sm shrink-0 text-right">◎ {fmt(p.amount)}<span className="block text-[10px] text-slate-500 font-normal">{usdFromSol(p.amount/LAMPORTS, solPrice)}</span></span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Discussion */}
          <MarketComments betId={bet.id} />
        </div>

        {/* Right: sticky place bet panel */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5 sticky top-20 space-y-4">
            <h3 className="font-bold text-white">Place Your Bet</h3>

            {!isOpen ? (
              <div className="text-center py-6 text-gray-500">
                <p className="text-sm">{bet.status === 'resolved' ? 'This bet has been resolved.' : 'Betting is closed.'}</p>
                {bet.winning_outcome_index !== null && bet.winning_outcome_index !== undefined && (
                  <p className="text-win font-bold mt-2">Winner: {outcomes[bet.winning_outcome_index]}</p>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500">{user ? 'Click an outcome to place your bet' : 'Sign in to place a bet'}</p>
                <div className="space-y-2">
                  {outcomes.map((o, i) => {
                    const pct = totalPool > 0 ? (pools[i]/totalPool*100).toFixed(1) : (100/outcomes.length).toFixed(1);
                    const c = OUTCOME_COLORS[i % OUTCOME_COLORS.length];
                    return (
                      <button key={i} onClick={() => requireBet(i)}
                        className={['w-full flex items-center justify-between rounded-xl p-3 border transition-all hover:-translate-y-0.5', c.bg, c.border].join(' ')}>
                        <span className={['font-bold text-sm', c.text].join(' ')}>{o}</span>
                        <span className="text-xs text-gray-400">{pct}%</span>
                      </button>
                    );
                  })}
                </div>

                {user ? (
                  <button onClick={() => requireBet()}
                    className="w-full py-3.5 bg-sol-gradient text-black font-black rounded-xl neon-cyan hover:opacity-90 transition-opacity text-sm">
                    Place Bet
                  </button>
                ) : (
                  <Link href={'/auth?redirect=' + encodeURIComponent('/app/bet/' + (id || ''))}
                    className="block w-full py-3.5 bg-sol-gradient text-black font-black rounded-xl neon-cyan hover:opacity-90 transition-opacity text-sm text-center">
                    Sign in to place a bet
                  </Link>
                )}

                {/* Fee info */}
                <div className="bg-white/3 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between text-gray-500">
                    <span className="flex items-center gap-1"><Info size={10}/>Fee tiers</span>
                  </div>
                  <div className="text-gray-600">
                    &lt;$50 pool: $0.50 · $50–$500: $2.50 · &gt;$500: $5
                  </div>
                  <div className="text-gray-600">Prize pool = 97.5% of total · 2.5% platform fee</div>
                </div>
              </>
            )}

            {/* Responsible gambling */}
            <p className="text-xs text-gray-700 text-center">⚠️ 18+ · Gamble responsibly</p>
          </div>
        </div>
      </div>

      {showBetModal && user && (
        <PlaceBetModal
          bet={bet}
          onClose={() => setShowBetModal(false)}
          onSuccess={() => { setShowBetModal(false); loadBet(); }}
        />
      )}
    </div>
  );
}
