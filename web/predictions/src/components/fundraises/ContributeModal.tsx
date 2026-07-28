'use client';
import { useState } from 'react';
import { X, Loader2, Copy, CheckCircle, Wallet } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';

const field = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan/50';

export function ContributeModal({ campaign, onClose, onDone }: { campaign: any; onClose: () => void; onDone: () => void }) {
  const { publicKey } = useWallet();
  const [txSig, setTxSig] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const copy = () => { navigator.clipboard.writeText(campaign.recipient_wallet); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const contribute = async () => {
    setError('');
    if (!txSig.trim()) return setError('Paste the transaction signature.');
    if (!publicKey) return setError('Connect your wallet first.');
    setBusy(true);
    try {
      const r = await fetch('/api/fundraises/contribute', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id, walletAddress: publicKey.toBase58(), txSignature: txSig.trim() }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Could not verify your contribution.');
      onDone();
    } catch (e: any) { setError(e.message || 'Failed.'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-white/10 rounded-2xl w-full max-w-md my-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h2 className="font-bold text-white">Contribute</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <p className="text-sm text-white font-bold flex items-center gap-2"><Wallet size={15} className="text-cyan" /> Send SOL to the campaign wallet</p>
            <p className="text-xs text-gray-400 mt-1.5">Send any amount of SOL to the address below from your connected wallet, then paste the transaction signature. Funds go directly to the creator.</p>
            <div className="mt-2 flex items-center gap-2 bg-black/30 rounded-lg p-2.5">
              <span className="font-mono text-xs text-white break-all flex-1">{campaign.recipient_wallet}</span>
              <button onClick={copy} className="shrink-0 text-gray-400 hover:text-cyan">{copied ? <CheckCircle size={15} className="text-win" /> : <Copy size={15} />}</button>
            </div>
          </div>
          <div><p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Transaction signature</p>
            <input value={txSig} onChange={e => setTxSig(e.target.value)} placeholder="Paste your tx signature" className={field + ' font-mono'} /></div>
          {error && <p className="text-sm text-loss">{error}</p>}
          <button onClick={contribute} disabled={busy || !txSig.trim()} className="w-full bg-gradient-to-r from-cyan to-purple text-black font-black py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">{busy ? <><Loader2 size={18} className="animate-spin" /> Verifying…</> : 'Verify contribution'}</button>
        </div>
      </div>
    </div>
  );
}
