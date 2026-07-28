'use client';
import { useState, useEffect } from 'react';
import { Power, Loader2, AlertTriangle, Check } from 'lucide-react';
import clsx from 'clsx';

export function MaintenanceToggle() {
  const [maintenance, setMaintenance] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(d => {
      if (d.ok) { setMaintenance(d.maintenance); setMessage(d.message || ''); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async (next: { maintenance?: boolean; message?: string }) => {
    setSaving(true); setSaved(false);
    try {
      const r = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      const d = await r.json();
      if (d.ok) { setMaintenance(d.maintenance); setMessage(d.message); setSaved(true); setTimeout(() => setSaved(false), 1500); }
    } catch {}
    setSaving(false);
  };

  const toggle = () => save({ maintenance: !maintenance });

  if (loading) return <div className="glass-card rounded-2xl p-6 shimmer h-40" />;

  return (
    <div className={clsx('glass-card rounded-2xl p-6 space-y-4 border', maintenance ? 'border-loss/40' : 'border-white/10')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-white flex items-center gap-2"><Power size={16} className={maintenance ? 'text-loss' : 'text-cyan'} /> Maintenance mode</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md">When ON, the entire site shows the maintenance page to everyone. The admin dashboard stays accessible so you can turn it back off.</p>
        </div>
        <button onClick={toggle} disabled={saving} aria-label="Toggle maintenance"
          className={clsx('relative w-14 h-7 rounded-full transition-all shrink-0', maintenance ? 'bg-loss' : 'bg-white/15')}>
          <span className={clsx('absolute top-0.5 w-6 h-6 bg-white rounded-full transition-all shadow', maintenance ? 'left-7' : 'left-0.5')} />
        </button>
      </div>

      <div className={clsx('flex items-center gap-2 text-sm font-semibold', maintenance ? 'text-loss' : 'text-win')}>
        {maintenance ? <><AlertTriangle size={14} /> Site is LOCKED — users see the maintenance page</> : <><Check size={14} /> Site is LIVE</>}
        {saving && <Loader2 size={13} className="animate-spin text-slate-400" />}
      </div>

      <div>
        <label className="label">Message shown to users</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
          className="input-field resize-none w-full" placeholder="Hello community, we are currently working on updating the platform. The site will be back soon." />
        <div className="flex items-center gap-3 mt-2">
          <button onClick={() => save({ message })} disabled={saving} className="btn-ghost !py-2 !px-4 text-sm">Save message</button>
          {saved && <span className="text-win text-xs flex items-center gap-1"><Check size={12} /> Saved</span>}
        </div>
      </div>
      <p className="text-[11px] text-slate-600">Changes take effect within ~10 seconds across the site.</p>
    </div>
  );
}
