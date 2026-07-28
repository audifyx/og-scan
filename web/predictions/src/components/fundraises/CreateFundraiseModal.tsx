'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, Copy, CheckCircle, Wallet, ArrowRight, HeartHandshake } from 'lucide-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSolPrice } from '@/hooks/useSolPrice';
import clsx from 'clsx';

const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET || '';
const FEE_USD = 25;
const field = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan/50';

export function CreateFundraiseModal({ onClose }: { onClose: () => void }) {
  const { publicKey } = useWallet();
  const router = useRouter();
  const price = useSolPrice();
  const feeSol = FEE_USD / (price || 150);
  const [step, setStep] = useState<1 | 2>(1);
  const [f, setF] = useState({ title: '', description: '', target: '1', deadline: '', recipientWallet: '', imageUrl: '', link: '' });
  const [txSig, setTxSig] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setF(s => ({ ...s, [k]: v }));

  const goPay = () => {
    setError('');
    if (!f.title.trim()) return setError('Add a title.');
    if (!f.recipientWallet.trim()) return setError('Add the wallet funds should be raised to.');
    if (!publicKey) return setError('Connect your wallet first.');
    if (!TREASURY) return setError('Treasury wallet is not configured.');
    setStep(2);
  };
  const copyTreasury = () => { if (!TREASURY) return; navigator.clipboard.writeText(TREASURY); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const create = async () => {
    setError('');
    if (!txSig.trim()) return setError('Paste the fee transaction signature.');
    if (!publicKey) return setError('Connect your wallet first.');
    setBusy(true);
    try {
      const r = await fetch('/api/fundraises', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: f.title.trim(), description: f.description.trim(),
          targetLamports: Math.round((parseFloat(f.target) || 0) * LAMPORTS_PER_SOL),
          deadline: f.deadline ? new Date(f.deadline).toISOString() : null,
          recipientWallet: f.recipientWallet.trim(), imageUrl: f.imageUrl.trim() || null, link: f.link.trim() || null,
          wallet: publicKey.toBase58(), txSignature: txSig.trim(),
        }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Failed to create campaign.');
      onClose();
      router.push(`/app/fundraises/${d.id}`);
    } catch (e: any) { setError(e.message || 'Failed.'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-white/10 rounded-2xl w-full max-w-md my-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h2 className="font-bold text-white flex items-center gap-2"><HeartHandshake size={18} className="text-cyan" /> Start a fundraise</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
        </div>
        <div className="flex items-center gap-2 px-5 pt-4 text-[11px]">
          <span className={clsx('px-2 py-1 rounded-full font-bold', step === 1 ? 'bg-cyan text-black' : 'bg-white/10 text-gray-400')}>1. Details</span>
          <ArrowRight size={11} className="text-gray-600" />
          <span className={clsx('px-2 py-1 rounded-full font-bold', step === 2 ? 'bg-cyan text-black' : 'bg-white/10 text-gray-400')}>2. Pay $25 fee</span>
        </div>

        {step === 1 ? (
          <div className="p-5 space-y-3">
            <input value={f.title} onChange={e => set('title', e.target.value)} placeholder="Campaign title" className={field} />
            <textarea value={f.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="What are you raising for?" className={clsx(field, 'resize-none')} />
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-[11px] text-gray-500 mb-1">Target (SOL) — goal</p><input type="number" value={f.target} onChange={e => set('target', e.target.value)} className={field} /></div>
              <div><p className="text-[11px] text-gray-500 mb-1">Deadline</p><input type="datetime-local" value={f.deadline} onChange={e => set('deadline', e.target.value)} className={field} /></div>
            </div>
            <div><p className="text-[11px] text-gray-500 mb-1">Recipient wallet (funds raise to this address)</p><input value={f.recipientWallet} onChange={e => set('recipientWallet', e.target.value)} placeholder="Your Solana wallet address" className={clsx(field, 'font-mono text-xs')} /></div>
            <input value={f.imageUrl} onChange={e => set('imageUrl', e.target.value)} placeholder="Image URL (optional)" className={field} />
            <input value={f.link} onChange={e => set('link', e.target.value)} placeholder="Link (optional)" className={field} />
            <div className="bg-cyan/5 border border-cyan/15 rounded-xl p-3 text-xs text-gray-400">Contributions go <b className="text-white">directly to your recipient wallet</b>, verified on-chain. A <b className="text-white">${FEE_USD}</b> creation fee (≈ ◎ {feeSol.toFixed(4)}) goes to the treasury. Admin reviews campaigns for transparency.</div>
            {error && <p className="text-sm text-loss">{error}</p>}
            <button onClick={goPay} disabled={!publicKey} className="w-full bg-gradient-to-r from-cyan to-purple text-black font-black py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">Continue to pay ${FEE_USD} <ArrowRight size={16} /></button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-sm text-white font-bold flex items-center gap-2"><Wallet size={15} className="text-cyan" /> Pay the ${FEE_USD} creation fee</p>
              <p className="text-xs text-gray-400 mt-1.5">Send <span className="text-white font-semibold">◎ {feeSol.toFixed(4)} SOL</span> (≈ ${FEE_USD}) to the treasury, then paste the transaction signature.</p>
              <div className="mt-2 flex items-center gap-2 bg-black/30 rounded-lg p-2.5">
                <span className="font-mono text-xs text-white break-all flex-1">{TREASURY || 'Treasury not configured'}</span>
                <button onClick={copyTreasury} disabled={!TREASURY} className="shrink-0 text-gray-400 hover:text-cyan">{copied ? <CheckCircle size={15} className="text-win" /> : <Copy size={15} />}</button>
              </div>
            </div>
            <div><p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Fee transaction signature</p>
              <input value={txSig} onChange={e => setTxSig(e.target.value)} placeholder="Paste your tx signature" className={clsx(field, 'font-mono')} /></div>
            {error && <p className="text-sm text-loss">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setStep(1); setError(''); }} disabled={busy} className="px-4 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl py-3.5 disabled:opacity-50">Back</button>
              <button onClick={create} disabled={busy || !txSig.trim()} className="flex-1 bg-gradient-to-r from-cyan to-purple text-black font-black py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">{busy ? <><Loader2 size={18} className="animate-spin" /> Verifying…</> : 'Pay fee & launch'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
