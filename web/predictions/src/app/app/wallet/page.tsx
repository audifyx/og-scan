"use client";
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback } from 'react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { Wallet, ArrowUpFromLine, TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, Info, X, Loader2, Swords } from 'lucide-react';
import Link from 'next/link';
import { useGameWallet } from '@/hooks/useGameWallet';
import clsx from 'clsx';

const sol = (l: number) => (Number(l) / LAMPORTS_PER_SOL).toFixed(4);
const MIN_WITHDRAW = 0.01;
const STATUS_STYLE: Record<string, string> = { pending: 'text-yellow-400 bg-yellow-500/10', paid: 'text-win bg-win/10', rejected: 'text-loss bg-loss/10' };

export default function WalletPage() {
  const wg = useGameWallet();
  const { publicKey } = useWallet();
  const [data, setData] = useState<any>(null);
  const [show, setShow] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/games/wallet', { cache: 'no-store' });
    if (r.ok) { const d = await r.json(); if (d.ok) setData(d); }
  }, []);
  useEffect(() => { load(); }, [load, wg.balance]);

  const s = data?.stats;
  const net = s?.netProfit ?? 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple to-cyan flex items-center justify-center"><Wallet size={22} className="text-black" /></div>
        <div><h1 className="text-2xl font-black text-white">My Wallet</h1><p className="text-sm text-gray-500">Your winnings balance and stats.</p></div>
      </div>

      {!wg.authed ? (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-300">Sign in to view your balance.</div>
      ) : (
        <>
          <div className="bg-card border border-white/8 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan/10 to-purple/5" />
            <div className="relative">
              <p className="text-xs text-gray-500 uppercase tracking-widest">Withdrawable balance</p>
              <p className="text-4xl font-black text-white mt-1">&#9678; {sol(wg.balance)}</p>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShow(true)} disabled={wg.balance <= 0} className="flex items-center gap-1.5 bg-cyan text-black font-bold rounded-xl px-4 py-2.5 text-sm hover:opacity-90 disabled:opacity-40"><ArrowUpFromLine size={15} /> Request withdrawal</button>
                <Link href="/app/games" className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl px-4 py-2.5 text-sm"><Swords size={15} /> Play games</Link>
              </div>
            </div>
          </div>

          <div className="bg-cyan/5 border border-cyan/15 rounded-2xl p-4 flex gap-3">
            <Info size={18} className="text-cyan shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300 space-y-1">
              <p className="font-semibold text-white">How it works</p>
              <p className="text-gray-400">You stake SOL on-chain to play games. Winnings land in your balance here. When you request a withdrawal, our team verifies it and pays you manually &mdash; we are online almost around the clock. <b className="text-white">Most payouts are sent within 5 hours</b>, always under 24 hours. You will be notified when yours is sent.</p>
            </div>
          </div>

          {s && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Stat label="Net P/L" value={`${net >= 0 ? '+' : ''}\u25ce ${sol(net)}`} accent={net >= 0 ? 'text-win' : 'text-loss'} icon={net >= 0 ? TrendingUp : TrendingDown} />
              <Stat label="Total staked" value={`\u25ce ${sol(s.totalWagered)}`} />
              <Stat label="Total won" value={`\u25ce ${sol(s.totalWon)}`} />
              <Stat label="Withdrawn" value={`\u25ce ${sol(s.totalWithdrawn)}`} />
              <Stat label="Games won" value={String(s.wins)} accent="text-win" />
              <Stat label="Games lost" value={String(s.losses)} accent="text-loss" />
            </div>
          )}

          <div className="bg-card border border-white/8 rounded-2xl p-5">
            <h2 className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-3">Withdrawal history</h2>
            {!data ? <p className="text-gray-600 text-sm">Loading...</p> : data.withdrawals.length === 0 ? <p className="text-gray-600 text-sm">No withdrawals yet.</p> : (
              <div className="space-y-2">
                {data.withdrawals.map((wd: any) => (
                  <div key={wd.id} className="flex items-center justify-between text-sm border-b border-white/5 pb-2 last:border-0">
                    <div><p className="text-white font-bold">&#9678; {sol(wd.lamports)}</p><p className="text-[11px] text-gray-600">{new Date(wd.created_at).toLocaleString()}</p></div>
                    <span className={clsx('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold capitalize', STATUS_STYLE[wd.status])}>
                      {wd.status === 'pending' && <Clock size={11} />}{wd.status === 'paid' && <CheckCircle2 size={11} />}{wd.status === 'rejected' && <XCircle size={11} />}{wd.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {data?.rounds?.length > 0 && (
            <div className="bg-card border border-white/8 rounded-2xl p-5">
              <h2 className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-3">Recent games</h2>
              <div className="space-y-1.5">
                {data.rounds.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-gray-400">{r.game} <span className="text-gray-600">&middot; staked &#9678; {sol(r.wager)}</span></span>
                    <span className={(r.payout - r.wager) >= 0 ? 'text-win font-bold' : 'text-loss'}>{(r.payout - r.wager) >= 0 ? '+' : '-'}\u25ce {sol(Math.abs(r.payout - r.wager))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {show && <WithdrawModal balance={wg.balance} wallet={publicKey?.toBase58()} onClose={() => setShow(false)} onWithdraw={wg.withdraw} onDone={load} />}
    </div>
  );
}

function Stat({ label, value, accent, icon: Icon }: { label: string; value: string; accent?: string; icon?: any }) {
  return (
    <div className="bg-card border border-white/8 rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 flex items-center gap-1">{Icon && <Icon size={11} />} {label}</p>
      <p className={clsx('font-bold mt-1', accent || 'text-white')}>{value}</p>
    </div>
  );
}

function WithdrawModal({ balance, wallet, onClose, onWithdraw, onDone }: { balance: number; wallet?: string; onClose: () => void; onWithdraw: (l: number, w?: string) => Promise<any>; onDone: () => void }) {
  const [amount, setAmount] = useState((balance / LAMPORTS_PER_SOL).toFixed(4));
  const [dest, setDest] = useState(wallet || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const amt = parseFloat(amount) || 0;

  const submit = async () => {
    setError(''); setDone('');
    const lamports = Math.round(amt * LAMPORTS_PER_SOL);
    if (amt < MIN_WITHDRAW) return setError(`Minimum withdrawal is ${MIN_WITHDRAW} SOL.`);
    if (lamports > balance) return setError('Amount exceeds your balance.');
    if (!dest.trim()) return setError('Enter the wallet to receive your SOL.');
    setBusy(true);
    try {
      const r = await onWithdraw(lamports, dest.trim());
      if (!r.ok) throw new Error(r.error || 'Failed.');
      setDone(`Requested \u25ce ${amt} SOL. Most payouts land within 5 hours (always under 24h). You will be notified when it is sent.`);
      onDone();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-white/10 rounded-2xl w-full max-w-md my-auto animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h2 className="font-bold text-white">Request withdrawal</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-white/3 rounded-xl p-3 flex items-center justify-between text-sm"><span className="text-gray-500">Balance</span><span className="font-bold text-white">&#9678; {sol(balance)}</span></div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Amount (SOL)</label>
            <div className="flex gap-2">
              <input type="number" value={amount} step="0.01" onChange={e => setAmount(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-cyan/40" />
              <button onClick={() => setAmount((balance / LAMPORTS_PER_SOL).toString())} className="px-3 text-xs bg-white/5 hover:bg-cyan/10 hover:text-cyan rounded-lg text-gray-500">Max</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Send to wallet</label>
            <input value={dest} onChange={e => setDest(e.target.value)} placeholder="Your Solana wallet address" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-cyan/40" />
          </div>
          <div className="bg-cyan/5 border border-cyan/15 rounded-xl p-3 text-[12px] text-gray-400 leading-snug">Withdrawals are verified and paid manually by our team. We are online almost around the clock &mdash; most are paid within 5 hours, always within 24 hours. You will be notified when yours is sent.</div>
          {error && <p className="text-sm text-loss">{error}</p>}
          {done && <p className="text-sm text-win flex items-center gap-1.5"><CheckCircle2 size={14} /> {done}</p>}
          {!done && <button onClick={submit} disabled={busy} className="w-full bg-gradient-to-r from-cyan to-purple text-black font-black py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">{busy ? <><Loader2 size={18} className="animate-spin" /> Requesting...</> : `Request \u25ce ${amount || 0}`}</button>}
        </div>
      </div>
    </div>
  );
}
