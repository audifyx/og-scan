'use client';
import { useState, useEffect } from 'react';
import { X, AlertCircle, Info, Copy, CheckCircle, ExternalLink, ArrowRight, Wallet } from 'lucide-react';
import { Bet } from '@/utils/types';
import { supabase } from '@/lib/supabase';
import { useWallet } from '@solana/wallet-adapter-react';
import { OutcomeBar, OUTCOME_COLORS } from '@/components/OutcomeBar';
import { CountdownTimer } from '@/components/CountdownTimer';
import { quotePayout } from '@/lib/payout';
import { feeUsdForUsd, getSolUsd } from '@/lib/fees';
import clsx from 'clsx';

const LAMPORTS = 1_000_000_000;
const fmt = (l: number) => (l / LAMPORTS).toFixed(3);
const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET || '';

interface Props { bet: Bet; onClose: () => void; onSuccess?: () => void; initialOutcome?: number | null; }

export function PlaceBetModal({ bet, onClose, onSuccess, initialOutcome }: Props) {
  const { publicKey } = useWallet();
  const [step, setStep] = useState<1 | 2>(1);
  const [outcomeIdx, setOutcomeIdx] = useState<number | null>(initialOutcome ?? null);
  const [amount, setAmount] = useState('');
  const [txSig, setTxSig] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [solUsd, setSolUsd] = useState(150);
  useEffect(() => { getSolUsd().then(setSolUsd).catch(() => {}); }, []);

  const max = bet.max_participants ?? 5;
  const taken = bet.bet_count ?? 0;
  const isFull = taken >= max;
  const outcomes = bet.outcomes?.length ? bet.outcomes : [bet.yes_label || 'Yes', bet.no_label || 'No'];
  const pools = (bet.outcome_pools?.length ? bet.outcome_pools : [bet.yes_pool || 0, bet.no_pool || 0]).map(Number);
  const totalPool = pools.reduce((s, p) => s + p, 0);
  const amt = parseFloat(amount) || 0;
  const usd = amt * solUsd;
  const feeUsd = amt > 0 ? feeUsdForUsd(usd) : 0;
  const feeSol = solUsd > 0 ? feeUsd / solUsd : 0;
  const netSol = Math.max(0, amt - feeSol);

  const estPayout = () => {
    if (outcomeIdx === null || netSol <= 0) return 0;
    return quotePayout(netSol * LAMPORTS, outcomeIdx, pools, outcomeIdx);
  };

  const shareX = () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/app/bet/${bet.id}` : '';
    const pick = outcomeIdx != null ? outcomes[outcomeIdx] : '';
    const text = `I just backed "${pick}" on: ${bet.title || bet.description} 🎲 on @solnobet`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
  };
  const copyTreasury = () => {
    navigator.clipboard.writeText(TREASURY);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const goToDeposit = () => {
    setError('');
    if (!publicKey) return setError('Connect your wallet first');
    if (outcomeIdx === null) return setError('Choose an outcome');
    if (amt <= 0) return setError('Enter an amount greater than 0');
    if (!TREASURY) return setError('Treasury wallet is not configured yet.');
    setStep(2);
  };

  const confirmDeposit = async () => {
    setError('');
    if (!txSig.trim()) return setError('Paste the transaction signature from your wallet');
    setLoading(true);
    try {
      const res = await fetch('/api/bets/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          betId: bet.id,
          outcomeIndex: outcomeIdx,
          walletAddress: publicKey!.toBase58(),
          txSignature: txSig.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not verify your deposit');
      setSuccess(true);
      setTimeout(() => { onSuccess?.(); onClose(); }, 1800);
    } catch (e: any) {
      setError(e.message || 'Failed to place bet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up my-auto">
        <div className="sticky top-0 bg-card flex items-start justify-between p-5 border-b border-white/8 z-10">
          <div className="flex-1 pr-3">
            <span className="text-xs font-semibold text-cyan uppercase tracking-widest">{bet.category}</span>
            <h2 className="text-white font-bold mt-1 text-sm leading-snug">{bet.title || bet.description}</h2>
            <CountdownTimer expiry={bet.expiry} size="sm" className="mt-1" />
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs">
            <span className={clsx('px-2 py-1 rounded-full font-bold', step === 1 ? 'bg-cyan text-black' : 'bg-white/10 text-gray-400')}>1. Pick</span>
            <div className="flex-1 h-px bg-white/10" />
            <span className={clsx('px-2 py-1 rounded-full font-bold', step === 2 ? 'bg-cyan text-black' : 'bg-white/10 text-gray-400')}>2. Deposit</span>
          </div>

          {step === 1 && (
            <>
              <div className="bg-white/3 rounded-xl p-4">
                <div className="flex justify-between text-xs text-gray-500 mb-3">
                  <span>{taken}/{max} participants</span>
                  <span>Total pool: ◎ {fmt(totalPool)}</span>
                </div>
                <OutcomeBar outcomes={outcomes} pools={pools} winningIndex={bet.winning_outcome_index} size="sm" />
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Choose your prediction</p>
                <div className="space-y-2">
                  {outcomes.map((o, i) => {
                    const pct = totalPool > 0 ? (pools[i] / totalPool * 100) : (100 / outcomes.length);
                    const c = OUTCOME_COLORS[i % OUTCOME_COLORS.length];
                    return (
                      <button key={i} onClick={() => setOutcomeIdx(i)}
                        className={clsx('w-full flex items-center justify-between rounded-xl border p-3.5 text-left transition-all',
                          outcomeIdx === i ? [c.bg, c.border, 'ring-1 ring-offset-0'].join(' ') : 'bg-white/3 border-white/8 hover:border-white/20')}>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.bar }} />
                          <span className="font-semibold text-sm text-white">{o}</span>
                        </div>
                        <div className="text-right">
                          <span className={['text-sm font-bold', c.text].join(' ')}>{pct.toFixed(1)}%</span>
                          <p className="text-xs text-gray-600">◎ {fmt(pools[i])}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Amount (SOL) — bet any amount</p>
                <div className="flex gap-2">
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" step="0.01"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-cyan/40 text-sm" />
                  {['0.1', '0.5', '1', '5'].map(v => (
                    <button key={v} onClick={() => setAmount(v)} className="px-2.5 py-1 text-xs bg-white/5 hover:bg-cyan/10 hover:text-cyan rounded-lg text-gray-500 transition-all">{v}</button>
                  ))}
                </div>
              </div>

              {amt > 0 && outcomeIdx !== null && (
                <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-400"><span className="flex items-center gap-1"><Info size={10} /> Platform fee (${feeUsd})</span><span className="text-loss">- ◎ {feeSol.toFixed(4)}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Into the pool</span><span className="text-white">◎ {netSol.toFixed(4)}</span></div>
                  <div className="flex justify-between border-t border-white/8 pt-2"><span className="text-gray-500">Est. payout if you win</span><span className="text-cyan font-bold">◎ {fmt(estPayout())}</span></div>
                  <div className="flex justify-between"><span className="flex items-center gap-1 text-gray-500"><Info size={10} /> If nobody wins, you get back</span><span className="text-win">◎ {(netSol * 0.65).toFixed(4)}</span></div>
                  <p className="text-gray-600 leading-relaxed pt-1">Tiered fee by bet size (≈ ${'{'}solUsd.toFixed(0){'}'}/SOL). Payout is parimutuel: your net stake back plus a pro-rata share of the losing pool.</p>
                </div>
              )}

              {error && <div className="flex items-center gap-2 text-loss text-xs"><AlertCircle size={12} /> {error}</div>}
              {isFull && <div className="flex items-center gap-2 text-loss text-xs bg-loss/10 border border-loss/20 rounded-lg p-3"><span>🔒 This bet is full ({taken}/{max}). No more bets accepted.</span></div>}

              {!publicKey ? (
                <p className="text-center text-xs text-gray-600 py-2">Connect wallet to place bets</p>
              ) : (
                <button onClick={goToDeposit} disabled={isFull || outcomeIdx === null}
                  className="w-full py-4 bg-sol-gradient text-black font-black rounded-xl neon-cyan hover:opacity-90 transition-all disabled:opacity-40 disabled:neon-none text-sm flex items-center justify-center gap-2">
                  Continue to deposit <ArrowRight size={16} />
                </button>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="bg-cyan/5 border border-cyan/20 rounded-xl p-4 space-y-3">
                <p className="text-sm text-white font-bold flex items-center gap-2"><Wallet size={15} className="text-cyan" /> Send your stake to the treasury</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Send <span className="text-white font-bold">◎ {amt.toFixed(3)} SOL</span> (includes ${feeUsd} fee) on{' '}
                  <span className="text-white font-semibold">{outcomes[outcomeIdx!]}</span> from your connected wallet to the address below, then paste the transaction signature.
                </p>
                <div className="bg-black/40 rounded-lg p-3 flex items-center gap-2">
                  <span className="font-mono text-xs text-white break-all flex-1">{TREASURY || 'Treasury not configured'}</span>
                  <button onClick={copyTreasury} disabled={!TREASURY} className="shrink-0 text-gray-400 hover:text-cyan transition-colors">
                    {copied ? <CheckCircle size={15} className="text-win" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Transaction signature</p>
                <input value={txSig} onChange={e => setTxSig(e.target.value)} placeholder="Paste your tx signature here"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-xs focus:outline-none focus:border-cyan/40" />
                <p className="text-xs text-gray-600 mt-2">We verify on-chain that your SOL reached the treasury before the bet is recorded. No deposit, no bet.</p>
              </div>

              {error && <div className="flex items-center gap-2 text-loss text-xs"><AlertCircle size={12} /> {error}</div>}
              {success && (
                <div className="text-center space-y-3">
                  <p className="text-win text-sm font-bold">🎉 Deposit verified — bet placed!</p>
                  <button onClick={shareX} className="btn-primary w-full !bg-black !text-white" style={{backgroundImage:'none'}}>𝕏  Share your bet</button>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => { setStep(1); setError(''); }} disabled={loading || success}
                  className="px-4 py-3.5 rounded-xl text-sm font-bold bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-40">Back</button>
                <button onClick={confirmDeposit} disabled={loading || success || !txSig.trim()}
                  className="flex-1 py-3.5 bg-sol-gradient text-black font-black rounded-xl neon-cyan hover:opacity-90 transition-all disabled:opacity-40 disabled:neon-none text-sm">
                  {success ? '✓ Placed!' : loading ? 'Verifying deposit…' : 'I sent it — verify & place bet'}
                </button>
              </div>
            </>
          )}

          <p className="text-center text-xs text-gray-700">⚠️ Bet responsibly. 18+ only. If a market resolves with no winners, you get 65% of your stake back.</p>
        </div>
      </div>
    </div>
  );
}
