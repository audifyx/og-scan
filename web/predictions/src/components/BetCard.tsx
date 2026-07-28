'use client';
import { Bet } from '@/utils/types';
import { CountdownTimer } from './CountdownTimer';
import { Lock, Trophy, Users } from 'lucide-react';
import clsx from 'clsx';
import { useSolPrice, usdFromSol } from '@/hooks/useSolPrice';

const LAMPORTS = 1_000_000_000;

interface Props {
  bet: Bet;
  onClick?: (bet: Bet) => void;            // open detail / view
  onPick?: (bet: Bet, outcomeIndex: number) => void; // quick-bet a specific outcome
}

// Polymarket-style market card: thumbnail, question, probability %, Yes/No (or
// top-outcome) action buttons, and a volume + time footer.
export function BetCard({ bet, onClick, onPick }: Props) {
  const solPrice = useSolPrice();
  const outcomes = bet.outcomes?.length ? bet.outcomes : [bet.yes_label || 'Yes', bet.no_label || 'No'];
  const pools    = (bet.outcome_pools?.length ? bet.outcome_pools : [bet.yes_pool || 0, bet.no_pool || 0]).map(Number);
  const total    = pools.reduce((s, p) => s + p, 0);
  const pct = (i: number) => total > 0 ? Math.round((pools[i] / total) * 100) : Math.round(100 / outcomes.length);

  const max = bet.max_participants ?? 15;
  const taken = bet.bet_count ?? 0;
  const spots = Math.max(0, max - taken);
  const isFull = spots === 0;
  const isOpen = ['open', 'active'].includes(bet.status);
  const canBet = isOpen && !isFull;
  const msLeft = new Date(bet.expiry).getTime() - Date.now();
  const endingSoon = isOpen && msLeft > 0 && msLeft < 3600000;
  const hot = isOpen && (taken >= 8 || total >= 5 * LAMPORTS);
  const isBinary = outcomes.length === 2;
  const lead = pools.indexOf(Math.max(...pools));
  const leadPct = total > 0 ? pct(lead) : pct(0);

  const pick = (e: React.MouseEvent, i: number) => {
    e.stopPropagation();
    if (!canBet) return;
    (onPick || ((b) => onClick?.(b)))(bet, i);
  };

  const shareX = (e: React.MouseEvent) => {
    e.stopPropagation();
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://orbitx.world';
    const url = `${origin}/app/bet/${bet.id}`;
    const odds = isBinary
      ? `${outcomes[0]} ${pct(0)}% · ${outcomes[1]} ${pct(1)}%`
      : `${outcomes[lead]} leading at ${leadPct}%`;
    const vol = usdFromSol(total / LAMPORTS, solPrice);
    const text = `🎲 ${bet.title || bet.description}\n\n📊 ${odds}\n💰 ${vol} in the pool · ${spots} spots left\n\nThink you know? Put it on the line 👇\nBet now on @solnobet`;
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(intent, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={() => onClick?.(bet)}
      className={clsx(
        'glass-card group rounded-2xl flex flex-col transition-all relative overflow-hidden cursor-pointer',
        bet.featured && 'ring-1 ring-purple/30',
        canBet ? 'hover:-translate-y-1.5' : 'opacity-80'
      )}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Top: thumbnail + question + probability */}
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-white/5 border border-white/10">
            {bet.image_url
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={bet.image_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full grid place-items-center text-cyan text-lg font-black">{(bet.category||'?')[0]?.toUpperCase()}</div>}
          </div>
          <h3 className="flex-1 min-w-0 font-semibold text-[15px] text-white leading-snug line-clamp-2">
            {bet.title || bet.description}
          </h3>
          <button
            onClick={shareX}
            title="Share on X"
            aria-label="Share on X"
            className="shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-slate-300 grid place-items-center transition-colors hover:bg-cyan/10 hover:text-cyan hover:border-cyan/30"
          >
            <span className="text-[15px] font-bold leading-none">𝕏</span>
          </button>
          {isBinary ? (
            <div className="text-right shrink-0">
              <p className="text-lg font-extrabold text-white leading-none">{pct(0)}%</p>
              <p className="text-[10px] text-slate-400 mt-0.5">chance</p>
            </div>
          ) : (
            <div className="text-right shrink-0">
              <p className="text-lg font-extrabold text-white leading-none">{leadPct}%</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[64px]">{outcomes[lead]}</p>
            </div>
          )}
        </div>

        {/* Status row */}
        <div className="flex items-center gap-2 flex-wrap text-[10px]">
          <span className="capitalize text-slate-400">{bet.category}</span>
          {bet.status === 'resolved' && <span className="text-purple flex items-center gap-1"><Trophy size={10}/> resolved</span>}
          {bet.status === 'locked' && <span className="text-gold flex items-center gap-1"><Lock size={10}/> locked</span>}
          {hot && <span className="font-bold px-1.5 py-0.5 rounded-full bg-magenta/15 text-magenta border border-magenta/30">🔥 Hot</span>}
          {endingSoon && <span className="font-bold px-1.5 py-0.5 rounded-full bg-loss/15 text-loss border border-loss/30">⏳ Ending soon</span>}
        </div>

        {/* Action buttons */}
        {canBet ? (
          isBinary ? (
            <div className="flex gap-2 mt-auto">
              <button onClick={(e) => pick(e, 0)}
                className="flex-1 py-2.5 rounded-xl bg-win/15 hover:bg-win/25 text-win font-bold text-sm transition-colors flex items-center justify-center gap-1.5">
                {outcomes[0]} <span className="text-win/70 text-xs">{pct(0)}%</span>
              </button>
              <button onClick={(e) => pick(e, 1)}
                className="flex-1 py-2.5 rounded-xl bg-loss/15 hover:bg-loss/25 text-loss font-bold text-sm transition-colors flex items-center justify-center gap-1.5">
                {outcomes[1]} <span className="text-loss/70 text-xs">{pct(1)}%</span>
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 mt-auto">
              {outcomes.slice(0, 3).map((o, i) => (
                <button key={i} onClick={(e) => pick(e, i)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-cyan/10 hover:text-cyan transition-colors text-sm">
                  <span className="truncate text-slate-200">{o}</span>
                  <span className="text-slate-400 text-xs font-semibold shrink-0 ml-2">{pct(i)}%</span>
                </button>
              ))}
              {outcomes.length > 3 && <p className="text-[10px] text-slate-600 text-center">+{outcomes.length - 3} more outcomes</p>}
            </div>
          )
        ) : (
          <div className="mt-auto text-center py-2 text-xs text-slate-500 rounded-xl bg-white/5">
            {isFull ? 'Bet full' : bet.status === 'resolved' && bet.winning_outcome_index != null ? `Winner: ${outcomes[bet.winning_outcome_index]}` : 'Closed'}
          </div>
        )}
      </div>

      {/* Footer: volume + spots + time */}
      <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between gap-3 text-[11px] text-slate-400">
        <span className="font-semibold text-slate-200">{usdFromSol(total / LAMPORTS, solPrice)} <span className="text-slate-500 font-normal">Vol.</span></span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Users size={11}/> {taken}/{max}</span>
          <CountdownTimer expiry={bet.expiry} size="xs" />
        </div>
      </div>
    </div>
  );
}
