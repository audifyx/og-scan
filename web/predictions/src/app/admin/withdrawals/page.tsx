"use client";
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowUpFromLine, RefreshCw, CheckCircle2, XCircle, Copy } from 'lucide-react';

const LAMPORTS = 1_000_000_000;
const sol = (l: number) => (Number(l) / LAMPORTS).toFixed(4);

export default function AdminWithdrawals() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauth, setUnauth] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/withdrawals', { cache: 'no-store' });
    if (r.status === 401) { setUnauth(true); setLoading(false); return; }
    const d = await r.json();
    if (d.ok) setRows(d.withdrawals);
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
  const processed = rows.filter(r => r.status !== 'pending');

  if (unauth) return (
    <div className="min-h-screen flex items-center justify-center text-center">
      <div><p className="text-gray-400 mb-3">Admin authentication required.</p><Link href="/admin" className="text-cyan underline">Go to admin login</Link></div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black gradient-text flex items-center gap-2"><ArrowUpFromLine size={22} /> Withdrawals</h1>
        <div className="flex gap-2">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-white px-3 py-2">&larr; Admin</Link>
          <button onClick={load} className="flex items-center gap-1.5 text-sm bg-white/5 hover:bg-white/10 rounded-xl px-3 py-2 text-gray-300"><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-gray-500 font-bold">Pending ({pending.length})</h2>
        {loading ? <p className="text-gray-600 text-sm">Loading...</p> : pending.length === 0 ? <p className="text-gray-600 text-sm">No pending withdrawals.</p> : pending.map(r => (
          <div key={r.id} className="bg-card border border-white/8 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-white">&#9678; {sol(r.lamports)}</p>
              <p className="text-xs text-gray-500 font-mono truncate flex items-center gap-1">{r.wallet}<button onClick={() => navigator.clipboard.writeText(r.wallet)}><Copy size={11} className="text-gray-600 hover:text-cyan" /></button></p>
              <p className="text-[11px] text-gray-600">{new Date(r.created_at).toLocaleString()}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => act(r.id, 'paid')} disabled={busy === r.id} className="flex items-center gap-1 bg-win/20 text-win rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50"><CheckCircle2 size={14} /> Paid</button>
              <button onClick={() => act(r.id, 'rejected')} disabled={busy === r.id} className="flex items-center gap-1 bg-loss/20 text-loss rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50"><XCircle size={14} /> Reject</button>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-gray-500 font-bold">Processed ({processed.length})</h2>
        {processed.map(r => (
          <div key={r.id} className="bg-card/50 border border-white/5 rounded-xl p-3 flex items-center justify-between text-sm">
            <span className="text-gray-400">&#9678; {sol(r.lamports)} &rarr; <span className="font-mono text-xs">{r.wallet.slice(0, 6)}...{r.wallet.slice(-6)}</span></span>
            <span className={r.status === 'paid' ? 'text-win' : 'text-loss'}>{r.status}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-600">Send SOL from the treasury to the wallet, then mark Paid. The user is notified automatically. Rejecting refunds their balance.</p>
    </div>
  );
}
