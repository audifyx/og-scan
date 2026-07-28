'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Copy, CheckCircle, Clock, ExternalLink, Wallet, AlertCircle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useSolPrice, usdFromLamports } from '@/hooks/useSolPrice';

const LAMPORTS = 1_000_000_000;
const fmt = (l: number) => (l / LAMPORTS).toFixed(4);

interface Winner {
  id: string;
  bet_id: string;
  user_wallet: string;
  amount: number;
  payout: number;
  fee_paid: number;
  status: string;
  claimed: boolean;
  bet_title: string;
  outcome_label: string;
  payout_wallet: string;
}

interface Props { betId?: string; }

export function PayoutQueue({ betId }: Props) {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [txInput, setTxInput] = useState<Record<string, string>>({});
  const solPrice = useSolPrice();

  const load = async () => {
    setLoading(true);
    let q = (supabase as any)
      .from('user_bets')
      .select('*, bets(title, outcomes, winning_outcome_index, outcome_pools, total_pool)')
      .eq('status', 'won')
      .eq('claimed', false)
      .order('created_at', { ascending: false });
    if (betId) q = q.eq('bet_id', betId);
    const { data } = await q;
    if (data) {
      const ids = Array.from(new Set(data.map((u: any) => u.user_id).filter(Boolean)));
      const walletMap: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await (supabase as any).from('profiles').select('user_id, wallet').in('user_id', ids);
        (profs || []).forEach((p: any) => { if (p.wallet) walletMap[p.user_id] = p.wallet; });
      }
      const enriched = data.map((ub: any) => {
        const bet = ub.bets || {};
        const winIdx = bet.winning_outcome_index ?? 0;
        const outcomes = bet.outcomes || ['Yes', 'No'];
        const pools = (bet.outcome_pools || [0, 0]).map(Number);
        const totalPool = bet.total_pool || 0;
        const winningPool = pools[winIdx] || 1;
        const payout = ub.payout != null ? Number(ub.payout) : Math.floor((ub.amount / winningPool) * totalPool);
        return { ...ub, bet_title: bet.title || 'Unnamed bet', outcome_label: outcomes[winIdx] || '?', payout, payout_wallet: walletMap[ub.user_id] || ub.user_wallet };
      });
      setWinners(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [betId]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const markPaid = async (id: string, opts: { force?: boolean } = {}) => {
    const claimTx = (txInput[id] || '').trim();
    setMarking(id);
    try {
      const res = await fetch('/api/admin/payout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userBetId: id, claimTx: claimTx || undefined, force: opts.force }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        if (d.verifiable === false && !opts.force) {
          if (confirm((d.error || 'Could not verify this payout on-chain.') + '\n\nRecord it anyway as UNVERIFIED?')) {
            setMarking(null);
            return markPaid(id, { force: true });
          }
        } else {
          alert(d.error || 'Failed to mark paid');
        }
      } else if (claimTx && !d.payoutVerified) {
        alert('Marked paid (recorded as unverified).');
      }
    } catch { alert('Failed to mark paid'); }
    setMarking(null);
    load();
  };

  const totalOwed = winners.reduce((s, w) => s + w.payout, 0);

  const buildCopyText = () => {
    return winners.map((w) => w.payout_wallet + ' | USDC ' + usdFromLamports(w.payout, solPrice).replace('$','')).join('\n');
  };

  if (loading) return <div className="glass-card rounded-2xl p-6 shimmer h-32" />;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-white/8">
        <div>
          <h2 className="font-bold text-white flex items-center gap-2">
            <Wallet size={16} className="text-cyan" />
            Payout Queue
            {winners.length > 0 && (
              <span className="ml-1 bg-loss text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {winners.length} pending
              </span>
            )}
          </h2>
          {winners.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              Total owed: <span className="text-loss font-bold">SOL {fmt(totalOwed)}</span>
            </p>
          )}
        </div>
        <button onClick={load} className="text-gray-500 hover:text-white p-2 transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {winners.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <CheckCircle size={32} className="mx-auto mb-3 text-win opacity-40" />
          <p className="font-medium text-gray-500">All caught up</p>
          <p className="text-xs mt-1">No pending payouts</p>
        </div>
      ) : (
        <>
          <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-5 py-3 flex items-start gap-3">
            <AlertCircle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-300 leading-relaxed">
              <strong>Manual payout mode.</strong> Pay each winner in <strong>USDC</strong> to their payout wallet below (amount shown in USDC), then click &quot;Mark Paid&quot;. Double-check every address.
            </p>
          </div>

          <div className="divide-y divide-white/5">
            {winners.map((w) => (
              <div key={w.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-xs text-gray-500 truncate">{w.bet_title}</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-white truncate" title={w.payout_wallet}>{w.payout_wallet}</span>
                    <button onClick={() => copy(w.payout_wallet)} className="shrink-0 text-gray-600 hover:text-cyan transition-colors">
                      {copied === w.payout_wallet ? <CheckCircle size={13} className="text-win" /> : <Copy size={13} />}
                    </button>
                    <a href={'https://solscan.io/account/' + w.payout_wallet} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 text-gray-600 hover:text-cyan transition-colors">
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>Staked: {fmt(w.amount)} SOL</span>
                    <span>Picked: <span className="text-win font-semibold">{w.outcome_label}</span></span>
                  </div>
                </div>
                <div className="flex flex-col sm:items-end gap-2 shrink-0 w-full sm:w-auto">
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-black text-win">{usdFromLamports(w.payout, solPrice)}</p>
                      <p className="text-xs text-gray-600">in USDC · ◎{fmt(w.payout)}</p>
                    </div>
                    <button onClick={() => markPaid(w.id)} disabled={marking === w.id}
                      className={clsx('px-4 py-2.5 rounded-xl text-xs font-bold transition-all',
                        marking === w.id
                          ? 'bg-white/10 text-gray-500 cursor-wait'
                          : 'bg-win/20 text-win border border-win/30 hover:bg-win hover:text-black')}>
                      {marking === w.id ? <Clock size={13} className="animate-spin" /> : 'Mark Paid'}
                    </button>
                  </div>
                  <input
                    value={txInput[w.id] || ''}
                    onChange={(e) => setTxInput((m) => ({ ...m, [w.id]: e.target.value }))}
                    placeholder="Paste payout tx signature to verify on-chain"
                    className="input-field !py-1.5 !text-xs w-full sm:w-72 font-mono" />
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-white/8">
            <button onClick={() => copy(buildCopyText())}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-white/10 rounded-xl text-xs text-gray-400 hover:text-white hover:border-white/20 transition-all">
              <Copy size={12} />
              Copy all wallets + amounts
            </button>
          </div>
        </>
      )}
    </div>
  );
}
