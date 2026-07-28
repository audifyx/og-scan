'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard, PlusCircle, Users, CheckCircle2, XCircle, Lock,
  TrendingUp, Activity, Eye, EyeOff, LogOut, RefreshCw, Star, Zap,
  BarChart2, Settings, Flame, AlertTriangle, ShieldCheck, Wallet, Trophy, ArrowUpFromLine, DollarSign, UserPlus, HeartHandshake, LifeBuoy,
} from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import clsx from 'clsx';
import { PayoutQueue } from '@/components/admin/PayoutQueue';
import { SupportTickets } from '@/components/admin/SupportTickets';
import { MaintenanceToggle } from '@/components/admin/MaintenanceToggle';
import { WithdrawalsQueue } from '@/components/admin/WithdrawalsQueue';
import { FundraisesQueue } from '@/components/admin/FundraisesQueue';
import { DURATIONS } from '@/lib/durations';

const LAMPORTS = 1_000_000_000;
const fmt = (l: number) => (Number(l) / LAMPORTS).toFixed(3);

type AdminTab = 'overview' | 'bets' | 'create' | 'users' | 'resolve' | 'payouts' | 'withdrawals' | 'fundraises' | 'tickets' | 'analytics' | 'settings';

// ── PIN Gate ────────────────────────────────────────────────────────────────
function PinGate({ onAuth }: { onAuth: () => void }) {
  const [pin, setPin] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) onAuth();
      else { setErr('Invalid PIN'); setPin(''); }
    } catch { setErr('Login failed'); setPin(''); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-risein">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-sol-gradient flex items-center justify-center mx-auto mb-5 neon-purple">
            <ShieldCheck size={28} className="text-black" />
          </div>
          <h1 className="text-3xl font-extrabold gradient-text">OrbitX</h1>
          <p className="text-slate-400 text-sm mt-2">Admin control room · authorized access only</p>
        </div>

        <form onSubmit={submit} className="glass-card rounded-3xl p-6 space-y-5">
          <div>
            <label className="label">Admin PIN</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'} value={pin}
                onChange={e => { setPin(e.target.value); setErr(''); }}
                placeholder="••••" maxLength={32} autoFocus
                className="input-field text-center font-mono text-lg tracking-[0.4em] pr-12"
              />
              <button type="button" onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {err && <p className="text-loss text-xs mt-2 flex items-center gap-1"><AlertTriangle size={11} /> {err}</p>}
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Verifying…' : 'Enter dashboard'}
          </button>
        </form>
        <p className="text-center text-[11px] text-slate-400 mt-4">Sessions expire after 8 hours.</p>
      </div>
    </div>
  );
}

// ── Create Bet Form ──────────────────────────────────────────────────────────
function CreateBetForm({ onCreated }: { onCreated: () => void }) {
  const CATS = ['Crypto', 'Sports', 'Politics', 'Entertainment', 'Memes', 'Custom'];
  const [form, setForm] = useState({
    title: '', description: '', category: 'Crypto',
    outcomes: ['Yes', 'No'],
    min_stake: '0', expiry_minutes: '10080', featured: false, image_url: '',
    auto_resolve: false, resolution_kind: 'crypto_price',
    res_asset: 'solana', res_comparator: 'gte', res_target: '',
    res_event_id: '', res_market: 'winner',
    res_home_index: '0', res_away_index: '1', res_draw_index: '',
    res_line: '', res_over_index: '0', res_under_index: '1',
  });
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const uploadImage = async (file: File) => {
    setUploading(true); setErr('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const d = await r.json();
      if (d.ok) setForm(f => ({ ...f, image_url: d.url })); else setErr(d.error || 'Upload failed');
    } catch { setErr('Upload failed'); } finally { setUploading(false); }
  };

  const addOutcome = () => setForm(f => ({ ...f, outcomes: [...f.outcomes, ''] }));
  const removeOutcome = (i: number) => setForm(f => ({ ...f, outcomes: f.outcomes.filter((_, j) => j !== i) }));
  const setOutcome = (i: number, v: string) => setForm(f => ({ ...f, outcomes: f.outcomes.map((o, j) => j === i ? v : o) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return setErr('Title required');
    if (form.outcomes.length < 2) return setErr('Need at least 2 outcomes');
    if (form.outcomes.some(o => !o.trim())) return setErr('All outcomes must have labels');
    setLoading(true); setErr('');
    let error: any = null;
    try {
      const res = await fetch('/api/admin/create-bet', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: form.category,
          outcomes: form.outcomes,
          min_stake: form.min_stake,
          expiry_minutes: form.expiry_minutes,
          featured: form.featured,
          image_url: form.image_url,
          auto_resolve: form.auto_resolve,
          resolution_kind: form.auto_resolve ? form.resolution_kind : 'manual',
          resolution_config: !form.auto_resolve ? {} : (form.resolution_kind === 'crypto_price'
            ? { asset: form.res_asset, comparator: form.res_comparator, target: Number(form.res_target), yes_index: 0, no_index: 1 }
            : { event_id: form.res_event_id, market: form.res_market,
                home_index: Number(form.res_home_index), away_index: Number(form.res_away_index),
                ...(form.res_draw_index !== '' ? { draw_index: Number(form.res_draw_index) } : {}),
                ...(form.res_market === 'total' ? { line: Number(form.res_line), over_index: Number(form.res_over_index), under_index: Number(form.res_under_index) } : {}) }),
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) error = { message: d.error || 'Failed to create bet' };
    } catch { error = { message: 'Failed to create bet' }; }
    setLoading(false);
    if (error) return setErr(error.message);
    setOk(true);
    setForm(f => ({ ...f, title: '', description: '', outcomes: ['Yes', 'No'] }));
    setTimeout(() => { setOk(false); onCreated(); }, 1500);
  };

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6 animate-risein">
      <SectionHead icon={PlusCircle} title="Create a new bet" sub="Bets you create here are tied to your admin profile so you can resolve & pay them out." />

      <div className="glass-card rounded-3xl p-6 grid md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <label className="label">Title *</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="BTC hits $100k before 2027?" className="input-field" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2} placeholder="Additional details…" className="input-field resize-none" />
        </div>
        <div>
          <label className="label">Category</label>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input-field">
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Min stake (SOL) — 0 = no minimum</label>
          <input type="number" step="0.01" value={form.min_stake} onChange={e => setForm(f => ({ ...f, min_stake: e.target.value }))} className="input-field" />
        </div>
        <div>
          <label className="label">Duration</label>
          <select value={form.expiry_minutes} onChange={e => setForm(f => ({ ...f, expiry_minutes: e.target.value }))} className="input-field">
            {DURATIONS.map(d => <option key={d.m} value={d.m}>{d.l}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Bet image (optional)</label>
          <div className="flex items-center gap-3">
            {form.image_url
              ? <img src={form.image_url} alt="" className="w-24 h-14 object-cover rounded-lg border border-white/10" />
              : <div className="w-24 h-14 rounded-lg border border-dashed border-white/15 flex items-center justify-center text-slate-600 text-[10px]">no image</div>}
            <label className="btn-ghost !py-2 !px-3 text-sm cursor-pointer">
              {uploading ? 'Uploading…' : 'Upload image'}
              <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) uploadImage(file); }} />
            </label>
            {form.image_url && <button type="button" onClick={() => setForm(f => ({ ...f, image_url: '' }))} className="text-xs text-loss hover:text-red-300">remove</button>}
          </div>
          <input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="…or paste an image URL" className="input-field mt-2" />
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <button type="button" onClick={() => setForm(f => ({ ...f, auto_resolve: !f.auto_resolve }))}
            className={clsx('w-12 h-6 rounded-full transition-all relative', form.auto_resolve ? 'bg-sol-gradient' : 'bg-white/10')}>
            <span className={clsx('absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow', form.auto_resolve ? 'left-6' : 'left-0.5')} />
          </button>
          <span className="text-sm flex items-center gap-1.5 text-slate-200"><ShieldCheck size={13} className="text-cyan" /> Auto-resolve from an oracle (no manual settle)</span>
        </label>

        {form.auto_resolve && (
          <div className="space-y-4 border-t border-white/10 pt-4">
            <p className="text-xs text-slate-400">Checked every 5 min after the bet duration ends. Outcome 1 = YES/over/home, Outcome 2 = NO/under/away.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Source</label>
                <select value={form.resolution_kind} onChange={e => setForm(f => ({ ...f, resolution_kind: e.target.value }))} className="input-field">
                  <option value="crypto_price">Crypto price (CoinGecko)</option>
                  <option value="sports_match">Sports result (TheSportsDB)</option>
                </select>
              </div>
            </div>

            {form.resolution_kind === 'crypto_price' && (
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Asset</label>
                  <input value={form.res_asset} onChange={e => setForm(f => ({ ...f, res_asset: e.target.value }))} placeholder="solana / bitcoin" className="input-field" /></div>
                <div><label className="label">Condition</label>
                  <select value={form.res_comparator} onChange={e => setForm(f => ({ ...f, res_comparator: e.target.value }))} className="input-field">
                    <option value="gte">Price ≥ target → YES</option>
                    <option value="lte">Price ≤ target → YES</option>
                  </select></div>
                <div><label className="label">Target (USD)</label>
                  <input type="number" step="0.0001" value={form.res_target} onChange={e => setForm(f => ({ ...f, res_target: e.target.value }))} placeholder="200" className="input-field" /></div>
              </div>
            )}

            {form.resolution_kind === 'sports_match' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">TheSportsDB event id</label>
                    <input value={form.res_event_id} onChange={e => setForm(f => ({ ...f, res_event_id: e.target.value }))} placeholder="2052744" className="input-field" /></div>
                  <div><label className="label">Market</label>
                    <select value={form.res_market} onChange={e => setForm(f => ({ ...f, res_market: e.target.value }))} className="input-field">
                      <option value="winner">Match winner</option>
                      <option value="total">Total goals over/under</option>
                    </select></div>
                </div>
                {form.res_market === 'winner' ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="label">Home → outcome #</label>
                      <input type="number" value={form.res_home_index} onChange={e => setForm(f => ({ ...f, res_home_index: e.target.value }))} className="input-field" /></div>
                    <div><label className="label">Away → outcome #</label>
                      <input type="number" value={form.res_away_index} onChange={e => setForm(f => ({ ...f, res_away_index: e.target.value }))} className="input-field" /></div>
                    <div><label className="label">Draw → outcome # (opt)</label>
                      <input type="number" value={form.res_draw_index} onChange={e => setForm(f => ({ ...f, res_draw_index: e.target.value }))} placeholder="—" className="input-field" /></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="label">Line</label>
                      <input type="number" step="0.5" value={form.res_line} onChange={e => setForm(f => ({ ...f, res_line: e.target.value }))} placeholder="2.5" className="input-field" /></div>
                    <div><label className="label">Over → outcome #</label>
                      <input type="number" value={form.res_over_index} onChange={e => setForm(f => ({ ...f, res_over_index: e.target.value }))} className="input-field" /></div>
                    <div><label className="label">Under → outcome #</label>
                      <input type="number" value={form.res_under_index} onChange={e => setForm(f => ({ ...f, res_under_index: e.target.value }))} className="input-field" /></div>
                  </div>
                )}
                <p className="text-[11px] text-slate-500">Outcome # is zero-based (matches the list below: 0 = first outcome).</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="glass-card rounded-3xl p-6">
        <div className="flex items-center justify-between mb-3">
          <label className="label !mb-0">Outcomes ({form.outcomes.length})</label>
          {form.outcomes.length < 10 && (
            <button type="button" onClick={addOutcome} className="text-xs font-semibold text-cyan hover:text-white transition-colors">+ Add outcome</button>
          )}
        </div>
        <div className="space-y-2">
          {form.outcomes.map((o, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="w-6 text-center text-xs text-slate-500 font-mono">{i + 1}</span>
              <input value={o} onChange={e => setOutcome(i, e.target.value)} placeholder={`Outcome ${i + 1}`} className="input-field flex-1" />
              {form.outcomes.length > 2 && (
                <button type="button" onClick={() => removeOutcome(i)} className="text-loss hover:text-red-300 p-1"><XCircle size={16} /></button>
              )}
            </div>
          ))}
        </div>

        <label className="flex items-center gap-3 cursor-pointer mt-5">
          <button type="button" onClick={() => setForm(f => ({ ...f, featured: !f.featured }))}
            className={clsx('w-12 h-6 rounded-full transition-all relative', form.featured ? 'bg-sol-gradient' : 'bg-white/10')}>
            <span className={clsx('absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow', form.featured ? 'left-6' : 'left-0.5')} />
          </button>
          <span className="text-sm flex items-center gap-1.5 text-slate-200"><Star size={13} className="text-gold" /> Feature on homepage</span>
        </label>
      </div>

      {err && <p className="text-loss text-sm flex items-center gap-1.5"><AlertTriangle size={13} /> {err}</p>}
      <button type="submit" disabled={loading || ok} className="btn-primary">
        {ok ? '✓ Bet created!' : loading ? 'Creating…' : 'Create bet'}
      </button>
    </form>
  );
}

function SectionHead({ icon: Icon, title, sub }: { icon: any; title: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-cyan" />
      </div>
      <div>
        <h2 className="text-xl font-extrabold text-white">{title}</h2>
        {sub && <p className="text-sm text-slate-400 mt-0.5 max-w-xl">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main Admin Dashboard ─────────────────────────────────────────────────────
function AdminDash({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [bets, setBets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [b, u] = await Promise.all([
      (supabase as any).from('bets').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('profiles').select('*').order('wins', { ascending: false }),
    ]);
    setBets(b.data || []); setUsers(u.data || []); setLoading(false);
    fetch('/api/admin/stats', { cache: 'no-store' }).then(r => r.json()).then(d => { if (d.ok) setStats(d.stats); }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalVol = bets.reduce((s: number, b: any) => s + Number(b.total_pool || 0), 0);
  const openCount = bets.filter((b: any) => b.status === 'open').length;
  const resolvedCount = bets.filter((b: any) => b.status === 'resolved').length;

  const resolveBet = async (id: string, winIdx: number) => {
    setResolving(id);
    try {
      const res = await fetch('/api/admin/resolve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betId: id, winningOutcomeIndex: winIdx }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) alert(d.error || 'Failed to resolve bet');
    } catch { alert('Failed to resolve bet'); }
    setResolving(null); load();
  };

  const TABS: { id: AdminTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'bets', label: 'All Bets', icon: Activity },
    { id: 'create', label: 'Create Bet', icon: PlusCircle },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'resolve', label: 'Resolve', icon: CheckCircle2 },
    { id: 'payouts', label: 'Payouts', icon: Wallet },
    { id: 'withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
    { id: 'fundraises', label: 'Fundraises', icon: HeartHandshake },
    { id: 'tickets', label: 'Tickets', icon: LifeBuoy },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const chartData = bets.slice(0, 14).reverse().map((b: any, i: number) => ({ i, vol: Number(b.total_pool || 0) / LAMPORTS }));
  const STAT = (s: string) => clsx('text-xs px-2 py-0.5 rounded-full capitalize font-semibold border',
    s === 'open' ? 'text-win bg-win/10 border-win/20'
    : s === 'resolved' ? 'text-purple bg-purple/10 border-purple/20'
    : s === 'locked' ? 'text-gold bg-gold/10 border-gold/20'
    : 'text-slate-400 bg-white/5 border-white/10');

  return (
    <div className="min-h-screen">
      {/* Topbar */}
      <header className="sticky top-0 z-30 h-16 glass border-b border-white/8 flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sol-gradient flex items-center justify-center neon-purple">
            <Zap size={16} className="text-black" />
          </div>
          <span className="font-extrabold text-lg gradient-text">OrbitX</span>
          <span className="chip border-purple/30 text-purple bg-purple/10">Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all" title="Refresh"><RefreshCw size={15} /></button>
          <button onClick={onLogout} className="btn-ghost !py-2 !px-3 text-sm"><LogOut size={14} /> Logout</button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:block w-56 shrink-0 border-r border-white/8 min-h-[calc(100vh-4rem)] p-3 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={clsx('w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all text-left relative',
                tab === id ? 'text-white font-semibold bg-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5')}>
              {tab === id && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-sol-gradient" />}
              <Icon size={16} className={tab === id ? 'text-cyan' : ''} />{label}
            </button>
          ))}
        </aside>

        {/* Mobile tab bar */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-white/8 flex overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={clsx('flex-1 min-w-[64px] flex flex-col items-center gap-1 py-2.5 text-[10px]', tab === id ? 'text-cyan' : 'text-slate-500')}>
              <Icon size={16} />{label}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 p-5 md:p-7 pb-24 md:pb-7 overflow-auto md:max-h-[calc(100vh-4rem)]">
          {tab === 'overview' && (
            <div className="space-y-7 animate-risein">
              <SectionHead icon={LayoutDashboard} title="Platform overview" sub="Live snapshot of bets, volume and players." />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { l: 'Open Bets', v: String(openCount), c: 'text-win', i: Flame, g: 'from-win/20' },
                  { l: 'Resolved', v: String(resolvedCount), c: 'text-purple', i: CheckCircle2, g: 'from-purple/20' },
                  { l: 'Total Volume', v: `◎ ${fmt(totalVol)}`, c: 'text-cyan', i: TrendingUp, g: 'from-cyan/20' },
                  { l: 'Players', v: String(users.length), c: 'text-gold', i: Users, g: 'from-gold/20' },
                ].map(({ l, v, c, i: Icon, g }) => (
                  <div key={l} className={clsx('glass-card rounded-2xl p-5 bg-gradient-to-b to-transparent', g)}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-slate-400">{l}</p>
                      <Icon size={15} className={c} />
                    </div>
                    <p className={clsx('text-2xl font-extrabold', c)}>{v}</p>
                  </div>
                ))}
              </div>

              {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { l: 'Total users', v: String(stats.usersTotal), c: 'text-cyan', i: Users, g: 'from-cyan/20' },
                    { l: 'New today', v: `+${stats.newToday}`, c: 'text-win', i: UserPlus, g: 'from-win/20' },
                    { l: 'Total payouts', v: `\u25ce ${stats.totalPayoutsSol.toFixed(3)}`, c: 'text-purple', i: DollarSign, g: 'from-purple/20' },
                    { l: 'Pending payouts', v: `\u25ce ${stats.pendingPayoutsSol.toFixed(3)}`, c: 'text-gold', i: AlertTriangle, g: 'from-gold/20' },
                  ].map(({ l, v, c, i: Icon, g }) => (
                    <div key={l} className={clsx('glass-card rounded-2xl p-5 bg-gradient-to-b to-transparent', g)}>
                      <div className="flex items-center justify-between mb-3"><p className="text-xs text-slate-400">{l}</p><Icon size={15} className={c} /></div>
                      <p className={clsx('text-2xl font-extrabold', c)}>{v}</p>
                    </div>
                  ))}
                </div>
              )}

              {stats?.dailySignups && (
                <div className="glass-card rounded-2xl p-5">
                  <h3 className="font-bold mb-4 text-white flex items-center gap-2"><UserPlus size={15} className="text-purple" /> Daily new users (14d)</h3>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.dailySignups}>
                        <defs><linearGradient id="uGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A855F7" stopOpacity={0.45} /><stop offset="100%" stopColor="#A855F7" stopOpacity={0} /></linearGradient></defs>
                        <XAxis dataKey="d" tick={{ fill: '#9aa0c4', fontSize: 10 }} interval={2} />
                        <Tooltip formatter={(v: any) => [v, 'New users']} contentStyle={{ background: '#0c0c1a', border: '1px solid rgba(255,255,255,.1)', borderRadius: '12px' }} />
                        <Area dataKey="v" stroke="#A855F7" fill="url(#uGrad)" strokeWidth={2.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {chartData.length > 1 && (
                <div className="glass-card rounded-2xl p-5">
                  <h3 className="font-bold mb-4 text-white">Volume trend</h3>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs><linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22E3FF" stopOpacity={0.45} /><stop offset="100%" stopColor="#22E3FF" stopOpacity={0} /></linearGradient></defs>
                        <XAxis dataKey="i" hide />
                        <Tooltip formatter={(v: any) => [`◎ ${Number(v).toFixed(3)}`, 'Volume']} contentStyle={{ background: '#0c0c1a', border: '1px solid rgba(255,255,255,.1)', borderRadius: '12px' }} />
                        <Area dataKey="vol" stroke="#22E3FF" fill="url(#volGrad)" strokeWidth={2.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-bold mb-3 text-white">Recent bets</h3>
                <div className="space-y-2">
                  {bets.slice(0, 5).map((b: any) => (
                    <div key={b.id} className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
                      <span className={STAT(b.status)}>{b.status}</span>
                      <p className="flex-1 text-sm truncate text-slate-200">{b.title || b.description}</p>
                      <p className="text-xs text-cyan font-semibold">◎ {fmt(b.total_pool || 0)}</p>
                    </div>
                  ))}
                  {bets.length === 0 && <p className="text-slate-500 text-sm">No bets yet.</p>}
                </div>
              </div>
            </div>
          )}

          {tab === 'bets' && (
            <div className="space-y-4 animate-risein">
              <div className="flex items-center justify-between">
                <SectionHead icon={Activity} title={`All bets (${bets.length})`} />
                <button onClick={() => setTab('create')} className="btn-ghost !py-2 !px-4 text-sm"><PlusCircle size={14} /> New bet</button>
              </div>
              <div className="space-y-2">
                {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="glass-card rounded-xl h-16 shimmer" />) :
                  bets.map((b: any) => (
                    <div key={b.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                      <span className={STAT(b.status)}>{b.status}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{b.title || b.description}</p>
                        <p className="text-xs text-slate-500">Pool ◎{fmt(b.total_pool || 0)} · {b.bet_count || 0} bets · <span className="capitalize">{b.category}</span></p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {b.status === 'open' && <button onClick={async () => { await fetch('/api/admin/lock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ betId: b.id }) }); load(); }} className="p-2 text-gold hover:bg-gold/10 rounded-lg transition-all" title="Lock"><Lock size={13} /></button>}
                        <button onClick={async () => { if (confirm('Delete this bet?')) { await fetch('/api/admin/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ betId: b.id }) }); load(); } }} className="p-2 text-loss hover:bg-loss/10 rounded-lg transition-all" title="Delete"><XCircle size={13} /></button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {tab === 'create' && <CreateBetForm onCreated={load} />}

          {tab === 'users' && (
            <div className="space-y-4 animate-risein">
              <SectionHead icon={Users} title={`Players (${users.length})`} />
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[11px] text-slate-500 uppercase tracking-widest border-b border-white/8">
                  <span className="col-span-1">#</span><span className="col-span-5">Player</span>
                  <span className="col-span-2 text-center">W / L</span><span className="col-span-2 text-center">Bets</span>
                  <span className="col-span-2 text-right">Wagered</span>
                </div>
                {users.length === 0 ? <p className="p-8 text-center text-slate-500">No players yet.</p> :
                  users.map((u: any, i: number) => (
                    <div key={u.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-t border-white/5 hover:bg-white/[0.03]">
                      <span className="col-span-1 text-slate-500 text-sm">{i + 1}</span>
                      <div className="col-span-5 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{u.username || 'Anonymous'}</p>
                        <p className="text-xs text-slate-600 font-mono truncate">{(u.wallet || '—').slice(0, 16)}…</p>
                      </div>
                      <div className="col-span-2 text-center text-sm"><span className="text-win">{u.wins ?? 0}</span><span className="text-slate-600"> / </span><span className="text-loss">{u.losses ?? 0}</span></div>
                      <div className="col-span-2 text-center text-slate-300 text-sm">{u.total_bets ?? 0}</div>
                      <div className="col-span-2 text-right text-cyan font-bold text-sm">◎{Number(u.total_wagered_sol || 0).toFixed(2)}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {tab === 'resolve' && (
            <div className="space-y-4 animate-risein">
              <SectionHead icon={CheckCircle2} title="Resolve bets" sub="Pick the winning outcome. Winners get their stake back plus a pro-rata share of the losing pool, minus the 2.5% fee." />
              {bets.filter((b: any) => ['open', 'locked'].includes(b.status)).length === 0 ? (
                <div className="text-center py-16 text-slate-600"><CheckCircle2 size={36} className="mx-auto mb-3 opacity-30" /><p>Nothing waiting to resolve.</p></div>
              ) : bets.filter((b: any) => ['open', 'locked'].includes(b.status)).map((b: any) => {
                const outcomes = b.outcomes || [b.yes_label || 'Yes', b.no_label || 'No'];
                const pools = (b.outcome_pools || [b.yes_pool || 0, b.no_pool || 0]).map(Number);
                const total = pools.reduce((s: number, p: number) => s + p, 0);
                return (
                  <div key={b.id} className="glass-card rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">{b.title || b.description}</p>
                        <p className="text-xs text-slate-500 mt-1">{b.bet_count || 0} bets · ◎{fmt(b.total_pool || 0)} pool</p>
                      </div>
                      <span className={STAT(b.status)}>{b.status}</span>
                    </div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(outcomes.length, 3)},minmax(0,1fr))` }}>
                      {outcomes.map((o: string, i: number) => (
                        <button key={i} onClick={() => resolveBet(b.id, i)} disabled={resolving === b.id}
                          className="py-3 px-3 rounded-xl border border-white/10 hover:border-cyan/40 hover:bg-cyan/5 text-sm font-semibold transition-all disabled:opacity-40 text-center">
                          <p className="text-white truncate">{o}</p>
                          <p className="text-xs text-slate-500 mt-0.5">◎{fmt(pools[i] || 0)} · {total > 0 ? Math.round((pools[i] || 0) / total * 100) : Math.round(100 / outcomes.length)}%</p>
                        </button>
                      ))}
                    </div>
                    <button onClick={async () => { if (confirm('Cancel and refund every wager?')) { await fetch('/api/admin/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ betId: b.id }) }); load(); } }}
                      className="text-xs text-loss hover:text-red-300 transition-colors flex items-center gap-1">
                      <AlertTriangle size={11} /> Cancel & refund all
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'payouts' && (
            <div className="space-y-4 animate-risein">
              <SectionHead icon={Wallet} title="Payouts (USDC)" sub="Winners to pay. Send USDC to each payout wallet, then mark paid. Amounts shown in USDC." />
              <TreasuryCard />
              <WithdrawalsQueue />
              <PayoutQueue />
            </div>
          )}

          {tab === 'withdrawals' && (
            <div className="space-y-4 animate-risein">
              <SectionHead icon={ArrowUpFromLine} title="Withdrawals" sub="User payout requests. Send SOL from the treasury, then mark paid. Rejecting refunds the balance." />
              <WithdrawalsQueue />
            </div>
          )}

          {tab === 'fundraises' && (
            <div className="space-y-4 animate-risein">
              <SectionHead icon={HeartHandshake} title="Fundraise campaigns" sub="Contributions go directly to each creator's wallet (on-chain verified) and are final. Campaigns run until the creator's deadline. Read-only monitor; $12.50 creation fee is the only platform revenue." />
              <FundraisesQueue />
            </div>
          )}

          {tab === 'tickets' && (
            <div className="space-y-4 animate-risein">
              <SectionHead icon={LifeBuoy} title="Support tickets" sub="Live chat with users. New messages appear here; reply and they see it in real time." />
              <SupportTickets />
            </div>
          )}

          {tab === 'analytics' && (
            <div className="space-y-5 animate-risein">
              <SectionHead icon={BarChart2} title="Analytics" />
              <div className="glass-card rounded-2xl p-5">
                <h3 className="font-bold mb-4 text-white">Volume by category</h3>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(bets.reduce((acc: any, b: any) => { acc[b.category || 'other'] = (acc[b.category || 'other'] || 0) + Number(b.total_pool || 0) / LAMPORTS; return acc; }, {})).map(([cat, vol]) => ({ cat, vol }))}>
                      <XAxis dataKey="cat" tick={{ fill: '#9aa0c4', fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => [`◎${Number(v).toFixed(2)}`, 'Volume']} contentStyle={{ background: '#0c0c1a', border: '1px solid rgba(255,255,255,.1)', borderRadius: '12px' }} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                      <Bar dataKey="vol" fill="#A855F7" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {stats?.dailyVolume && (
                <div className="glass-card rounded-2xl p-5">
                  <h3 className="font-bold mb-4 text-white">Daily volume (14d)</h3>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.dailyVolume}>
                        <defs><linearGradient id="dvGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22E3FF" stopOpacity={0.45} /><stop offset="100%" stopColor="#22E3FF" stopOpacity={0} /></linearGradient></defs>
                        <XAxis dataKey="d" tick={{ fill: '#9aa0c4', fontSize: 10 }} interval={2} />
                        <Tooltip formatter={(v: any) => [`\u25ce ${Number(v).toFixed(3)}`, 'Volume']} contentStyle={{ background: '#0c0c1a', border: '1px solid rgba(255,255,255,.1)', borderRadius: '12px' }} />
                        <Area dataKey="v" stroke="#22E3FF" fill="url(#dvGrad)" strokeWidth={2.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {stats?.topUsers && stats.topUsers.length > 0 && (
                <div className="glass-card rounded-2xl p-5">
                  <h3 className="font-bold mb-3 text-white flex items-center gap-2"><Trophy size={15} className="text-gold" /> Top players by winnings</h3>
                  <div className="space-y-1">
                    {stats.topUsers.map((u: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
                        <span className="text-slate-300 truncate">{i + 1}. {u.username || (u.wallet ? u.wallet.slice(0, 4) + '\u2026' + u.wallet.slice(-4) : 'anon')}</span>
                        <span className="text-win font-semibold shrink-0">\u25ce {Number(u.won).toFixed(2)} <span className="text-slate-500">\u00b7 {u.wins}W/{u.losses}L</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="glass-card rounded-2xl p-5">
                  <h3 className="font-bold mb-2 text-white flex items-center gap-2"><Wallet size={15} className="text-cyan" /> Treasury wallet</h3>
                  <p className="text-xs font-mono text-slate-400 break-all">9ZygxJ8AsvQLK9368uyuxQ4uTkmSj2EsjwAy3UdSQWgY</p>
                  <p className="text-xs text-slate-600 mt-2">All deposits & fees land here. Payouts are sent from here.</p>
                </div>
                <div className="glass-card rounded-2xl p-5">
                  <h3 className="font-bold mb-2 text-white flex items-center gap-2"><Trophy size={15} className="text-gold" /> Payout model</h3>
                  <p className="text-xs text-slate-400">Parimutuel · 2.5% platform fee · winners split the losing pool pro-rata. Refunds on no-winner / no-counterparty.</p>
                </div>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="space-y-5 animate-risein">
              <SectionHead icon={Settings} title="Platform settings" />
              <MaintenanceToggle />
              <div className="glass-card rounded-2xl p-6 space-y-3">
                <h3 className="font-bold text-white">Fee tiers (USD, converted to SOL at placement)</h3>
                {[{ l: 'Small (pool < $50)', v: '$1' }, { l: 'Medium ($50 – $500)', v: '$5' }, { l: 'Large (> $500)', v: '$10' }].map(({ l, v }) => (
                  <div key={l} className="flex justify-between items-center py-2 border-b border-white/5">
                    <p className="text-sm text-slate-300">{l}</p>
                    <p className="text-cyan font-bold">{v} → Treasury</p>
                  </div>
                ))}
                <p className="text-xs text-slate-600">Platform fee on resolution is 2.5% of the gross pool.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function TreasuryCard() {
  const [t, setT] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/treasury').then(r => r.json()).then(setT).catch(() => {}); }, []);
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 flex items-center gap-1"><Wallet size={12} className="text-cyan"/> Treasury balance · all bets combined</p>
          <p className="text-2xl font-extrabold text-white mt-1">{t?.ok ? `◎ ${Number(t.sol).toFixed(3)}` : '—'} {t?.ok && <span className="text-sm text-slate-400 font-semibold">(${Number(t.usd).toLocaleString('en-US',{maximumFractionDigits:0})})</span>}</p>
          <p className="text-[11px] text-slate-600 mt-1 font-mono break-all">{t?.treasury || ''}</p>
        </div>
        {t?.treasury && <a href={`https://solscan.io/account/${t.treasury}`} target="_blank" rel="noopener noreferrer" className="btn-ghost !py-2 !px-3 text-xs">View on Solscan</a>}
      </div>
      <p className="text-[11px] text-slate-500 mt-3">This is the total across every bet. Each bet's own pool is shown on its bet page and in Resolve.</p>
    </div>
  );
}

// ── Page root ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch('/api/admin/me').then(r => r.json()).then(d => setAuthed(!!d.authed)).catch(() => setAuthed(false)).finally(() => setReady(true));
  }, []);

  const logout = async () => {
    try { await fetch('/api/admin/logout', { method: 'POST' }); } catch {}
    setAuthed(false);
  };

  if (!ready) return null;
  if (!authed) return <PinGate onAuth={() => setAuthed(true)} />;
  return <AdminDash onLogout={logout} />;
}
