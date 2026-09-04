'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMyBets } from '@/hooks/useMyBets';
import { OUTCOME_COLORS } from '@/components/OutcomeBar';
import { CountdownTimer } from '@/components/CountdownTimer';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, Trophy, Clock, Download } from 'lucide-react';
import clsx from 'clsx';
import { PayoutProof } from '@/components/PayoutProof';

import { useSolPrice, usdFromLamports } from '@/hooks/useSolPrice';
const LAMPORTS = 1_000_000_000;
const fmt = (l: number) => (l / LAMPORTS).toFixed(3);

type MyTab = 'all' | 'won' | 'lost' | 'pending';

export default function MyBetsPage() {
  const { publicKey, connected } = useWallet();
  const { bets, loading } = useMyBets(publicKey?.toBase58() ?? null);
  const [tab, setTab] = useState<MyTab>('all');
  const solPrice = useSolPrice();

  if (!connected) return (
    <div className="max-w-3xl mx-auto py-32 text-center space-y-4">
      <div className="w-16 h-16 bg-cyan/10 border border-cyan/20 rounded-2xl flex items-center justify-center mx-auto">
        <Wallet size={24} className="text-cyan" />
      </div>
      <h2 className="text-2xl font-black">Connect Your Wallet</h2>
      <p className="text-gray-500">Connect Phantom to see your betting history and claim winnings.</p>
    </div>
  );

  const totalStaked  = bets.reduce((s,b) => s + b.amount, 0);
  const totalWon     = bets.filter(b=>b.status==='won').reduce((s,b) => s + (b.payout||0), 0);
  const pnl          = totalWon - totalStaked;
  const wins         = bets.filter(b=>b.status==='won').length;
  const losses       = bets.filter(b=>b.status==='lost').length;
  const winRate      = bets.length > 0 ? Math.round(wins / bets.length * 100) : 0;

  const filtered = tab === 'all' ? bets
    : tab === 'won' ? bets.filter(b=>b.status==='won')
    : tab === 'lost' ? bets.filter(b=>b.status==='lost')
    : bets.filter(b=>['pending','confirmed'].includes(b.status));

  // PNL chart data (cumulative)
  const chartData = bets.slice().reverse().reduce((acc: any[], b, i) => {
    const prev = acc[i-1]?.pnl || 0;
    const delta = b.status==='won' ? (b.payout||0) - b.amount : b.status==='lost' ? -b.amount : 0;
    acc.push({ i: i+1, pnl: prev + delta / LAMPORTS });
    return acc;
  }, []);

  const TABS: { id: MyTab; label: string; count: number }[] = [
    { id:'all',     label:'All',     count: bets.length },
    { id:'won',     label:'Won',     count: wins },
    { id:'lost',    label:'Lost',    count: losses },
    { id:'pending', label:'Pending', count: bets.filter(b=>b.status==='pending').length },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">My Bets</h1>
          <p className="text-gray-500 text-sm mt-0.5 font-mono">{publicKey?.toBase58().slice(0,8)}...{publicKey?.toBase58().slice(-4)}</p>
        </div>
        <button className="flex items-center gap-2 text-xs text-gray-500 hover:text-white border border-white/10 hover:border-white/20 px-3 py-2 rounded-xl transition-all">
          <Download size={13}/> Export CSV
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'Total Wagered', v:`◎ ${fmt(totalStaked)}`, sub: usdFromLamports(totalStaked, solPrice), icon:Clock, c:'text-gray-300' },
          { label:'Total Won',     v:`◎ ${fmt(totalWon)}`,    sub: usdFromLamports(totalWon, solPrice), icon:Trophy, c:'text-cyan' },
          { label:'PNL',           v:`${pnl>=0?'+':''}◎ ${fmt(Math.abs(pnl))}`, sub: usdFromLamports(Math.abs(pnl), solPrice), icon: pnl>=0?TrendingUp:TrendingDown, c: pnl>=0?'text-win':'text-loss' },
          { label:'Win Rate',      v:`${winRate}%`,            icon:TrendingUp, c:'text-purple' },
        ].map(({ label, v, sub, icon: Icon, c }: any) => (
          <div key={label} className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">{label}</p>
              <Icon size={13} className={c} />
            </div>
            <p className={['text-xl font-black', c].join(' ')}>{v}</p>
            {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* PNL chart */}
      {chartData.length > 1 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-bold mb-4">PNL Over Time</h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={pnl>=0?'#22C55E':'#EF4444'} stopOpacity={0.3}/>
                    <stop offset="100%" stopColor={pnl>=0?'#22C55E':'#EF4444'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="i" hide />
                <YAxis hide />
                <Tooltip formatter={(v:any)=>[`◎ ${Number(v).toFixed(3)}`,'PNL']} contentStyle={{background:'#111118',border:'1px solid rgba(255,255,255,.1)',borderRadius:'8px'}}/>
                <Area dataKey="pnl" stroke={pnl>=0?'#22C55E':'#EF4444'} fill="url(#pnlGrad)" strokeWidth={2} dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2',
              tab===t.id ? 'bg-cyan text-black' : 'text-gray-500 hover:text-white')}>
            {t.label}
            <span className={clsx('text-xs px-1.5 py-0.5 rounded-full',tab===t.id?'bg-black/20':'bg-white/10')}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Bet list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="glass-card rounded-xl h-20 shimmer"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Clock size={36} className="mx-auto mb-3 opacity-30" />
          <p>No bets in this category yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => {
            const c = OUTCOME_COLORS[(b.outcome_index||0) % OUTCOME_COLORS.length];
            const outcomes = (b.bet as any)?.outcomes || [(b.bet as any)?.yes_label||'Yes', (b.bet as any)?.no_label||'No'];
            return (
              <div key={b.id} className="glass-card rounded-2xl p-4 flex items-center gap-4">
                <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0', c.bg, c.text)}>
                  {(b.outcome_index||0)+1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{(b.bet as any)?.title || 'Bet'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Picked: <span className={c.text}>{outcomes[b.outcome_index||0]||'?'}</span></p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-white font-bold text-sm">◎ {fmt(b.amount)}</p>
                  {b.status==='won' && b.payout && (
                    <p className="text-win text-xs font-bold">+◎ {fmt(b.payout)}</p>
                  )}
                  <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full inline-block capitalize',
                    b.status==='won'?'text-win bg-win/10':b.status==='lost'?'text-loss bg-loss/10':'text-gray-400 bg-white/5')}>
                    {b.status}
                  </span>
                  <div className="flex justify-end"><PayoutProof claimTx={(b as any).claim_tx} verified={(b as any).payout_verified} size="xs" /></div>
                </div>
                {b.status==='won' && !b.claimed && (
                  <button className="px-3 py-1.5 bg-win/20 border border-win/30 text-win text-xs font-bold rounded-lg hover:bg-win/30 transition-all neon-green shrink-0">
                    Claim ◎{fmt(b.payout||0)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
