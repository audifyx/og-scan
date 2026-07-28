'use client';
import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Copy, RefreshCw, ArrowUpFromLine } from 'lucide-react';

const L = 1_000_000_000;
const sol = (l: number) => (Number(l) / L).toFixed(4);
const short = (w?: string) => (w ? w.slice(0, 6) + '…' + w.slice(-6) : '—');

export function WithdrawalsQueue() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/withdrawals', { cache: 'no-store' });
    const d = await r.json();
    if (d.ok) setRows(d.withdrawals || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: 'paid' | 'rejected') => {
    let payoutTx: string | undefined;
    if (action === 'paid') payoutTx = prompt('Payout transaction signature (optional):') || undefined;
    else if (!confirm('Reject this withdrawal and refund the balance?')) return;
    setBusy(id);
    const r = await fetch('/api/admin/withdrawals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, payoutTx }) });
    const d = await r.json();
    setBusy(null);
    if (!d.ok) alert(d.error || 'Failed'); else load();
  };

  const pending = rows.filter(r => r.status === 'pending');
  const processed = rows.filter(r => r.status !== 'pending').slice(0, 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2"><ArrowUpFromLine size={16} className="text-cyan" /> Withdrawal requests <span className="text-xs text-gray-500">({pending.length} pending)</span></h3>
        <button onClick={load} className="flex items-center gap-1.5 text-xs bg-white/5 hover:bg-white/10 rounded-lg px-3 py-1.5 text-gray-300"><RefreshCw size={13} /> Refresh</button>
      </div>

      {loading ? <p className="text-gray-600 text-sm">Loading…</p> : pending.length === 0 ? (
        <p className="text-gray-600 text-sm glass-card rounded-xl p-4">No pending withdrawals.</p>
      ) : pending.map(r => (
        <div key={r.id} className="glass-card rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-white">◎ {sol(r.lamports)} SOL</p>
            <p className="text-xs text-gray-500 font-mono truncate flex items-center gap-1">{r.wallet}<button onClick={() => navigator.clipboard.writeText(r.wallet)}><Copy size={11} className="text-gray-600 hover:text-cyan" /></button></p>
            <p className="text-[11px] text-gray-600">{new Date(r.created_at).toLocaleString()}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => act(r.id, 'paid')} disabled={busy === r.id} className="flex items-center gap-1 bg-win/20 text-win rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50"><CheckCircle2 size={14} /> Paid</button>
            <button onClick={() => act(r.id, 'rejected')} disabled={busy === r.id} className="flex items-center gap-1 bg-loss/20 text-loss rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50"><XCircle size={14} /> Reject</button>
          </div>
        </div>
      ))}

      {processed.length > 0 && (
        <div className="space-y-1.5 pt-2">
          <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">Processed</p>
          {processed.map(r => (
            <div key={r.id} className="bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 flex items-center justify-between text-sm">
              <span className="text-gray-400">◎ {sol(r.lamports)} → <span className="font-mono text-xs">{short(r.wallet)}</span></span>
              <span className={r.status === 'paid' ? 'text-win' : 'text-loss'}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
