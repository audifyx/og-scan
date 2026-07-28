'use client';
import { useState } from 'react';
import { X, Loader2, Copy, CheckCircle, Wallet } from 'lucide-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { GAME_META } from '@/lib/games/match-meta';
import { PlayGame } from './PlayGame';

const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET || '';
const sol = (l: number) => (Number(l) / LAMPORTS_PER_SOL).toFixed(3);

export function JoinMatchModal({ match, onClose, onResolved }: { match: any; onClose: () => void; onResolved: (d: any) => void }) {
  const { publicKey } = useWallet();
  const [step, setStep] = useState<'play' | 'pay'>('play');
  const [wager, setWager] = useState<number>(Number(match.wager));
  const [score, setScore] = useState<number | null>(null);
  const [txSig, setTxSig] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const label = GAME_META.find(g => g.id === match.game)?.label || match.game;

  // After playing, reserve the slot then go to payment.
  const onScored = async (s: number) => {
    setScore(s); setError('');
    if (!publicKey) { setError('Connect your wallet first.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/games/matches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reserve', matchId: match.id }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Could not reserve this game.');
      setWager(Number(d.wager)); setStep('pay');
    } catch (e: any) { setError(e.message || 'Could not reserve this game.'); } finally { setBusy(false); }
  };

  const copyTreasury = () => { if (!TREASURY) return; navigator.clipboard.writeText(TREASURY); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const confirm = async () => {
    setError('');
    if (!txSig.trim()) return setError('Paste the transaction signature from your wallet.');
    if (!publicKey) return setError('Connect your wallet first.');
    setBusy(true);
    try {
      const r = await fetch('/api/games/matches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm', matchId: match.id, score, wallet: publicKey.toBase58(), txSignature: txSig.trim() }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Could not settle the game.');
      onResolved(d);
    } catch (e: any) { setError(e.message || 'Failed to join.'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-white/10 rounded-2xl w-full max-w-md my-auto animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h2 className="font-bold text-white">Join {label}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
        </div>

        {step === 'play' && (
          <div className="p-5">
            <p className="text-center text-sm text-gray-400 mb-3">Beat <b className="text-white">{score ?? '—'}</b>. Play your {label}, then pay to submit your score.</p>
            <PlayGame game={match.game} onDone={onScored} />
            {busy && <p className="text-center text-xs text-gray-500 mt-3 flex items-center justify-center gap-2"><Loader2 size={13} className="animate-spin" /> Reserving your slot…</p>}
            {error && <p className="text-sm text-loss text-center mt-2">{error}</p>}
          </div>
        )}

        {step === 'pay' && (
          <div className="p-5 space-y-4">
            <div className="text-center bg-white/5 border border-white/10 rounded-xl py-2.5">
              <span className="text-xs text-gray-500">Your score: </span><span className="font-black text-white">{score} / 1000</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-sm text-white font-bold flex items-center gap-2"><Wallet size={15} className="text-cyan" /> Pay to submit your score &amp; start the match</p>
              <p className="text-xs text-gray-400 mt-1.5">Send exactly <span className="text-white font-semibold">◎ {sol(wager)} SOL</span> to the treasury, then paste the transaction signature. Highest score wins.</p>
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
            <button onClick={confirm} disabled={busy || !txSig.trim()} className="w-full bg-gradient-to-r from-cyan to-purple text-black font-black py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? <><Loader2 size={18} className="animate-spin" /> Verifying…</> : 'Pay & submit score'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
