'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, AlertTriangle, ExternalLink, Wallet, Coins, Users, TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { PayoutProof } from '@/components/PayoutProof';

const fmtSol = (n: number) => `◎ ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
const fmtUsd = (n: number) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const short = (w?: string | null) => (w ? w.slice(0, 6) + '…' + w.slice(-6) : '—');

export default function TreasuryPage() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/treasury/public', { cache: 'no-store' });
      setD(await r.json());
    } catch { setD({ ok: false, error: 'Failed to load' }); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const ratio = d?.reserveRatio;
  const ratioPct = ratio == null ? null : Math.round(ratio * 100);

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-16">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8"><ArrowLeft size={14} /> Back home</Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-extrabold mb-3 flex items-center gap-3">
            <ShieldCheck className="text-win" size={32} /> Treasury <span className="gradient-text">Proof of Reserves</span>
          </h1>
          <p className="text-slate-300 mb-2 leading-relaxed max-w-2xl">
            OrbitX runs on a manual-treasury model: every wager is a real SOL deposit, and every payout comes from this wallet.
            This page reads the live on-chain balance and compares it to what is owed to active bettors. No accounts, no hidden books.
          </p>
        </div>
        <button onClick={load} className="btn-ghost !py-2 !px-3 text-sm inline-flex items-center gap-1.5 shrink-0">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 py-24 justify-center"><Loader2 className="animate-spin" /> Loading on-chain data…</div>
      ) : !d?.ok ? (
        <div className="glass-card rounded-2xl p-6 mt-8 text-loss flex items-center gap-2"><AlertTriangle size={16} /> {d?.error || 'Unavailable'}</div>
      ) : (
        <div className="mt-8 space-y-6">
          {/* Solvency banner */}
          <div className={`glass-card rounded-2xl p-6 border ${d.solvent ? 'border-win/30' : 'border-loss/40'}`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                {d.solvent ? <ShieldCheck className="text-win" size={28} /> : <AlertTriangle className="text-loss" size={28} />}
                <div>
                  <p className="font-black text-lg text-white">{d.solvent ? 'Fully backed' : 'Attention needed'}</p>
                  <p className="text-sm text-slate-400">
                    {ratioPct == null ? 'No open liabilities right now.' : `Treasury holds ${ratioPct}% of all funds owed to open positions.`}
                  </p>
                </div>
              </div>
              {ratioPct != null && (
                <div className="text-right">
                  <p className={`text-3xl font-black ${d.solvent ? 'text-win' : 'text-loss'}`}>{ratioPct}%</p>
                  <p className="text-[11px] text-slate-500">reserve ratio</p>
                </div>
              )}
            </div>
            {ratioPct != null && (
              <div className="mt-4 h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full ${d.solvent ? 'bg-win' : 'bg-loss'}`} style={{ width: `${Math.min(100, ratioPct)}%` }} />
              </div>
            )}
          </div>

          {/* Treasury wallet */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2"><Wallet size={13} /> Treasury wallet</div>
            {d.treasury ? (
              <a href={`https://solscan.io/account/${d.treasury}`} target="_blank" rel="noopener noreferrer"
                className="font-mono text-sm text-cyan hover:underline inline-flex items-center gap-1.5 break-all">
                {short(d.treasury)} <ExternalLink size={12} />
              </a>
            ) : <p className="text-slate-500 text-sm">Not configured</p>}
            {d.onchainError && <p className="text-xs text-gold mt-2 flex items-center gap-1.5"><AlertTriangle size={12} /> {d.onchainError}</p>}
          </div>

          {/* Core metrics */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Metric icon={Coins} label="On-chain balance" sol={d.balance.sol} usd={d.balance.usd} c="text-cyan" />
            <Metric icon={TrendingUp} label="Owed to open bets" sol={d.liabilities.sol} usd={d.liabilities.usd} c="text-gold" />
            <Metric icon={ShieldCheck} label="Surplus over liabilities" sol={d.surplus.sol} usd={d.surplus.usd} c={d.surplus.sol >= 0 ? 'text-win' : 'text-loss'} />
          </div>

          {/* Lifetime */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Metric icon={Coins} label="Lifetime paid to bettors" sol={d.lifetime.paidOut.sol} usd={d.lifetime.paidOut.usd} c="text-win" />
            <Metric icon={Coins} label="Lifetime platform fees" sol={d.lifetime.feesCollected.sol} usd={d.lifetime.feesCollected.usd} c="text-purple" />
          </div>

          {/* Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Count label="Total markets" value={d.counts.totalMarkets} />
            <Count label="Open markets" value={d.counts.openMarkets} />
            <Count label="Resolved" value={d.counts.resolvedMarkets} />
            <Count label="Total wagers" value={d.counts.totalWagers} />
          </div>

          <RecentPayouts />

          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Users size={12} /> SOL/USD ≈ {fmtUsd(d.solUsd)} · snapshot {new Date(d.at).toLocaleString()} · balance read directly from Solana.
          </p>
        </div>
      )}
    </div>
  );
}

const ago = (d: string) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

function RecentPayouts() {
  const [rows, setRows] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/payouts/recent', { cache: 'no-store' });
        const j = await r.json();
        setRows(j?.payouts || []);
      } catch {}
      setLoaded(true);
    })();
  }, []);
  if (!loaded || rows.length === 0) return null;
  return (
    <div className="glass-card rounded-2xl p-6">
      <h2 className="flex items-center gap-2 font-bold text-white mb-4"><ShieldCheck size={16} className="text-win" /> Recent payouts</h2>
      <div className="divide-y divide-white/5">
        {rows.map((p) => (
          <div key={p.id} className="flex items-center gap-3 py-2.5">
            <span className="text-sm text-slate-300 flex-1 truncate">{p.market}</span>
            <a href={`https://solscan.io/account/${p.wallet}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-slate-500 hover:text-cyan shrink-0">{short(p.wallet)}</a>
            <span className="text-win font-bold text-sm shrink-0">◎ {Number(p.payoutSol).toFixed(3)}</span>
            <span className="text-[11px] text-slate-600 w-16 text-right shrink-0">{ago(p.at)}</span>
            <PayoutProof claimTx={p.tx} verified={p.verified} size="xs" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, sol, usd, c }: any) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2"><Icon size={13} className={c} /> {label}</div>
      <p className={`text-2xl font-black ${c}`}>{fmtSol(sol)}</p>
      <p className="text-xs text-slate-500 mt-0.5">{fmtUsd(usd)}</p>
    </div>
  );
}
function Count({ label, value }: any) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-center">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
