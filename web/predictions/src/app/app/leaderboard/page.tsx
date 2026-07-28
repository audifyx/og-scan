'use client';
import Link from 'next/link';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { Trophy, Crown, Medal, TrendingUp, Users } from 'lucide-react';
import clsx from 'clsx';

const LAMPORTS = 1_000_000_000;
const hrefFor = (e: any) => `/app/u/${encodeURIComponent(e.username || e.user_id || e.id)}`;

export default function LeaderboardPage() {
  const { entries, loading } = useLeaderboard();
  const top3 = entries.slice(0,3);
  const rest  = entries.slice(3);

  const RANK_STYLE = [
    { icon: Crown,  glow:'neon-cyan',   ring:'border-cyan/40',   textC:'text-cyan',   label:'1st' },
    { icon: Medal,  glow:'neon-purple',  ring:'border-purple/40', textC:'text-purple', label:'2nd' },
    { icon: Medal,  glow:'',            ring:'border-orange-400/40', textC:'text-orange-400', label:'3rd' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2">
          <Trophy size={22} className="text-cyan"/> Leaderboard
        </h1>
        <p className="text-gray-500 text-sm mt-1">Top bettors ranked by wins this season</p>
      </div>

      {/* Podium */}
      {!loading && top3.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[top3[1], top3[0], top3[2]].filter(Boolean).map((e, i) => {
            const rank = [2,1,3][i];
            const s = RANK_STYLE[rank-1];
            const Icon = s.icon;
            return (
              <div key={e.id} className={clsx(
                'glass-card rounded-2xl p-5 text-center flex flex-col items-center gap-2 border',
                rank===1 ? 'border-cyan/30 bg-cyan/5' : rank===2 ? 'border-purple/20' : 'border-white/5',
                rank===1 && 'order-2', rank===2 && 'order-1', rank===3 && 'order-3',
              )}>
                <div className={clsx('w-10 h-10 rounded-xl border-2 flex items-center justify-center', s.ring)}>
                  <Icon size={18} className={s.textC}/>
                </div>
                <div className={clsx('w-14 h-14 rounded-full border-2 flex items-center justify-center font-black text-xl', s.ring, s.glow)}>
                  {(e.display_name||e.username||'A').charAt(0).toUpperCase()}
                </div>
                <div>
                  <Link href={hrefFor(e)} className="text-white font-bold text-sm truncate max-w-24 hover:text-cyan">
                    {e.display_name||e.username||(e.wallet?.slice(0,6)+'...')}
                  </Link>
                  <p className={['text-xs font-bold', s.textC].join(' ')}>{s.label}</p>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p>{e.wins}W · {e.losses}L</p>
                  <p className="text-win font-medium">◎ {(e.total_wagered||0).toFixed(2)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs text-gray-600 uppercase tracking-widest border-b border-white/5">
          <span className="col-span-1">#</span>
          <span className="col-span-5">Bettor</span>
          <span className="col-span-2 text-center">W/L</span>
          <span className="col-span-2 text-center">Bets</span>
          <span className="col-span-2 text-right">Volume</span>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({length:10}).map((_,i)=><div key={i} className="h-10 shimmer rounded-lg"/>)}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <Users size={36} className="mx-auto mb-3 opacity-30"/>
            <p>No bettors yet. Be the first!</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {entries.map((e,i) => (
              <div key={e.id} className="grid grid-cols-12 gap-2 px-4 py-3.5 items-center hover:bg-white/3 transition-colors">
                <span className={clsx('col-span-1 font-black text-sm',
                  i===0?'text-cyan':i===1?'text-purple':i===2?'text-orange-400':'text-gray-600')}>
                  {i+1}
                </span>
                <Link href={hrefFor(e)} className="col-span-5 flex items-center gap-3 hover:opacity-80">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple to-cyan flex items-center justify-center text-sm font-black shrink-0">
                    {(e.display_name||e.username||'A').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">
                      {e.display_name||e.username||(e.wallet?.slice(0,6)+'...')}
                    </p>
                    {e.wallet && (
                      <p className="text-gray-600 text-xs font-mono">{e.wallet.slice(0,6)}...{e.wallet.slice(-4)}</p>
                    )}
                  </div>
                </Link>
                <div className="col-span-2 text-center">
                  <span className="text-win text-sm font-bold">{e.wins}</span>
                  <span className="text-gray-600 text-xs"> / </span>
                  <span className="text-loss text-sm font-bold">{e.losses}</span>
                </div>
                <div className="col-span-2 text-center text-gray-400 text-sm">{e.total_bets}</div>
                <div className="col-span-2 text-right">
                  <p className="text-cyan font-bold text-sm">◎ {(e.total_wagered||0).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
