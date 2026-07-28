'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback } from 'react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Swords, Plus, Coins, Dices, Trophy, Loader2, Clock, Info, X, Spade, CircleDot, Rocket, Disc3, Hash, Circle, Cherry, Hand, Target, Zap, Goal, Bomb } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { CreateMatchModal } from '@/components/games/CreateMatchModal';
import { JoinMatchModal } from '@/components/games/JoinMatchModal';
import { supabase } from '@/lib/supabase';
import clsx from 'clsx';

const sol = (l: number) => (Number(l) / LAMPORTS_PER_SOL).toFixed(3);
const short = (w?: string | null) => (w ? w.slice(0, 4) + '…' + w.slice(-4) : '—');
const GAME_ICON: Record<string, any> = { coinflip: Coins, dice: Dices, highcard: Spade, plinko: CircleDot, crash: Rocket, wheel: Disc3, evenodd: Hash, redblack: Circle, sevens: Dices, slots: Cherry, rps: Hand, war: Swords, blackjack: Spade, darts: Target, race: Zap, penalty: Goal, mines: Bomb };
const GAME_LABEL: Record<string, string> = { coinflip: 'Coinflip', dice: 'Dice Roll', highcard: 'High Card', plinko: 'Plinko', crash: 'Crash', wheel: 'Wheel of Fortune', evenodd: 'Even or Odd', redblack: 'Red or Black', sevens: 'Lucky 7s', slots: 'Slots', rps: 'Rock Paper Scissors', war: 'Card War', blackjack: 'Blackjack 21', darts: 'Darts', race: 'Rocket Race', penalty: 'Penalty Shootout', mines: 'Mines' };
const GameIcon = ({ g, size = 16 }: { g: string; size?: number }) => { const I = GAME_ICON[g] || Coins; return <I size={size} />; };
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const SLOTSYM = ['🍒', '🍋', '🔔', '⭐', '7️⃣', '💎', '🍀'];
function ResultLine({ game, result }: { game?: string; result: any }) {
  if (!game || !result) return null;
  const W = ({ children }: any) => <p className="text-gray-400 mt-2 text-sm">{children}</p>;
  if (game === 'coinflip') return <W>Coin landed <b className="text-white">{result.flip?.toUpperCase()}</b></W>;
  if (game === 'evenodd') return <W>Number <b className="text-white">{result.number}</b> ({result.parity?.toUpperCase()})</W>;
  if (game === 'redblack') return <W>Spin landed <b className={result.color === 'red' ? 'text-loss' : 'text-white'}>{result.color?.toUpperCase()}</b></W>;
  if (game === 'wheel') return <W>The wheel picked the {result.pick}.</W>;
  if (game === 'rps') return <W>Creator <b className="text-white">{String(result.creator).toUpperCase()}</b> vs Opponent <b className="text-white">{String(result.opponent).toUpperCase()}</b></W>;
  if (game === 'war') return <W>Card War <b className="text-white">{result.creatorWins}</b> - <b className="text-white">{result.opponentWins}</b> (rounds won)</W>;
  if (game === 'penalty') return <W>Shootout <b className="text-white">{result.creatorGoals}</b> - <b className="text-white">{result.opponentGoals}</b></W>;
  if (game === 'blackjack') {
    const bj = (x: any) => x ? (x.bust ? `BUST (${x.total})` : x.total) : '?';
    return <W>Creator <b className="text-white">{bj(result.creator)}</b> vs Opponent <b className="text-white">{bj(result.opponent)}</b></W>;
  }
  if (game === 'darts') return <W>Creator <b className="text-white">{result.creator}</b> vs Opponent <b className="text-white">{result.opponent}</b> (darts)</W>;
  if (game === 'race') return <W>Creator <b className="text-white">{result.creator}m</b> vs Opponent <b className="text-white">{result.opponent}m</b></W>;
  const c = result.creator ?? result.creatorRoll, o = result.opponent ?? result.opponentRoll;
  const card = (x: any) => x ? `${RANKS[x.rank] || x.rank}${SUITS[x.suit] || ''}` : '?';
  const slots = (x: any) => Array.isArray(x) ? x.map((i: number) => SLOTSYM[i] || '?').join(' ') : '?';
  const sep = ' vs ';
  if (game === 'highcard') return <W>Creator <b className="text-white">{card(c)}</b>{sep}Opponent <b className="text-white">{card(o)}</b></W>;
  if (game === 'crash') return <W>Creator <b className="text-white">{c}x</b>{sep}Opponent <b className="text-white">{o}x</b></W>;
  if (game === 'plinko') return <W>Creator <b className="text-white">{c?.mult ?? c}x</b>{sep}Opponent <b className="text-white">{o?.mult ?? o}x</b></W>;
  if (game === 'slots') return <W>Creator {slots(c)}{sep}Opponent {slots(o)}</W>;
  if (game === 'sevens') { const cs = Array.isArray(c) ? c[0] + c[1] : c, os = Array.isArray(o) ? o[0] + o[1] : o; return <W>Creator <b className="text-white">{cs}</b>{sep}Opponent <b className="text-white">{os}</b></W>; }
  return <W>Creator <b className="text-white">{typeof c === 'object' ? JSON.stringify(c) : c}</b>{sep}Opponent <b className="text-white">{typeof o === 'object' ? JSON.stringify(o) : o}</b></W>;
}

type Tab = 'open' | 'mine' | 'history';

export default function GamesPage() {
  const { publicKey } = useWallet();
  const connected = !!publicKey;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('open');
  const [matches, setMatches] = useState<any[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [joinMatch, setJoinMatch] = useState<any>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const load = useCallback(async (t: Tab) => {
    const r = await fetch(`/api/games/matches?tab=${t}`, { cache: 'no-store' });
    const d = await r.json();
    if (d.ok) { setMatches(d.matches); if (d.me !== undefined) setMe(d.me); }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);
  useEffect(() => {
    const ch = supabase.channel('matches').on('postgres_changes', { event: '*', schema: 'public', table: 'game_matches' }, () => load(tab)).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tab, load]);

  const openJoin = (m: any) => {
    setError('');
    router.push(`/app/games/${m.id}`);
  };

  const cancel = async (m: any) => {
    const r = await fetch('/api/games/matches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', matchId: m.id }) });
    const d = await r.json();
    if (!d.ok) setError(d.error || 'Could not cancel.'); else load(tab);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple to-cyan flex items-center justify-center"><Swords size={22} className="text-black" /></div>
          <div><h1 className="text-2xl font-black text-white">Games</h1><p className="text-sm text-gray-500">1v1 SOL matches. Winner takes the pot.</p></div>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-cyan text-black font-bold rounded-xl px-4 py-2.5 text-sm hover:opacity-90"><Plus size={16} /> Create game</button>
      </div>

      <div className="bg-cyan/5 border border-cyan/15 rounded-xl p-3 flex gap-2.5 text-sm text-gray-400">
        <Info size={16} className="text-cyan shrink-0 mt-0.5" />
        <span>Both players stake the same amount on-chain. The winner is decided provably-fair and takes the pot minus a 2.5% fee. Payouts are sent manually by our team — most within 5 hours, always under 24 hours. You'll be notified when yours is sent.</span>
      </div>

      <div className="flex gap-2">
        {(['open', 'mine', 'history'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={clsx('px-4 py-2 rounded-xl text-sm font-bold capitalize', tab === t ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500 hover:text-gray-300')}>
            {t === 'mine' ? 'My games' : t}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-loss">{error}</p>}

      <div className="space-y-2">
        {matches.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <Swords size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">{tab === 'open' ? 'No open games. Create one!' : tab === 'mine' ? 'You have no games yet.' : 'No finished games yet.'}</p>
          </div>
        ) : matches.map(m => {
          const isMine = me && m.creator_wallet && false; // creator identity by user handled server-side
          const mineCreator = m.status === 'open' && tab === 'mine';
          return (
            <div key={m.id} className="bg-card border border-white/8 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-cyan"><GameIcon g={m.game} size={18} /></div>
                <div>
                  <p className="font-bold text-white flex items-center gap-2">{GAME_LABEL[m.game] || m.game}
                    {m.creator_side && <span className="text-[11px] text-gray-500">creator: {m.creator_side}</span>}
                  </p>
                  <p className="text-xs text-gray-500">{short(m.creator_wallet)} {m.opponent_wallet ? `vs ${short(m.opponent_wallet)}` : 'waiting…'}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">Stake</p>
                  <p className="font-bold text-white">◎ {sol(m.wager)}</p>
                </div>

                {m.status === 'open' && (
                  tab === 'mine'
                    ? <button onClick={() => cancel(m)} className="text-sm bg-white/5 hover:bg-loss/20 hover:text-loss text-gray-400 rounded-xl px-3 py-2">Cancel</button>
                    : <button onClick={() => openJoin(m)} className="flex items-center gap-1.5 bg-gradient-to-r from-cyan to-purple text-black font-bold rounded-xl px-4 py-2 text-sm disabled:opacity-50">
                        Join ◎ {sol(m.wager)}
                      </button>
                )}
                {m.status === 'resolved' && (
                  <button onClick={() => router.push(`/app/games/${m.id}`)} className="text-right group">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">Winner</p>
                    <p className="font-bold text-win flex items-center gap-1 group-hover:underline"><Trophy size={12} /> {short(m.winner_wallet)}</p>
                  </button>
                )}
                {m.status === 'cancelled' && <span className="text-xs text-gray-500">cancelled</span>}
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && <CreateMatchModal onClose={() => setShowCreate(false)} onCreated={() => load('mine')} />}

      {joinMatch && <JoinMatchModal match={joinMatch} onClose={() => setJoinMatch(null)} onResolved={(d) => { setJoinMatch(null); setResult(d); load(tab); }} />}

      {/* Result modal */}
      {result && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setResult(null)}>
          <div className="bg-card border border-white/10 rounded-2xl w-full max-w-sm p-6 text-center animate-slide-up" onClick={e => e.stopPropagation()}>
            <p className={`text-3xl font-black ${result.youWon ? 'text-win' : 'text-loss'}`}>{result.youWon ? '🏆 You won!' : 'You lost'}</p>
            <ResultLine game={result.match?.game} result={result.result} />
            {result.youWon && <p className="text-win font-bold mt-3">+◎ {sol(result.payout)} added to your balance</p>}
            <p className="text-xs text-gray-600 mt-3">{result.youWon ? "Winnings are in your wallet balance. Request a withdrawal anytime — most paid within 5 hours, always under 24h." : 'GG. Run it back?'}</p>
            <button onClick={() => setResult(null)} className="mt-4 w-full bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl py-2.5">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
