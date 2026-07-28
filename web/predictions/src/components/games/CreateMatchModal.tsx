'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, Copy, CheckCircle, Wallet, ArrowRight } from 'lucide-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { GAME_META, MatchGame } from '@/lib/games/match-meta';
import { PlayGame } from './PlayGame';
import clsx from 'clsx';

const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET || '';

export function CreateMatchModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { publicKey } = useWallet();
  const router = useRouter();
  const [step, setStep] = useState<'pick' | 'play' | 'pay'>('pick');
  const [game, setGame] = useState<MatchGame>('coinflip');
  const [bet, setBet] = useState('0.1');
  const [score, setScore] = useState<number | null>(null);
  const [txSig, setTxSig] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const meta = GAME_META.find(g => g.id === game)!;
  const wager = Math.round((parseFloat(bet) || 0) * LAMPORTS_PER_SOL);

  const goPlay = () => {
    setError('');
    if (wager <= 0) return setError('Enter a stake.');
    if (!publicKey) return setError('Connect your wallet first.');
    if (!TREASURY) return setError('Treasury wallet is not configured yet.');
    setStep('play');
  };

  const onScored = (s: number) => { setScore(s); setStep('pay'); };
  const copyTreasury = () => { if (!TREASURY) return; navigator.clipboard.writeText(TREASURY); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const create = async () => {
    setError('');
    if (!txSig.trim()) return setError('Paste the transaction signature from your wallet.');
    if (!publicKey) return setError('Connect your wallet first.');
    setBusy(true);
    try {
      const r = await fetch('/api/games/matches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', game, score, wager, wallet: publicKey.toBase58(), txSignature: txSig.trim() }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Failed to create match.');
      onCreated(); onClose();
      if (d.match?.id) router.push(`/app/games/${d.match.id}`);
    } catch (e: any) { setError(e.message || 'Failed.'); } finally { setBusy(false); }
  };

  const Dot = ({ id, n }: { id: string; n: string }) => (
    <span className={clsx('px-2 py-1 rounded-full font-bold', step === id ? 'bg-cyan text-black' : 'bg-white/10 text-gray-400')}>{n}</span>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-white/10 rounded-2xl w-full max-w-md my-auto animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h2 className="font-bold text-white">Create a game</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-1.5 px-5 pt-4 text-[11px]">
          <Dot id="pick" n="1. Pick" /><ArrowRight size={11} className="text-gray-600" />
          <Dot id="play" n="2. Play" /><ArrowRight size={11} className="text-gray-600" />
          <Dot id="pay" n="3. Pay & submit" />
        </div>

        {step === 'pick' && (
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Game</p>
              <div className="grid grid-cols-2 gap-2">
                {GAME_META.map(m => (
                  <button key={m.id} onClick={() => setGame(m.id)}
                    className={clsx('rounded-xl py-2.5 px-3 text-sm font-bold text-left transition-all border flex items-center gap-2',
                      game === m.id ? 'bg-cyan text-black border-cyan' : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/25')}>
                    <span className="text-base">{m.emoji}</span> {m.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-xl bg-white/[0.03] border border-white/10 p-3 flex items-start gap-2"><span className="text-xl">{meta.emoji}</span><p className="text-xs text-gray-400">{meta.desc}</p></div>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Stake (SOL)</p>
              <div className="flex gap-2">
                <input type="number" value={bet} step="0.01" onChange={e => setBet(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-cyan/40" />
                {['0.1', '0.5', '1'].map(v => <button key={v} onClick={() => setBet(v)} className="px-3 text-xs bg-white/5 hover:bg-cyan/10 hover:text-cyan rounded-lg text-gray-500">{v}</button>)}
              </div>
              <p className="text-xs text-gray-600 mt-2">Opponent matches your stake. Winner takes ◎ {((parseFloat(bet) || 0) * 2 * 0.95).toFixed(3)} (5% house fee).</p>
            </div>
            {!publicKey && <p className="text-center text-xs text-gray-600">Connect your wallet to play.</p>}
            {error && <p className="text-sm text-loss">{error}</p>}
            <button onClick={goPlay} disabled={!publicKey} className="w-full bg-gradient-to-r from-cyan to-purple text-black font-black py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
              Play {meta.label} <ArrowRight size={16} />
            </button>
          </div>
        )}

        {step === 'play' && (
          <div className="p-5">
            <p className="text-center text-sm text-gray-400 mb-3">Play your <b className="text-white">{meta.label}</b>, then pay to submit your score.</p>
            <PlayGame game={game} onDone={onScored} />
          </div>
        )}

        {step === 'pay' && (
          <div className="p-5 space-y-4">
            <div className="text-center bg-white/5 border border-white/10 rounded-xl py-2.5">
              <span className="text-xs text-gray-500">Your score: </span><span className="font-black text-white">{score} / 1000</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-sm text-white font-bold flex items-center gap-2"><Wallet size={15} className="text-cyan" /> Pay to submit your score &amp; create the game</p>
              <p className="text-xs text-gray-400 mt-1.5">Send exactly <span className="text-white font-semibold">◎ {bet} SOL</span> to the treasury, then paste the transaction signature.</p>
              <div className="mt-2 flex items-center gap-2 bg-black/30 rounded-lg p-2.5">
                <span className="font-mono text-xs text-white break-all flex-1">{TREASURY || 'Treasury not configured'}</span>
                <button onClick={copyTreasury} disabled={!TREASURY} className="shrink-0 text-gray-400 hover:text-cyan transition-colors">
                  {copied ? <CheckCircle size={15} className="text-win" /> : <Copy size={15} />}
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Transaction signature</p>
              <input value={txSig} onChange={e => setTxSig(e.target.value)} placeholder="Paste your tx signature here"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-cyan/40" />
            </div>
            {error && <p className="text-sm text-loss">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setStep('play'); setScore(null); setError(''); }} disabled={busy} className="px-4 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl py-3.5 disabled:opacity-50">Replay</button>
              <button onClick={create} disabled={busy || !txSig.trim()} className="flex-1 bg-gradient-to-r from-cyan to-purple text-black font-black py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {busy ? <><Loader2 size={18} className="animate-spin" /> Verifying…</> : 'Pay & submit score'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
