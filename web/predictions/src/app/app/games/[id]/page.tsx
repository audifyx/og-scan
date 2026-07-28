'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { Swords, Trophy, Loader2, ArrowLeft, Copy, CheckCircle, ShieldCheck, Dices } from 'lucide-react';
import { JoinMatchModal } from '@/components/games/JoinMatchModal';
import { GAME_META } from '@/lib/games/match-meta';
import { supabase } from '@/lib/supabase';
import clsx from 'clsx';

const sol = (l: number) => (Number(l) / LAMPORTS_PER_SOL).toFixed(3);
const short = (w?: string | null) => (w ? w.slice(0, 4) + '…' + w.slice(-4) : '—');
const labelOf = (g: string) => GAME_META.find(m => m.id === g)?.label || g;


export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { publicKey } = useWallet();
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showJoin, setShowJoin] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const revealTimer = useRef<any>(null);

  const myWallet = publicKey?.toBase58() || null;

  const load = useCallback(async () => {
    const r = await fetch(`/api/games/matches?id=${id}`, { cache: 'no-store' });
    const d = await r.json();
    if (d.ok) setMatch(d.match); else setError(d.error || 'Match not found.');
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`match-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_matches', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  useEffect(() => {
    if (match?.status === 'resolved' && !revealed) {
      revealTimer.current = setTimeout(() => setRevealed(true), 1600);
      return () => clearTimeout(revealTimer.current);
    }
  }, [match?.status, revealed]);

  const copyInvite = () => {
    navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '');
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const cancel = async () => {
    setError('');
    const r = await fetch('/api/games/matches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', matchId: id }) });
    const d = await r.json();
    if (!d.ok) setError(d.error || 'Could not cancel.'); else load();
  };

  if (loading) return <div className="max-w-2xl mx-auto py-20 flex items-center justify-center text-gray-500"><Loader2 className="animate-spin mr-2" /> Loading game…</div>;
  if (!match) return (
    <div className="max-w-2xl mx-auto py-20 text-center text-gray-500">
      <p>{error || 'Match not found.'}</p>
      <button onClick={() => router.push('/app/games')} className="mt-4 text-cyan font-bold">Back to Games</button>
    </div>
  );

  const isCreator = !!myWallet && myWallet === match.creator_wallet;
  const isOpponent = !!myWallet && myWallet === match.opponent_wallet;
  const iAmIn = isCreator || isOpponent;
  const youWon = match.status === 'resolved' && !!myWallet && myWallet === match.winner_wallet;
  const payout = Math.max(0, Math.floor(match.pot - match.pot * (Number(match.rake_bps || 500) / 10000)));

  return (
    <div className="max-w-2xl mx-auto space-y-5 py-2">
      <button onClick={() => router.push('/app/games')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white"><ArrowLeft size={15} /> Games</button>

      <div className="bg-card border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple to-cyan flex items-center justify-center"><Swords size={24} className="text-black" /></div>
            <div>
              <h1 className="text-xl font-black text-white">{labelOf(match.game)}</h1>
              <p className="text-sm text-gray-500">{short(match.creator_wallet)} {match.opponent_wallet ? `vs ${short(match.opponent_wallet)}` : 'vs …'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Stake each</p>
            <p className="font-bold text-white text-lg">◎ {sol(match.wager)}</p>
          </div>
        </div>
        {match.creator_side && <p className="mt-3 text-xs text-gray-500">Creator picked <b className="text-gray-300">{match.creator_side}</b></p>}
      </div>

      {error && <p className="text-sm text-loss text-center">{error}</p>}

      {match.status === 'open' && (
        <div className="bg-card border border-white/10 rounded-2xl p-6 text-center">
          {isCreator ? (
            <>
              <Loader2 size={28} className="animate-spin mx-auto text-cyan" />
              <p className="font-bold text-white mt-3">Waiting for an opponent…</p>
              <p className="text-sm text-gray-500 mt-1">Share this game. It plays out instantly when someone joins and pays the matching stake.</p>
              <button onClick={copyInvite} className="mt-4 inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl px-4 py-2.5 text-sm">
                {copied ? <><CheckCircle size={15} className="text-win" /> Link copied</> : <><Copy size={15} /> Copy invite link</>}
              </button>
              <button onClick={cancel} className="mt-3 block mx-auto text-xs text-gray-500 hover:text-loss">Cancel & refund my stake</button>
            </>
          ) : (
            <>
              <Dices size={28} className="mx-auto text-cyan" />
              <p className="font-bold text-white mt-3">Join this game</p>
              <p className="text-sm text-gray-500 mt-1">Match the stake of <b className="text-white">◎ {sol(match.wager)}</b>. The game settles instantly once your deposit is verified.</p>
              {!publicKey
                ? <p className="text-xs text-gray-600 mt-4">Connect your wallet to join.</p>
                : <button onClick={() => setShowJoin(true)} className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-cyan to-purple text-black font-black rounded-xl px-6 py-3">
                    <Swords size={16} /> Join ◎ {sol(match.wager)}
                  </button>}
            </>
          )}
        </div>
      )}

      {match.status === 'resolved' && (
        <div className="bg-card border border-white/10 rounded-2xl p-6 text-center">
          {!revealed ? (
            <div className="py-6">
              <div className="text-5xl animate-bounce">🎲</div>
              <p className="mt-3 font-bold text-white animate-pulse">Playing it out…</p>
            </div>
          ) : (
            <div className="animate-slide-up">
              {iAmIn ? (
                <p className={clsx('text-3xl font-black', youWon ? 'text-win' : 'text-loss')}>{youWon ? '🏆 You won!' : 'You lost'}</p>
              ) : (
                <p className="text-2xl font-black text-white flex items-center justify-center gap-2"><Trophy size={20} className="text-win" /> {short(match.winner_wallet)} won</p>
              )}
              <div className="mt-3 flex items-center justify-center gap-4">
                <div className="text-center"><p className="text-[10px] uppercase tracking-widest text-gray-500">{short(match.creator_wallet)}</p><p className="text-2xl font-black text-white">{match.creator_score}</p></div>
                <span className="text-gray-600 font-bold">vs</span>
                <div className="text-center"><p className="text-[10px] uppercase tracking-widest text-gray-500">{short(match.opponent_wallet)}</p><p className="text-2xl font-black text-white">{match.opponent_score}</p></div>
              </div>
              <p className="mt-3 text-sm text-gray-400">Winner: <b className="text-win">{short(match.winner_wallet)}</b> took <b className="text-white">◎ {sol(payout)}</b> (pot ◎ {sol(match.pot)} − 2.5% fee)</p>
              {youWon && <p className="text-win font-bold mt-2 text-sm">Your winnings were credited. Request a withdrawal anytime — most paid within 5 hours.</p>}
              <button onClick={() => router.push('/app/games')} className="mt-5 inline-flex items-center gap-2 bg-gradient-to-r from-cyan to-purple text-black font-black rounded-xl px-6 py-3">
                <Swords size={16} /> Play another
              </button>
            </div>
          )}
        </div>
      )}

      {match.status === 'cancelled' && (
        <div className="bg-card border border-white/10 rounded-2xl p-6 text-center text-gray-400">This game was cancelled and the creator was refunded.</div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-300 flex items-center gap-2"><ShieldCheck size={14} className="text-cyan" /> Provably fair</p>
        <p className="text-[11px] text-gray-500 mt-2 break-all">Seed hash (committed before play): <span className="font-mono text-gray-400">{match.server_seed_hash}</span></p>
        {match.server_seed
          ? <p className="text-[11px] text-gray-500 mt-1 break-all">Revealed seed: <span className="font-mono text-gray-400">{match.server_seed}</span></p>
          : <p className="text-[11px] text-gray-600 mt-1">The seed is revealed here once the game resolves, so you can verify the result.</p>}
      </div>

      {showJoin && <JoinMatchModal match={match} onClose={() => setShowJoin(false)} onResolved={() => { setShowJoin(false); setRevealed(false); load(); }} />}
    </div>
  );
}
