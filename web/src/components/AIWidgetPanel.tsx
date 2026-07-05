import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────
export type WidgetType =
  | 'sol_price'
  | 'trending'
  | 'social_feed'
  | 'wallet'
  | 'price_chart'
  | 'kol_feed'
  | 'fear_greed'
  | 'volume_bar';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  params: Record<string, string | number | boolean>;
  size: 'sm' | 'md' | 'lg';
  pos: number;
}

// ── Persistence ────────────────────────────────────────────────────────────
const WG_KEY = 'og_hub_widgets_v1';
export const readWidgets = (): WidgetConfig[] => {
  try { return JSON.parse(localStorage.getItem(WG_KEY) ?? '[]'); } catch { return []; }
};
const writeWidgets = (w: WidgetConfig[]) =>
  localStorage.setItem(WG_KEY, JSON.stringify(w));

// ── Widget library ─────────────────────────────────────────────────────────
const TEMPLATES: Record<string, Omit<WidgetConfig, 'id' | 'pos'>> = {
  sol_price:   { type: 'sol_price',   title: 'SOL Price',       params: {},                                      size: 'sm' },
  trending:    { type: 'trending',    title: 'Trending Tokens',  params: { limit: 5 },                           size: 'md' },
  social_feed: { type: 'social_feed', title: 'Community Feed',   params: { channel: 'social-general', limit: 3 }, size: 'md' },
  wallet:      { type: 'wallet',      title: 'Wallet Tracker',   params: { address: '' },                        size: 'sm' },
  price_chart: { type: 'price_chart', title: 'SOL Chart',        params: { symbol: 'SOL' },                      size: 'lg' },
  kol_feed:    { type: 'kol_feed',    title: 'KOL Activity',     params: { limit: 5 },                           size: 'md' },
  fear_greed:  { type: 'fear_greed',  title: 'Fear & Greed',     params: {},                                      size: 'sm' },
  volume_bar:  { type: 'volume_bar',  title: 'Volume Tracker',   params: { symbol: 'SOL' },                      size: 'md' },
};

const LIB_ICONS: Record<string, string> = {
  sol_price: '◎', trending: '🔥', social_feed: '💬',
  wallet: '👛', price_chart: '📈', kol_feed: '🐋', fear_greed: '🌡', volume_bar: '📊',
};

// ── Intent matcher (fallback when no AI key) ──────────────────────────────
function matchIntent(msg: string): { key: string; extra: Record<string, string> } {
  const m = msg.toLowerCase();
  if (m.includes('kol') || m.includes('whale') || m.includes('alert'))      return { key: 'kol_feed',    extra: {} };
  if (m.includes('fear') || m.includes('greed') || m.includes('sentiment')) return { key: 'fear_greed',  extra: {} };
  if (m.includes('volume') || m.includes('vol'))                             return { key: 'volume_bar',  extra: {} };
  if (m.includes('chart') || m.includes('candle') || m.includes('history')) {
    const sym = msg.match(/\$?([A-Z]{2,8})/)?.[1] ?? 'SOL';
    return { key: 'price_chart', extra: { symbol: sym, title: `${sym} Chart` } };
  }
  if (m.includes('wallet') || m.includes('address') || m.includes('balance')) {
    const addr = msg.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/)?.[0] ?? '';
    return { key: 'wallet', extra: { address: addr } };
  }
  if (m.includes('social') || m.includes('community') || m.includes('post')) return { key: 'social_feed', extra: {} };
  if (m.includes('trending') || m.includes('top') || m.includes('hot'))      return { key: 'trending',    extra: {} };
  return { key: 'sol_price', extra: {} };
}

// ── Widget renderers ───────────────────────────────────────────────────────

function SolPriceWidget() {
  const [price, setPrice] = useState<number | null>(null);
  const [chg, setChg]     = useState<number | null>(null);
  const [dots, setDots]   = useState<number[]>([]);
  useEffect(() => {
    let live = true;
    const go = () =>
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true')
        .then(r => r.json()).then(j => {
          if (!live || !j?.solana?.usd) return;
          const p = Number(j.solana.usd);
          setPrice(p); setChg(Number(j.solana.usd_24h_change ?? 0));
          setDots(prev => [...prev.slice(-14), p]);
        }).catch(() => {});
    go(); const iv = setInterval(go, 30_000);
    return () => { live = false; clearInterval(iv); };
  }, []);
  const up = (chg ?? 0) >= 0;
  const mn = Math.min(...dots), mx = Math.max(...dots);
  const norm = (v: number) => mx > mn ? (v - mn) / (mx - mn) : 0.5;
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
        {price ? `$${price >= 1000 ? price.toFixed(0) : price.toFixed(2)}` : '—'}
      </div>
      {chg !== null && <div style={{ fontSize: 11, fontWeight: 800, color: up ? '#34d399' : '#fb7185', marginTop: 2 }}>{up ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}% 24h</div>}
      {dots.length > 2 && (
        <svg width="100%" height="32" viewBox="0 0 100 32" preserveAspectRatio="none" style={{ display: 'block', marginTop: 8 }}>
          <polyline points={dots.map((d, i) => `${(i / (dots.length - 1)) * 100},${32 - norm(d) * 26}`).join(' ')}
            fill="none" stroke={up ? '#34d399' : '#fb7185'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function TrendingWidget({ params }: { params: Record<string, any> }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let live = true;
    fetch(`/api/ogdex/screener?type=trending&interval=24h&limit=${params.limit ?? 5}`)
      .then(r => r.json()).then(d => { if (live && d?.rows) setRows(d.rows.slice(0, 5)); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return (
    <div>
      {rows.length === 0 ? <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>Loading…</div>
        : rows.map((r, i) => {
          const up = (r.change24h ?? 0) >= 0;
          return (
            <a key={r.mint ?? i} href="/ORBITX_DEX" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', textDecoration: 'none', borderTop: i ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
              <span style={{ width: 14, fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,.3)' }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: '#fff' }}>${r.symbol}</span>
              <span style={{ fontSize: 11, fontWeight: 900, color: up ? '#34d399' : '#fb7185' }}>{up ? '+' : ''}{(r.change24h ?? 0).toFixed(1)}%</span>
            </a>
          );
        })}
    </div>
  );
}

function SocialFeedWidget({ params }: { params: Record<string, any> }) {
  const [posts, setPosts] = useState<any[]>([]);
  useEffect(() => {
    let live = true;
    supabase.from('social_messages').select('id,username,content,created_at')
      .eq('channel', params.channel ?? 'social-general').order('created_at', { ascending: false }).limit(params.limit ?? 3)
      .then(({ data }) => { if (live && data) setPosts(data as any); });
    return () => { live = false; };
  }, []);
  return (
    <div>
      {posts.length === 0 ? <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>No posts yet</div>
        : posts.map((p, i) => (
          <a key={p.id} href="/social" style={{ display: 'block', padding: '5px 0', textDecoration: 'none', borderTop: i ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#5aa2ff' }}>@{p.username ?? 'anon'} </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{p.content.slice(0, 70)}{p.content.length > 70 ? '…' : ''}</span>
          </a>
        ))}
    </div>
  );
}

function WalletWidget({ params }: { params: Record<string, any> }) {
  const [bal, setBal] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const addr = (params.address as string) ?? '';
  useEffect(() => {
    if (!addr || addr.length < 32) return;
    const key = (import.meta as any).env?.VITE_HELIUS_API_KEY ?? '';
    if (!key) { setErr('Helius key not set'); return; }
    fetch(`https://api.helius.xyz/v0/addresses/${addr}/balances?api-key=${key}`)
      .then(r => r.json()).then(d => { if (d?.nativeBalance !== undefined) setBal(d.nativeBalance / 1e9); })
      .catch(() => setErr('Fetch failed'));
  }, [addr]);
  if (!addr) return <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>No address — edit widget to add one.</div>;
  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', fontFamily: 'monospace', marginBottom: 4 }}>{addr.slice(0, 8)}…{addr.slice(-6)}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{bal !== null ? `${bal.toFixed(3)} SOL` : err || 'Loading…'}</div>
    </div>
  );
}

function FearGreedWidget() {
  const [val, setVal]     = useState<number | null>(null);
  const [label, setLabel] = useState('');
  useEffect(() => {
    fetch('https://api.alternative.me/fng/')
      .then(r => r.json()).then(d => { if (d?.data?.[0]) { setVal(Number(d.data[0].value)); setLabel(d.data[0].value_classification); } })
      .catch(() => {});
  }, []);
  const color = val === null ? '#888' : val < 25 ? '#fb7185' : val < 50 ? '#fbbf24' : val < 75 ? '#34d399' : '#22d3ee';
  return (
    <div style={{ textAlign: 'center', padding: '4px 0' }}>
      <div style={{ fontSize: 34, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums' }}>{val ?? '—'}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.6)', marginTop: 3 }}>{label || 'Loading…'}</div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', marginTop: 1 }}>Fear &amp; Greed Index</div>
    </div>
  );
}

function PriceChartWidget({ params }: { params: Record<string, any> }) {
  const [data, setData] = useState<{ t: number; v: number }[]>([]);
  const sym = (params.symbol as string) ?? 'SOL';
  const cgId = sym.toLowerCase() === 'sol' ? 'solana' : sym.toLowerCase();
  useEffect(() => {
    let live = true;
    fetch(`https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=1&interval=hourly`)
      .then(r => r.json()).then(d => { if (live && d?.prices) setData(d.prices.map(([t, v]: [number, number]) => ({ t, v }))); })
      .catch(() => {});
    return () => { live = false; };
  }, [cgId]);
  if (data.length < 2) return <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>Loading chart…</div>;
  const min = Math.min(...data.map(d => d.v)), max = Math.max(...data.map(d => d.v));
  const norm = (v: number) => max > min ? (v - min) / (max - min) : 0.5;
  const up = data[data.length - 1].v >= data[0].v;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * 100},${52 - norm(d.v) * 44}`).join(' ');
  const pct = (((data[data.length - 1].v - data[0].v) / data[0].v) * 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>${sym}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: up ? '#34d399' : '#fb7185' }}>{up ? '+' : ''}{pct.toFixed(2)}% 24h</span>
      </div>
      <svg width="100%" height="52" viewBox="0 0 100 52" preserveAspectRatio="none">
        <defs><linearGradient id={`g_${sym}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={up ? '#34d399' : '#fb7185'} stopOpacity="0.25" />
          <stop offset="100%" stopColor={up ? '#34d399' : '#fb7185'} stopOpacity="0" />
        </linearGradient></defs>
        <polygon points={`0,52 ${pts} 100,52`} fill={`url(#g_${sym})`} />
        <polyline points={pts} fill="none" stroke={up ? '#34d399' : '#fb7185'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>24h ago</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>now</span>
      </div>
    </div>
  );
}

function KOLFeedWidget({ params }: { params: Record<string, any> }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let live = true;
    supabase.from('kol_alerts').select('id,wallet,token_symbol,action,amount_sol,created_at')
      .order('created_at', { ascending: false }).limit(params.limit ?? 5)
      .then(({ data }) => { if (live && data) setRows(data as any); });
    return () => { live = false; };
  }, []);
  return (
    <div>
      {rows.length === 0 ? <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>No KOL activity yet</div>
        : rows.map((r, i) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: i ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
            <span style={{ fontSize: 10, color: r.action === 'buy' ? '#34d399' : '#fb7185', fontWeight: 900, textTransform: 'uppercase' }}>{r.action}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', flex: 1 }}>${r.token_symbol}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{Number(r.amount_sol).toFixed(1)} SOL</span>
          </div>
        ))}
    </div>
  );
}

function VolumeBarWidget({ params }: { params: Record<string, any> }) {
  const [vol, setVol] = useState<number | null>(null);
  const sym = (params.symbol as string) ?? 'SOL';
  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_vol=true')
      .then(r => r.json()).then(j => { if (j?.solana) setVol(j.solana.usd_24h_vol ?? null); })
      .catch(() => {});
  }, [sym]);
  const fmt = (v: number) => v > 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v > 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${v.toFixed(0)}`;
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{vol ? fmt(vol) : '—'}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>24h Volume · {sym}</div>
    </div>
  );
}

function WidgetRenderer({ widget }: { widget: WidgetConfig }) {
  switch (widget.type) {
    case 'sol_price':   return <SolPriceWidget />;
    case 'trending':    return <TrendingWidget params={widget.params} />;
    case 'social_feed': return <SocialFeedWidget params={widget.params} />;
    case 'wallet':      return <WalletWidget params={widget.params} />;
    case 'fear_greed':  return <FearGreedWidget />;
    case 'price_chart': return <PriceChartWidget params={widget.params} />;
    case 'kol_feed':    return <KOLFeedWidget params={widget.params} />;
    case 'volume_bar':  return <VolumeBarWidget params={widget.params} />;
    default:            return <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Unknown widget</div>;
  }
}

// ── AI Widget Panel ────────────────────────────────────────────────────────
interface Msg { role: 'user' | 'ai'; text: string; }

const AI_REPLIES: Record<string, string> = {
  sol_price:   '✅ Added SOL Price with live sparkline!',
  trending:    '✅ Added Trending Tokens — top 5 movers from your DEX!',
  social_feed: '✅ Added Community Feed with live posts!',
  wallet:      '✅ Added Wallet Tracker — edit it to set your address.',
  price_chart: '✅ Added the price chart with 24h history!',
  kol_feed:    '✅ Added KOL Activity — tracking big wallet moves!',
  fear_greed:  '✅ Added Fear & Greed Index!',
  volume_bar:  '✅ Added Volume Tracker!',
};

export function AIWidgetPanel({ onClose, widgets, setWidgets }: {
  onClose: () => void;
  widgets: WidgetConfig[];
  setWidgets: (w: WidgetConfig[]) => void;
}) {
  const [tab, setTab]     = useState<'chat' | 'my' | 'lib'>('chat');
  const [msgs, setMsgs]   = useState<Msg[]>([{ role: 'ai', text: '👋 Tell me what widget you want!\n• "Live SOL price chart"\n• "Trending tokens by volume"\n• "Track wallet ABC…"\n• "Fear & greed index"\n• "KOL whale alerts"' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy]   = useState(false);
  const bottomRef         = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const makeWidget = useCallback((key: string, extra: Record<string, any> = {}): WidgetConfig => {
    const tmpl = TEMPLATES[key] ?? TEMPLATES.sol_price;
    return { ...tmpl, id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, pos: widgets.length, params: { ...tmpl.params, ...extra }, title: extra.title ?? tmpl.title };
  }, [widgets.length]);

  const pushWidget = useCallback((w: WidgetConfig) => {
    const next = [...widgets, w]; setWidgets(next); writeWidgets(next);
  }, [widgets, setWidgets]);

  const removeWidget = useCallback((id: string) => {
    const next = widgets.filter(w => w.id !== id).map((w, i) => ({ ...w, pos: i }));
    setWidgets(next); writeWidgets(next);
  }, [widgets, setWidgets]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMsgs(prev => [...prev, { role: 'user', text }]);
    setBusy(true);
    try {
      const aiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY ?? '';
      if (!aiKey) throw new Error('no key');
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini', max_tokens: 250,
          messages: [
            { role: 'system', content: 'You are an AI widget builder for OGScan (Solana crypto platform). Widget types: sol_price, trending, social_feed, wallet, price_chart, kol_feed, fear_greed, volume_bar. Sizes: sm|md|lg. Respond ONLY with JSON: {"type":"...","title":"...","params":{},"size":"sm","reply":"..."}. For price_chart add params.symbol. For wallet add params.address. For trending add params.limit.' },
            { role: 'user', content: text }
          ]
        })
      });
      const j = await res.json();
      const parsed = JSON.parse(j.choices[0].message.content.trim().replace(/```json|```/g, ''));
      const w = makeWidget(parsed.type ?? 'sol_price', { ...parsed.params, title: parsed.title });
      pushWidget(w);
      setMsgs(prev => [...prev, { role: 'ai', text: parsed.reply ?? `✅ Added "${w.title}" to your hub!` }]);
    } catch {
      const { key, extra } = matchIntent(text);
      const w = makeWidget(key, extra);
      pushWidget(w);
      setMsgs(prev => [...prev, { role: 'ai', text: AI_REPLIES[key] ?? '✅ Widget added to your hub!' }]);
    }
    setBusy(false);
  }, [input, busy, makeWidget, pushWidget]);

  return (
    <div className="awp-overlay" onClick={onClose}>
      <div className="awp-panel" onClick={e => e.stopPropagation()}>
        <div className="awp-handle" />
        <div className="awp-title-row">
          <span className="awp-title-text">✦ Widget Studio</span>
          <button className="awp-close" onClick={onClose}>✕</button>
        </div>
        <div className="awp-tabs">
          {(['chat', 'my', 'lib'] as const).map(t => (
            <button key={t} className={`awp-tab ${tab === t ? 'awp-tab-on' : ''}`} onClick={() => setTab(t)}>
              {t === 'chat' ? '🤖 AI Chat' : t === 'my' ? `📦 My Widgets${widgets.length ? ` (${widgets.length})` : ''}` : '📚 Library'}
            </button>
          ))}
        </div>
        {tab === 'chat' && (
          <>
            <div className="awp-msgs">
              {msgs.map((m, i) => (
                <div key={i} className={`awp-msg awp-msg-${m.role}`}>
                  {m.role === 'ai' && <div className="awp-avatar">⬡</div>}
                  <div className="awp-bubble">{m.text.split('\n').map((ln, j) => <div key={j}>{ln}</div>)}</div>
                </div>
              ))}
              {busy && <div className="awp-msg awp-msg-ai"><div className="awp-avatar">⬡</div><div className="awp-bubble awp-dots"><span /><span /><span /></div></div>}
              <div ref={bottomRef} />
            </div>
            <div className="awp-input-row">
              <input className="awp-input" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Describe a widget…" disabled={busy} />
              <button className="awp-send-btn" onClick={send} disabled={!input.trim() || busy}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>
              </button>
            </div>
            <div className="awp-pills">
              {['SOL price chart', 'Trending tokens', 'Fear & greed', 'KOL whale alerts', 'Community feed'].map(q => (
                <button key={q} className="awp-pill" onClick={() => setInput(q)}>{q}</button>
              ))}
            </div>
          </>
        )}
        {tab === 'my' && (
          <div className="awp-list">
            {widgets.length === 0 ? <div className="awp-empty">No widgets yet — ask AI or browse the library!</div>
              : widgets.map(w => (
                <div key={w.id} className="awp-list-item">
                  <div className="awp-list-icon">{LIB_ICONS[w.type] ?? '📊'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="awp-list-name">{w.title}</div>
                    <div className="awp-list-meta">{w.type} · {w.size}</div>
                  </div>
                  <button className="awp-del-btn" onClick={() => removeWidget(w.id)}>✕</button>
                </div>
              ))}
          </div>
        )}
        {tab === 'lib' && (
          <div className="awp-list">
            {Object.entries(TEMPLATES).map(([key, tmpl]) => (
              <button key={key} className="awp-lib-row" onClick={() => { pushWidget(makeWidget(key)); setTab('my'); }}>
                <div className="awp-list-icon">{LIB_ICONS[key] ?? '📊'}</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div className="awp-list-name">{tmpl.title}</div>
                  <div className="awp-list-meta">Size: {tmpl.size}</div>
                </div>
                <div className="awp-add-badge">+ Add</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mobile Widget Grid ─────────────────────────────────────────────────────
export function MobileWidgetGrid({ solPrice, solChange, trending, widgets, setWidgets, onOpenPanel }: {
  solPrice: number | null; solChange: number | null;
  trending: { mint: string; symbol: string; change24h: number | null }[];
  widgets: WidgetConfig[]; setWidgets: (w: WidgetConfig[]) => void; onOpenPanel: () => void;
}) {
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const onDrop = useCallback((toId: string) => {
    const fromId = dragId.current;
    if (!fromId || fromId === toId) return;
    const next = [...widgets];
    const fi = next.findIndex(w => w.id === fromId), ti = next.findIndex(w => w.id === toId);
    if (fi < 0 || ti < 0) return;
    const [moved] = next.splice(fi, 1); next.splice(ti, 0, moved);
    const reindexed = next.map((w, i) => ({ ...w, pos: i }));
    setWidgets(reindexed); writeWidgets(reindexed);
  }, [widgets, setWidgets]);
  const removeWidget = useCallback((id: string) => {
    const next = widgets.filter(w => w.id !== id).map((w, i) => ({ ...w, pos: i }));
    setWidgets(next); writeWidgets(next);
  }, [widgets, setWidgets]);
  const up = (solChange ?? 0) >= 0;
  return (
    <div className="mwg-wrap">
      <div className="mwg-toprow">
        <span className="mwg-heading">My Hub</span>
        <button className="mwg-add-btn" onClick={onOpenPanel}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11H13V5a1 1 0 00-2 0v6H5a1 1 0 000 2h6v6a1 1 0 002 0v-6h6a1 1 0 000-2z" /></svg>
          AI Widgets
        </button>
      </div>
      <div className="mwg-grid">
        <div className="mwg-card mwg-sol-card">
          <div className="mwg-card-lbl">◎ Solana</div>
          <div className="mwg-card-val">{solPrice ? `$${solPrice >= 1000 ? solPrice.toFixed(0) : solPrice.toFixed(2)}` : '—'}</div>
          {solChange !== null && <div className="mwg-card-sub" style={{ color: up ? '#34d399' : '#fb7185' }}>{up ? '▲' : '▼'} {Math.abs(solChange).toFixed(2)}%</div>}
        </div>
        <div className="mwg-card mwg-trend-card">
          <div className="mwg-card-lbl">🔥 Trending</div>
          {trending.slice(0, 3).map((t, i) => (
            <a key={t.mint ?? i} href="/ORBITX_DEX" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, textDecoration: 'none' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>${t.symbol}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: (t.change24h ?? 0) >= 0 ? '#34d399' : '#fb7185' }}>{(t.change24h ?? 0) >= 0 ? '+' : ''}{(t.change24h ?? 0).toFixed(0)}%</span>
            </a>
          ))}
        </div>
        {[...widgets].sort((a, b) => a.pos - b.pos).map(widget => (
          <div key={widget.id}
            className={`mwg-card mwg-custom-card${dragOver === widget.id ? ' mwg-drag-over' : ''}`}
            style={{ gridColumn: widget.size !== 'sm' ? 'span 2' : 'span 1' }}
            draggable
            onDragStart={() => { dragId.current = widget.id; }}
            onDragOver={e => { e.preventDefault(); setDragOver(widget.id); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => { onDrop(widget.id); setDragOver(null); dragId.current = null; }}
            onDragEnd={() => { setDragOver(null); dragId.current = null; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="mwg-card-lbl">{widget.title}</span>
              <button className="mwg-rm-btn" onClick={() => removeWidget(widget.id)}>✕</button>
            </div>
            <WidgetRenderer widget={widget} />
          </div>
        ))}
        <button className="mwg-card mwg-add-card" onClick={onOpenPanel}>
          <div style={{ fontSize: 22, marginBottom: 3 }}>✦</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.6)' }}>Add Widget</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', marginTop: 1 }}>AI-powered</div>
        </button>
      </div>
    </div>
  );
}

// ── Mobile bottom nav ──────────────────────────────────────────────────────
export function MobileNav({ onOpenPanel }: { onOpenPanel: () => void }) {
  const items = [
    { label: 'Hub',     href: '/app' },
    { label: 'DEX',     href: '/ORBITX_DEX' },
    { label: 'Social',  href: '/orbitx-social' },
    { label: 'KOL',     href: '/app/kol-tracker' },
    { label: 'Profile', href: '/profile' },
  ];
  return (
    <nav className="mob-nav">
      {items.slice(0, 2).map(it => <a key={it.label} href={it.href} className="mob-nav-btn"><span style={{ fontSize: 18 }}>{'Hub DEX Social KOL Profile'.split(' ').map((l, i) => ['⊞','◈','◉','⬡','◎'][i])[items.findIndex(x => x.label === it.label)]}</span><span>{it.label}</span></a>)}
      <button className="mob-nav-plus" onClick={onOpenPanel}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11H13V5a1 1 0 00-2 0v6H5a1 1 0 000 2h6v6a1 1 0 002 0v-6h6a1 1 0 000-2z" /></svg>
      </button>
      {items.slice(2).map(it => <a key={it.label} href={it.href} className="mob-nav-btn"><span style={{ fontSize: 18 }}>{'Hub DEX Social KOL Profile'.split(' ').map((l, i) => ['⊞','◈','◉','⬡','◎'][i])[items.findIndex(x => x.label === it.label)]}</span><span>{it.label}</span></a>)}
    </nav>
  );
}

// ── CSS ────────────────────────────────────────────────────────────────────
export const aiWidgetCSS = `
.awp-overlay{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);display:flex;align-items:flex-end;justify-content:center;animation:awp-bg .2s ease both}
@keyframes awp-bg{from{opacity:0}to{opacity:1}}
.awp-panel{width:100%;max-width:540px;border-radius:26px 26px 0 0;background:linear-gradient(180deg,rgba(20,22,28,.99),rgba(10,12,16,.99));border:1px solid rgba(255,255,255,.11);border-bottom:0;box-shadow:0 -24px 70px rgba(0,0,0,.85);display:flex;flex-direction:column;max-height:88vh;overflow:hidden;animation:awp-up .32s cubic-bezier(.34,1.56,.64,1) both}
@keyframes awp-up{from{transform:translateY(100%)}to{transform:none}}
.awp-handle{width:36px;height:4px;border-radius:99px;background:rgba(255,255,255,.18);margin:12px auto 0;flex-shrink:0}
.awp-title-row{display:flex;align-items:center;justify-content:space-between;padding:10px 18px 0;flex-shrink:0}
.awp-title-text{font-size:16px;font-weight:900;color:#fff;letter-spacing:-.01em}
.awp-close{width:28px;height:28px;border-radius:99px;background:rgba(255,255,255,.1);border:0;color:rgba(255,255,255,.6);cursor:pointer;font-size:11px;display:grid;place-items:center;transition:all .15s;font-family:inherit}
.awp-close:hover{background:rgba(255,255,255,.2);color:#fff}
.awp-tabs{display:flex;padding:10px 16px 0;gap:4px;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0}
.awp-tab{flex:1;padding:8px 4px;border:0;border-bottom:2px solid transparent;border-radius:8px 8px 0 0;background:transparent;color:rgba(255,255,255,.4);font-size:11px;font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit}
.awp-tab-on{color:#fff;border-bottom-color:#2F80FF;background:rgba(47,128,255,.1)}
.awp-msgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;min-height:0}
.awp-msg{display:flex;gap:8px;align-items:flex-start}
.awp-msg-user{flex-direction:row-reverse}
.awp-avatar{width:28px;height:28px;border-radius:99px;background:linear-gradient(135deg,#2F80FF,#9945FF);display:grid;place-items:center;font-size:13px;flex-shrink:0;margin-top:1px}
.awp-bubble{max-width:84%;padding:10px 14px;border-radius:16px;font-size:13px;line-height:1.5}
.awp-msg-ai .awp-bubble{background:rgba(47,128,255,.11);border:1px solid rgba(47,128,255,.18);color:#d6eaff;border-radius:4px 16px 16px 16px}
.awp-msg-user .awp-bubble{background:linear-gradient(135deg,#2F80FF,#1a5cd4);color:#fff;border-radius:16px 4px 16px 16px;margin-left:auto}
.awp-dots{display:flex;gap:5px;align-items:center;padding:12px 16px!important}
.awp-dots span{width:6px;height:6px;border-radius:99px;background:#5aa2ff;animation:awp-dot 1.2s ease infinite}
.awp-dots span:nth-child(2){animation-delay:.2s}.awp-dots span:nth-child(3){animation-delay:.4s}
@keyframes awp-dot{0%,60%,100%{transform:none}30%{transform:translateY(-6px)}}
.awp-input-row{display:flex;gap:8px;padding:10px 16px 6px;border-top:1px solid rgba(255,255,255,.07);flex-shrink:0}
.awp-input{flex:1;border:1px solid rgba(255,255,255,.12);border-radius:13px;background:rgba(255,255,255,.06);color:#fff;padding:10px 14px;font-size:13px;outline:0;font-family:inherit;transition:border-color .15s}
.awp-input:focus{border-color:rgba(47,128,255,.5);background:rgba(47,128,255,.07)}
.awp-input::placeholder{color:rgba(255,255,255,.28)}
.awp-input:disabled{opacity:.5}
.awp-send-btn{width:40px;height:40px;flex-shrink:0;border-radius:13px;background:linear-gradient(135deg,#2F80FF,#1a5cd4);border:0;color:#fff;cursor:pointer;display:grid;place-items:center;transition:opacity .15s}
.awp-send-btn:disabled{opacity:.35;cursor:default}
.awp-pills{display:flex;gap:6px;padding:0 16px 14px;flex-wrap:wrap;flex-shrink:0}
.awp-pill{padding:5px 12px;border-radius:99px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.05);color:rgba(255,255,255,.65);font-size:10px;font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit}
.awp-pill:hover{border-color:rgba(47,128,255,.45);background:rgba(47,128,255,.1);color:#fff}
.awp-list{flex:1;overflow-y:auto;padding:10px 16px 16px;display:flex;flex-direction:column;gap:7px}
.awp-empty{font-size:13px;color:rgba(255,255,255,.33);text-align:center;padding:40px 0}
.awp-list-item{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
.awp-list-icon{width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.07);display:grid;place-items:center;font-size:18px;flex-shrink:0}
.awp-list-name{font-size:13px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.awp-list-meta{font-size:9px;font-weight:700;color:rgba(255,255,255,.33);text-transform:uppercase;letter-spacing:.07em;margin-top:2px}
.awp-del-btn{width:28px;height:28px;background:rgba(251,113,133,.13);border:1px solid rgba(251,113,133,.28);color:#fb7185;border-radius:8px;cursor:pointer;font-size:11px;display:grid;place-items:center;flex-shrink:0;font-family:inherit}
.awp-lib-row{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);cursor:pointer;transition:all .15s;width:100%;font-family:inherit}
.awp-lib-row:hover{background:rgba(47,128,255,.1);border-color:rgba(47,128,255,.3)}
.awp-add-badge{font-size:10px;font-weight:800;color:#5aa2ff;padding:5px 11px;border-radius:8px;background:rgba(47,128,255,.14);flex-shrink:0}
.mwg-wrap{width:100%;padding-bottom:90px}
.mwg-toprow{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 10px}
.mwg-heading{font-size:20px;font-weight:900;color:#fff;letter-spacing:-.02em}
.mwg-add-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border-radius:12px;border:1px solid rgba(47,128,255,.38);background:rgba(47,128,255,.11);color:#5aa2ff;font-size:12px;font-weight:800;cursor:pointer;transition:all .15s;font-family:inherit}
.mwg-add-btn:hover{background:rgba(47,128,255,.22);color:#fff}
.mwg-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;padding:0 14px}
.mwg-card{border-radius:18px;padding:14px 15px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(160deg,rgba(26,30,40,.8),rgba(10,12,16,.9));backdrop-filter:blur(20px) saturate(150%);transition:border-color .2s,transform .2s}
.mwg-card:hover{border-color:rgba(47,128,255,.28);transform:translateY(-1px)}
.mwg-card-lbl{font-size:9px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:6px}
.mwg-card-val{font-size:26px;font-weight:900;letter-spacing:-.03em;color:#fff;font-variant-numeric:tabular-nums}
.mwg-card-sub{font-size:11px;font-weight:800;margin-top:2px}
.mwg-sol-card,.mwg-trend-card{grid-column:span 1}
.mwg-custom-card{cursor:grab;position:relative}
.mwg-custom-card:active{cursor:grabbing;opacity:.85}
.mwg-drag-over{border-color:#2F80FF!important;box-shadow:0 0 0 2px rgba(47,128,255,.28)}
.mwg-rm-btn{background:none;border:0;color:rgba(255,255,255,.28);font-size:11px;cursor:pointer;padding:2px;line-height:1;transition:color .15s;font-family:inherit}
.mwg-rm-btn:hover{color:#fb7185}
.mwg-add-card{border-style:dashed!important;border-color:rgba(255,255,255,.13)!important;background:rgba(255,255,255,.02)!important;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:88px;transition:all .2s}
.mwg-add-card:hover{border-color:rgba(47,128,255,.38)!important;background:rgba(47,128,255,.07)!important}
@media(min-width:768px){.mwg-wrap{display:none}}
.mob-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:100;background:rgba(10,12,16,.94);backdrop-filter:blur(28px) saturate(180%);border-top:1px solid rgba(255,255,255,.09);padding:8px 8px max(12px,env(safe-area-inset-bottom,12px));justify-content:space-around;align-items:center;gap:4px}
@media(max-width:767px){.mob-nav{display:flex}}
.mob-nav-btn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;border-radius:10px;color:rgba(255,255,255,.42);text-decoration:none;font-size:9px;font-weight:700;min-width:46px;transition:all .15s}
.mob-nav-btn:hover{color:#5aa2ff;background:rgba(47,128,255,.1)}
.mob-nav-plus{width:46px;height:40px;border-radius:14px;background:linear-gradient(135deg,#2F80FF,#9945FF);border:0;color:#fff;cursor:pointer;display:grid;place-items:center;box-shadow:0 4px 18px rgba(47,128,255,.45);transition:all .2s;flex-shrink:0;font-family:inherit}
.mob-nav-plus:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(47,128,255,.6)}
@media(max-width:767px){
  .desktop-body{padding:8px 0 8px;justify-content:flex-start;align-items:flex-start;overflow-y:auto}
  .desktop-flex{flex-direction:column-reverse;gap:0;padding:0;width:100%}
  .app-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:12px 14px;width:100%;max-width:none;justify-items:center}
  .mac-icon{width:50px;height:50px;border-radius:11px}
  .mac-icon-glyph{width:25px;height:25px}
  .desktop-icon-label{font-size:10px}
  .hub-greeting{padding:0 16px}
  .hub-greet-line{font-size:17px}
  .hub-greet-sub{display:none}
  .mac-dock-container{display:none!important}
  .widgets-col{display:none}
}
`;
