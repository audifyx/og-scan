'use client';
import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, ChevronDown, ExternalLink, Trash2 } from 'lucide-react';

const L = 1_000_000_000;
const sol = (l: number) => (Number(l) / L).toFixed(3);
const short = (w?: string) => (w ? w.slice(0, 6) + '…' + w.slice(-6) : '—');

export function FundraisesQueue() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [contribs, setContribs] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/fundraises', { cache: 'no-store' });
    const d = await r.json();
    if (d.ok) setRows(d.campaigns || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm('Remove this campaign listing? (Spam/abuse only — this does not touch any funds.)')) return;
    setBusy(id);
    const r = await fetch('/api/admin/fundraises', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'delete' }) });
    const d = await r.json(); setBusy(null);
    if (!d.ok) alert(d.error || 'Failed'); else load();
  };

  const toggle = async (id: string) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id); setContribs([]);
    const r = await fetch('/api/admin/fundraises', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'contributions' }) });
    const d = await r.json();
    if (d.ok) setContribs(d.contributions || []);
  };

  const ended = (c: any) => !!c.deadline && Date.now() > new Date(c.deadline).getTime();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white">Fundraise campaigns <span className="text-xs text-gray-500">({rows.length})</span></h3>
        <button onClick={load} className="flex items-center gap-1.5 text-xs bg-white/5 hover:bg-white/10 rounded-lg px-3 py-1.5 text-gray-300"><RefreshCw size={13} /> Refresh</button>
      </div>
      <p className="text-[11px] text-gray-600">Funds are non-custodial — contributions go straight to each creator&apos;s wallet and are final. This is a read-only monitor (plus remove-for-abuse). Platform revenue is the $25 creation fee per campaign.</p>
      {loading ? <p className="text-gray-600 text-sm">Loading…</p> : rows.length === 0 ? <p className="text-gray-600 text-sm glass-card rounded-xl p-4">No campaigns yet.</p> : rows.map(c => (
        <div key={c.id} className="glass-card rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-white truncate">{c.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">by {c.creator_username || short(c.creator_wallet)} · raised <b className="text-white">◎ {sol(c.raised_lamports)}</b> / ◎ {sol(c.target_lamports)} · {c.contribution_count} gifts · fee ◎ {sol(c.creation_fee_lamports)}</p>
              <p className="text-[11px] text-gray-600 mt-0.5 font-mono">funds → {short(c.recipient_wallet)}</p>
            </div>
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${ended(c) ? 'text-gray-300 bg-white/10' : 'text-win bg-win/10'}`}>{ended(c) ? 'ended' : 'active'}</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => toggle(c.id)} className="flex items-center gap-1 bg-white/5 text-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold"><ChevronDown size={13} className={open === c.id ? 'rotate-180' : ''} /> Contributions</button>
            <button onClick={() => remove(c.id)} disabled={busy === c.id} className="flex items-center gap-1 bg-loss/10 text-loss rounded-lg px-3 py-1.5 text-xs font-bold ml-auto disabled:opacity-50"><Trash2 size={13} /> Remove</button>
          </div>
          {open === c.id && (
            <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
              {contribs.length === 0 ? <p className="text-xs text-gray-600">No contributions.</p> : contribs.map(x => (
                <div key={x.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">◎ {sol(x.lamports)} · {short(x.contributor_wallet)}</span>
                  <a href={`https://solscan.io/tx/${x.tx_signature}`} target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline inline-flex items-center gap-1">tx <ExternalLink size={10} /></a>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
