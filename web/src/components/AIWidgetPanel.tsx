import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export type WidgetType =
  | 'sol_price' | 'trending' | 'social_feed' | 'wallet' | 'price_chart'
  | 'kol_feed' | 'fear_greed' | 'volume_bar' | 'dex_chart' | 'token_info'
  | 'wallet_portfolio' | 'wallet_tracker' | 'top_traders' | 'custom_code';

export interface WidgetConfig {
  id: string; type: WidgetType; title: string;
  params: Record<string, string | number | boolean>;
  size: 'sm' | 'md' | 'lg'; pos: number;
}

const WG_KEY = 'og_hub_widgets_v2';
export const readWidgets = (): WidgetConfig[] => {
  try { return JSON.parse(localStorage.getItem(WG_KEY) ?? '[]'); } catch { return []; }
};
const writeWidgets = (w: WidgetConfig[]) => localStorage.setItem(WG_KEY, JSON.stringify(w));

const TEMPLATES: Record<string, Omit<WidgetConfig, 'id' | 'pos'>> = {
  sol_price:        { type: 'sol_price',        title: 'SOL Price',        params: {},                                       size: 'sm' },
  trending:         { type: 'trending',          title: 'Trending Tokens',  params: { limit: 5 },                            size: 'md' },
  social_feed:      { type: 'social_feed',       title: 'Community Feed',   params: { channel: 'social-general', limit: 3 }, size: 'md' },
  wallet:           { type: 'wallet',            title: 'Wallet Tracker',   params: { address: '' },                        size: 'sm' },
  price_chart:      { type: 'price_chart',       title: 'SOL Chart',        params: { symbol: 'SOL', days: 1 },              size: 'lg' },
  dex_chart:        { type: 'dex_chart',         title: 'DEX Pair Chart',   params: { symbol: 'SOL' },                      size: 'lg' },
  token_info:       { type: 'token_info',        title: 'Token Info',       params: { symbol: 'SOL' },                      size: 'md' },
  wallet_portfolio: { type: 'wallet_portfolio',  title: 'Portfolio',        params: { address: '' },                        size: 'lg' },
  wallet_tracker:   { type: 'wallet_tracker',    title: 'Wallet Tracker',   params: { address: '', view: 'all' },           size: 'lg' },
  kol_feed:         { type: 'kol_feed',          title: 'KOL Alerts',       params: { limit: 5 },                           size: 'md' },
  fear_greed:       { type: 'fear_greed',        title: 'Fear & Greed',     params: {},                                     size: 'sm' },
  volume_bar:       { type: 'volume_bar',        title: 'Volume Tracker',   params: { symbol: 'SOL' },                      size: 'md' },
  top_traders:      { type: 'top_traders',       title: 'Top Traders',      params: { limit: 5 },                           size: 'md' },
};

const LIB_ICONS: Record<string, string> = {
  sol_price: '◎', trending: '🔥', social_feed: '💬', wallet: '👛',
  price_chart: '📈', dex_chart: '📊', token_info: '🔍', wallet_portfolio: '💼',
  kol_feed: '🐋', fear_greed: '🌡', volume_bar: '📉', top_traders: '🏆',
  custom_code: '⚡', wallet_tracker: '🔭',
};

type CmdResult = { key: string; extra: Record<string, string>; reply: string };

const SLASH_CMDS: Record<string, (a: string[]) => CmdResult> = {
  chart:     a => ({ key: 'price_chart',     extra: { symbol: a[0]?.toUpperCase() ?? 'SOL', days: '1', title: `${a[0]?.toUpperCase() ?? 'SOL'} Chart` },     reply: `✅ Added ${a[0]?.toUpperCase() ?? 'SOL'} price chart!` }),
  dex:       a => ({ key: 'dex_chart',       extra: { symbol: a[0]?.toUpperCase() ?? 'SOL', title: `${a[0]?.toUpperCase() ?? 'SOL'} DEX` },                  reply: `✅ Added ${a[0]?.toUpperCase() ?? 'SOL'} DEX pair from DexScreener!` }),
  wallet:    a => ({ key: 'wallet_tracker',  extra: { address: a[0] ?? '', view: a[1] ?? 'all', title: a[0] ? `🔭 Wallet ${a[0].slice(0,8)}…` : 'Wallet Tracker' }, reply: '✅ Added wallet tracker — buys, sells, holdings tabs!' }),
  portfolio: a => ({ key: 'wallet_portfolio',extra: { address: a[0] ?? '', title: a[0] ? `Portfolio ${a[0].slice(0,8)}…` : 'Portfolio' },                    reply: '✅ Added full portfolio view!' }),
  kol:       () => ({ key: 'kol_feed',       extra: { title: 'KOL Alerts' },                                                                                   reply: '✅ Added KOL whale alerts!' }),
  trending:  () => ({ key: 'trending',       extra: { title: 'Trending Tokens' },                                                                              reply: '✅ Added trending tokens!' }),
  fear:      () => ({ key: 'fear_greed',     extra: { title: 'Fear & Greed' },                                                                                 reply: '✅ Added Fear & Greed index!' }),
  sol:       () => ({ key: 'sol_price',      extra: { title: 'SOL Price' },                                                                                    reply: '✅ Added live SOL price!' }),
  top:       () => ({ key: 'top_traders',    extra: { title: 'Top Traders' },                                                                                  reply: '✅ Added top traders leaderboard!' }),
  volume:    a => ({ key: 'volume_bar',      extra: { symbol: a[0]?.toUpperCase() ?? 'SOL', title: `${a[0]?.toUpperCase() ?? 'SOL'} Volume` },                reply: '✅ Added volume tracker!' }),
  social:    () => ({ key: 'social_feed',    extra: { title: 'Community Feed' },                                                                               reply: '✅ Added community feed!' }),
  token:     a => ({ key: 'token_info',      extra: { symbol: a[0]?.toUpperCase() ?? 'SOL', title: `${a[0]?.toUpperCase() ?? 'SOL'} Info` },                  reply: `✅ Added $${a[0]?.toUpperCase() ?? 'SOL'} token info!` }),
};

const CMD_HELP = `⚡ Slash commands:
/chart SYMBOL — price chart (e.g. /chart BONK)
/dex SYMBOL — DEX pair from DexScreener (e.g. /dex JUP)
/wallet ADDRESS [view] — wallet tracker (view: holdings|buys|sells|all)
/portfolio ADDRESS — full token portfolio
/kol — KOL whale alerts
/trending — top trending tokens
/sol — SOL price widget
/fear — fear & greed index
/top — top traders leaderboard
/volume SYMBOL — 24h volume
/social — community feed
/token SYMBOL — token info card

@ shortcuts:
@SYMBOL — token chart (e.g. @BONK)
@kol [SYMBOL] — KOL alerts
@wallet ADDRESS — full wallet tracker`;

function parseCmd(input: string): CmdResult | 'help' | null {
  const t = input.trim();
  if (t.startsWith('/')) {
    const [cmd, ...args] = t.slice(1).split(/\s+/);
    if (cmd.toLowerCase() === 'help') return 'help';
    const handler = SLASH_CMDS[cmd.toLowerCase()];
    return handler ? handler(args) : null;
  }
  if (t.startsWith('@')) {
    const rest = t.slice(1);
    if (/^kol/i.test(rest)) {
      const sym = rest.split(/\s+/)[1];
      return { key: 'kol_feed', extra: sym ? { title: `KOL · $${sym.toUpperCase()}` } : { title: 'KOL Alerts' }, reply: '✅ Added KOL whale alerts!' };
    }
    const walletM = rest.match(/^wallet\s+([1-9A-HJ-NP-Za-km-z]{32,44})/i);
    if (walletM) return { key: 'wallet_tracker', extra: { address: walletM[1], view: 'all', title: `🔭 Wallet ${walletM[1].slice(0,8)}…` }, reply: '✅ Added wallet tracker!' };
    const addrM = rest.match(/^([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (addrM) return { key: 'wallet_tracker', extra: { address: addrM[1], view: 'all', title: `🔭 Wallet ${addrM[1].slice(0,8)}…` }, reply: '✅ Added wallet tracker!' };
    const sym = rest.match(/^([A-Za-z]{2,8})$/);
    if (sym) return { key: 'dex_chart', extra: { symbol: sym[1].toUpperCase(), title: `${sym[1].toUpperCase()} Chart` }, reply: `✅ Added $${sym[1].toUpperCase()} chart!` };
  }
  return null;
}

const AI_SYSTEM = `You are an advanced AI widget builder for OGScan, a Solana DeFi platform.
Build ANY widget the user requests. Return ONLY valid JSON:
{
  "type": "custom_code"|"sol_price"|"trending"|"price_chart"|"dex_chart"|"wallet"|"wallet_portfolio"|"wallet_tracker"|"token_info"|"social_feed"|"kol_feed"|"fear_greed"|"volume_bar"|"top_traders",
  "title": "<concise title>",
  "size": "sm"|"md"|"lg",
  "params": {
    "symbol": "<token symbol if relevant>",
    "address": "<wallet/contract address if given>",
    "view": "all"|"holdings"|"buys"|"sells",
    "days": <1|7|30>,
    "limit": <number>,
    "code": "<JS arrow fn for custom_code ONLY>"
  },
  "reply": "<one friendly sentence>"
}

SIZES: sm=half-width compact, md=half-width normal, lg=full-width.
wallet_tracker: shows holdings/buys/sells/all. Use for 'track wallet', 'show buys', 'wallet activity'.
APIs: CoinGecko, DexScreener, /api/ogdex/screener, alternative.me/fng, Supabase.`;

function matchIntent(msg: string): { key: string; extra: Record<string, string> } {
  const m = msg.toLowerCase();
  if (m.includes('buy') || m.includes('sell') || (m.includes('wallet') && m.includes('track'))) {
    const addr = msg.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/)?.[0] ?? '';
    const view = m.includes('buy') ? 'buys' : m.includes('sell') ? 'sells' : m.includes('holding') ? 'holdings' : 'all';
    return { key: 'wallet_tracker', extra: { address: addr, view, title: addr ? `🔭 Wallet ${addr.slice(0,8)}…` : 'Wallet Tracker' } };
  }
  if (m.includes('portfolio')) {
    const addr = msg.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/)?.[0] ?? '';
    return { key: 'wallet_portfolio', extra: { address: addr } };
  }
  if (m.includes('dex') || m.includes('pair')) { const sym = msg.match(/\$?([A-Z]{2,8})/)?.[1] ?? 'SOL'; return { key: 'dex_chart', extra: { symbol: sym } }; }
  if (m.includes('top trader') || m.includes('leaderboard')) return { key: 'top_traders', extra: {} };
  if (m.includes('kol') || m.includes('whale'))               return { key: 'kol_feed',    extra: {} };
  if (m.includes('fear') || m.includes('greed'))              return { key: 'fear_greed',  extra: {} };
  if (m.includes('volume'))                                    return { key: 'volume_bar',  extra: {} };
  if (m.includes('chart') || m.includes('history')) { const sym = msg.match(/\$?([A-Z]{2,8})/)?.[1] ?? 'SOL'; return { key: 'price_chart', extra: { symbol: sym } }; }
  if (m.includes('wallet') || m.includes('balance')) { const addr = msg.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/)?.[0] ?? ''; return { key: 'wallet', extra: { address: addr } }; }
  if (m.includes('social') || m.includes('community')) return { key: 'social_feed', extra: {} };
  if (m.includes('trending') || m.includes('hot'))     return { key: 'trending',    extra: {} };
  return { key: 'sol_price', extra: {} };
}

function SolPriceWidget() {
  const [price, setPrice] = useState<number | null>(null);
  const [chg, setChg] = useState<number | null>(null);
  const [dots, setDots] = useState<number[]>([]);
  useEffect(() => {
    let live = true;
    const go = () => fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true')
      .then(r => r.json()).then(j => { if (!live || !j?.solana?.usd) return; const p = Number(j.solana.usd); setPrice(p); setChg(Number(j.solana.usd_24h_change ?? 0)); setDots(prev => [...prev.slice(-14), p]); }).catch(() => {});
    go(); const iv = setInterval(go, 30_000); return () => { live = false; clearInterval(iv); };
  }, []);
  const up = (chg ?? 0) >= 0, mn = Math.min(...dots), mx = Math.max(...dots);
  const norm = (v: number) => mx > mn ? (v - mn) / (mx - mn) : 0.5;
  return (<div><div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{price ? `$${price >= 1000 ? price.toFixed(0) : price.toFixed(2)}` : '—'}</div>{chg !== null && <div style={{ fontSize: 11, fontWeight: 800, color: up ? '#34d399' : '#fb7185', marginTop: 2 }}>{up ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}% 24h</div>}{dots.length > 2 && (<svg width="100%" height="32" viewBox="0 0 100 32" preserveAspectRatio="none" style={{ display: 'block', marginTop: 8 }}><polyline points={dots.map((d, i) => `${(i/(dots.length-1))*100},${32-norm(d)*26}`).join(' ')} fill="none" stroke={up?'#34d399':'#fb7185'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>)}</div>);
}

function PriceChartWidget({ params }: { params: Record<string, any> }) {
  const [data, setData] = useState<{ t: number; v: number }[]>([]);
  const sym = (params.symbol as string) ?? 'SOL', days = Number(params.days ?? 1);
  const cgId = sym.toLowerCase() === 'sol' ? 'solana' : sym.toLowerCase();
  useEffect(() => { let live = true; fetch(`https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}&interval=${days <= 1 ? 'hourly' : 'daily'}`).then(r => r.json()).then(d => { if (live && d?.prices) setData(d.prices.map(([t, v]: [number, number]) => ({ t, v }))); }).catch(() => {}); return () => { live = false; }; }, [cgId, days]);
  if (data.length < 2) return <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textAlign: 'center', padding: '16px 0' }}>Loading chart…</div>;
  const min = Math.min(...data.map(d => d.v)), max = Math.max(...data.map(d => d.v));
  const norm = (v: number) => max > min ? (v - min) / (max - min) : 0.5;
  const up = data[data.length-1].v >= data[0].v, pts = data.map((d, i) => `${(i/(data.length-1))*100},${56-norm(d.v)*48}`).join(' ');
  const pct = ((data[data.length-1].v - data[0].v) / data[0].v) * 100, last = data[data.length-1].v;
  return (<div><div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><div><span style={{ fontSize:14, fontWeight:900, color:'#fff' }}>${sym}</span><span style={{ fontSize:10, color:'rgba(255,255,255,.3)', marginLeft:6 }}>{days}d</span></div><span style={{ fontSize:13, fontWeight:800, color:up?'#34d399':'#fb7185' }}>{up?'+':''}{pct.toFixed(2)}%</span></div><div style={{ fontSize:20, fontWeight:900, color:'#fff', fontVariantNumeric:'tabular-nums', marginBottom:8 }}>${last>=1000?last.toFixed(0):last>=1?last.toFixed(2):last.toFixed(6)}</div><svg width="100%" height="56" viewBox="0 0 100 56" preserveAspectRatio="none"><defs><linearGradient id={`gc_${sym}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={up?'#34d399':'#fb7185'} stopOpacity="0.25"/><stop offset="100%" stopColor={up?'#34d399':'#fb7185'} stopOpacity="0"/></linearGradient></defs><polygon points={`0,56 ${pts} 100,56`} fill={`url(#gc_${sym})`}/><polyline points={pts} fill="none" stroke={up?'#34d399':'#fb7185'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg><div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}><span style={{ fontSize:9, color:'rgba(255,255,255,.3)' }}>{days}d ago</span><span style={{ fontSize:9, color:'rgba(255,255,255,.3)' }}>now</span></div></div>);
}

function DexChartWidget({ params }: { params: Record<string, any> }) {
  const [pair, setPair] = useState<any>(null), [err, setErr] = useState('');
  const sym = (params.symbol as string) ?? 'SOL';
  useEffect(() => { let live = true; fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(sym)}`).then(r => r.json()).then(d => { if (!live) return; const pairs = (d?.pairs ?? []).filter((p: any) => p.chainId === 'solana'); if (pairs.length > 0) setPair(pairs[0]); else setErr('No Solana pairs found'); }).catch(() => setErr('Failed to load')); return () => { live = false; }; }, [sym]);
  if (err) return <div style={{ fontSize:11, color:'#fb7185' }}>{err}</div>;
  if (!pair) return <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>Loading DEX data…</div>;
  const p24 = Number(pair.priceChange?.h24 ?? 0), up = p24 >= 0, price = Number(pair.priceUsd ?? 0);
  return (<div><div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}><div><div style={{ fontSize:14, fontWeight:900, color:'#fff' }}>{pair.baseToken?.symbol}/{pair.quoteToken?.symbol}</div><div style={{ fontSize:9, color:'rgba(255,255,255,.3)', textTransform:'uppercase' }}>{pair.dexId}</div></div><div style={{ textAlign:'right' }}><div style={{ fontSize:14, fontWeight:900, color:'#fff' }}>${price<0.001?price.toFixed(8):price<1?price.toFixed(4):price.toFixed(2)}</div><div style={{ fontSize:11, fontWeight:800, color:up?'#34d399':'#fb7185' }}>{up?'+':''}{p24.toFixed(2)}%</div></div></div><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>{[['24h Vol',pair.volume?.h24?`$${(Number(pair.volume.h24)/1e6).toFixed(2)}M`:'—'],['Liquidity',pair.liquidity?.usd?`$${(Number(pair.liquidity.usd)/1e6).toFixed(2)}M`:'—'],['Mkt Cap',pair.marketCap?`$${(Number(pair.marketCap)/1e6).toFixed(1)}M`:'—'],['Txns 24h',pair.txns?.h24?String((pair.txns.h24.buys??0)+(pair.txns.h24.sells??0)):'—']].map(([label, val]) => (<div key={label} style={{ background:'rgba(255,255,255,.04)', borderRadius:10, padding:'7px 10px' }}><div style={{ fontSize:8, color:'rgba(255,255,255,.35)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>{label}</div><div style={{ fontSize:12, fontWeight:800, color:'#fff', marginTop:2 }}>{val}</div></div>))}</div><a href={pair.url} target="_blank" rel="noopener" style={{ display:'block', marginTop:10, textAlign:'center', fontSize:10, color:'#5aa2ff', textDecoration:'none', fontWeight:700 }}>View on DexScreener →</a></div>);
}

function TokenInfoWidget({ params }: { params: Record<string, any> }) {
  const [info, setInfo] = useState<any>(null), sym = (params.symbol as string) ?? 'SOL';
  useEffect(() => { let live = true; fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(sym)}`).then(r => r.json()).then(d => { if (!live) return; const p = (d?.pairs ?? []).find((x: any) => x.chainId === 'solana' && x.baseToken?.symbol?.toUpperCase() === sym.toUpperCase()); if (p) setInfo(p); }).catch(() => {}); return () => { live = false; }; }, [sym]);
  if (!info) return <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>Loading {sym}…</div>;
  const chg = Number(info.priceChange?.h24 ?? 0), price = Number(info.priceUsd ?? 0);
  return (<div><div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10 }}><div style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#2F80FF,#9945FF)', display:'grid', placeItems:'center', fontSize:14, fontWeight:900, color:'#fff', flexShrink:0 }}>{sym[0]}</div><div><div style={{ fontSize:14, fontWeight:900, color:'#fff' }}>{sym}</div><div style={{ fontSize:11, fontWeight:800, color:chg>=0?'#34d399':'#fb7185' }}>{chg>=0?'+':''}{chg.toFixed(2)}% 24h</div></div><div style={{ marginLeft:'auto', textAlign:'right' }}><div style={{ fontSize:15, fontWeight:900, color:'#fff' }}>${price<0.001?price.toFixed(8):price<1?price.toFixed(4):price.toFixed(2)}</div></div></div>{info.baseToken?.address && <div style={{ fontSize:9, color:'rgba(255,255,255,.3)', fontFamily:'monospace', marginBottom:8, wordBreak:'break-all' }}>{(info.baseToken.address as string).slice(0,24)}…</div>}<a href={info.url} target="_blank" rel="noopener" style={{ fontSize:10, color:'#5aa2ff', textDecoration:'none', fontWeight:700 }}>View on DexScreener →</a></div>);
}

function WalletWidget({ params }: { params: Record<string, any> }) {
  const [bal, setBal] = useState<number | null>(null), [err, setErr] = useState(''), addr = (params.address as string) ?? '';
  useEffect(() => { if (!addr || addr.length < 32) return; const key = (import.meta as any).env?.VITE_HELIUS_API_KEY ?? ''; if (!key) { setErr('Helius key not configured'); return; } fetch(`https://api.helius.xyz/v0/addresses/${addr}/balances?api-key=${key}`).then(r => r.json()).then(d => { if (d?.nativeBalance !== undefined) setBal(d.nativeBalance / 1e9); }).catch(() => setErr('Fetch failed')); }, [addr]);
  if (!addr) return <div style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>No address set — edit widget.</div>;
  return (<div><div style={{ fontSize:10, color:'rgba(255,255,255,.35)', fontFamily:'monospace', marginBottom:4 }}>{addr.slice(0,8)}…{addr.slice(-6)}</div><div style={{ fontSize:24, fontWeight:900, color:'#fff' }}>{bal !== null ? `${bal.toFixed(3)} SOL` : err || 'Loading…'}</div></div>);
}

function WalletPortfolioWidget({ params }: { params: Record<string, any> }) {
  const [data, setData] = useState<any>(null), [err, setErr] = useState(''), addr = (params.address as string) ?? '';
  useEffect(() => { if (!addr || addr.length < 32) return; const key = (import.meta as any).env?.VITE_HELIUS_API_KEY ?? ''; if (!key) { setErr('Helius key not configured'); return; } fetch(`https://api.helius.xyz/v0/addresses/${addr}/balances?api-key=${key}`).then(r => r.json()).then(d => { if (d?.nativeBalance !== undefined) setData(d); }).catch(() => setErr('Fetch failed')); }, [addr]);
  if (!addr) return <div style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>No address set.</div>;
  if (err) return <div style={{ fontSize:11, color:'#fb7185' }}>{err}</div>;
  if (!data) return <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>Loading…</div>;
  const sol = data.nativeBalance / 1e9, tokens = (data.tokens ?? []).filter((t: any) => t.amount > 0).slice(0, 8);
  return (<div><div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}><span style={{ fontSize:10, color:'rgba(255,255,255,.4)', fontFamily:'monospace' }}>{addr.slice(0,8)}…{addr.slice(-4)}</span><span style={{ fontSize:15, fontWeight:900, color:'#fff' }}>{sol.toFixed(3)} SOL</span></div>{tokens.map((t: any) => (<div key={t.mint} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderTop:'1px solid rgba(255,255,255,.05)' }}><span style={{ fontSize:9, color:'rgba(255,255,255,.4)', fontFamily:'monospace' }}>{(t.mint as string).slice(0,10)}…</span><span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{(t.amount/Math.pow(10,t.decimals??6)).toFixed(2)}</span></div>))}{tokens.length===0&&<div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>No SPL tokens found</div>}</div>);
}

type WalletTab = 'holdings' | 'buys' | 'sells' | 'all';
function WalletTrackerWidget({ params }: { params: Record<string, any> }) {
  const [tab, setTab] = useState<WalletTab>((params.view as WalletTab) ?? 'all');
  const [balances, setBalances] = useState<any>(null), [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true), [err, setErr] = useState('');
  const addr = (params.address as string) ?? '';
  useEffect(() => {
    if (!addr || addr.length < 32) return;
    const key = (import.meta as any).env?.VITE_HELIUS_API_KEY ?? '';
    if (!key) { setErr('Helius key not configured'); setLoading(false); return; }
    setLoading(true);
    Promise.all([
      fetch(`https://api.helius.xyz/v0/addresses/${addr}/balances?api-key=${key}`).then(r => r.json()).then(setBalances).catch(() => {}),
      fetch(`https://api.helius.xyz/v0/addresses/${addr}/transactions?api-key=${key}&limit=30`).then(r => r.json()).then(d => { if (Array.isArray(d)) setTxns(d); }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [addr]);
  if (!addr) return <div style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>No wallet address. Use /wallet ADDRESS to set one.</div>;
  if (loading) return <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>Loading wallet data…</div>;
  if (err) return <div style={{ fontSize:11, color:'#fb7185' }}>{err}</div>;
  const sol = balances?.nativeBalance ? (balances.nativeBalance / 1e9).toFixed(3) : '0.000';
  const tokens = (balances?.tokens ?? []).filter((t: any) => t.amount > 0);
  const buys  = txns.filter((t: any) => (t.nativeTransfers ?? []).some((n: any) => n.fromUserAccount === addr));
  const sells = txns.filter((t: any) => (t.nativeTransfers ?? []).some((n: any) => n.toUserAccount === addr));
  const TABS: { key: WalletTab; label: string; color: string; count?: number }[] = [
    { key: 'all', label: 'All', color: '#5aa2ff' },
    { key: 'holdings', label: 'Holdings', color: '#34d399', count: tokens.length },
    { key: 'buys', label: 'Buys', color: '#34d399', count: buys.length },
    { key: 'sells', label: 'Sells', color: '#fb7185', count: sells.length },
  ];
  const show = (s: WalletTab) => tab === 'all' || tab === s;
  const sec = (first: boolean) => first ? {} : { marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' };
  return (
    <div>
      <div style={{ fontSize:9, color:'rgba(255,255,255,.3)', fontFamily:'monospace', marginBottom:8 }}>{addr.slice(0,10)}…{addr.slice(-6)}</div>
      <div style={{ display:'flex', gap:4, marginBottom:12 }}>
        {TABS.map(({ key, label, color, count }) => (<button key={key} onClick={() => setTab(key)} style={{ flex:1, padding:'5px 0', border:0, borderRadius:8, fontSize:9, fontWeight:700, background: tab===key?`${color}22`:'rgba(255,255,255,.04)', color: tab===key?color:'rgba(255,255,255,.35)', cursor:'pointer', textTransform:'uppercase', letterSpacing:'.06em', fontFamily:'inherit', borderBottom: tab===key?`2px solid ${color}`:'2px solid transparent' }}>{label}{count!==undefined&&count>0?` (${count})`:''}</button>))}
      </div>
      {show('holdings') && (<div style={sec(tab!=='all')}>{tab==='all'&&<div style={{ fontSize:9, fontWeight:900, color:'#34d399', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>◎ Holdings</div>}<div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}><span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.7)' }}>SOL</span><span style={{ fontSize:13, fontWeight:900, color:'#fff' }}>{sol}</span></div>{tokens.slice(0,6).map((t: any) => (<div key={t.mint} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderTop:'1px solid rgba(255,255,255,.04)' }}><span style={{ fontSize:9, color:'rgba(255,255,255,.4)', fontFamily:'monospace' }}>{(t.mint as string).slice(0,12)}…</span><span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{(t.amount/Math.pow(10,t.decimals??6)).toFixed(2)}</span></div>))}{tokens.length===0&&<div style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>No SPL tokens</div>}</div>)}
      {show('buys') && (<div style={sec(tab!=='all')}>{tab==='all'&&<div style={{ fontSize:9, fontWeight:900, color:'#34d399', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>↗ Recent Buys</div>}{buys.length===0?<div style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>No buy txns found</div>:buys.slice(0,5).map((t: any, i: number) => (<div key={t.signature} style={{ display:'flex', gap:6, alignItems:'center', padding:'4px 0', borderTop:i?'1px solid rgba(255,255,255,.04)':'none' }}><span style={{ fontSize:9, fontWeight:900, color:'#34d399', width:24 }}>BUY</span><span style={{ fontSize:9, color:'rgba(255,255,255,.4)', fontFamily:'monospace', flex:1 }}>{t.timestamp?new Date(t.timestamp*1000).toLocaleDateString():'—'}</span><a href={`https://solscan.io/tx/${t.signature}`} target="_blank" rel="noopener" style={{ fontSize:9, color:'#5aa2ff', textDecoration:'none' }}>view →</a></div>))}</div>)}
      {show('sells') && (<div style={sec(tab!=='all')}>{tab==='all'&&<div style={{ fontSize:9, fontWeight:900, color:'#fb7185', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>↘ Recent Sells</div>}{sells.length===0?<div style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>No sell txns found</div>:sells.slice(0,5).map((t: any, i: number) => (<div key={t.signature} style={{ display:'flex', gap:6, alignItems:'center', padding:'4px 0', borderTop:i?'1px solid rgba(255,255,255,.04)':'none' }}><span style={{ fontSize:9, fontWeight:900, color:'#fb7185', width:28 }}>SELL</span><span style={{ fontSize:9, color:'rgba(255,255,255,.4)', fontFamily:'monospace', flex:1 }}>{t.timestamp?new Date(t.timestamp*1000).toLocaleDateString():'—'}</span><a href={`https://solscan.io/tx/${t.signature}`} target="_blank" rel="noopener" style={{ fontSize:9, color:'#5aa2ff', textDecoration:'none' }}>view →</a></div>))}</div>)}
    </div>
  );
}

function TrendingWidget({ params }: { params: Record<string, any> }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { let live = true; fetch(`/api/ogdex/screener?type=trending&interval=24h&limit=${params.limit ?? 5}`).then(r => r.json()).then(d => { if (live && d?.rows) setRows(d.rows.slice(0,5)); }).catch(() => {}); return () => { live = false; }; }, []);
  return (<div>{rows.length===0?<div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>Loading…</div>:rows.map((r,i) => { const up=(r.change24h??0)>=0; return (<a key={r.mint??i} href="/ORBITX_DEX" style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', textDecoration:'none', borderTop:i?'1px solid rgba(255,255,255,.05)':'none' }}><span style={{ width:14, fontSize:10, fontWeight:900, color:'rgba(255,255,255,.3)' }}>{i+1}</span><span style={{ flex:1, fontSize:12, fontWeight:800, color:'#fff' }}>${r.symbol}</span><span style={{ fontSize:11, fontWeight:900, color:up?'#34d399':'#fb7185' }}>{up?'+':''}{(r.change24h??0).toFixed(1)}%</span></a>); })}</div>);
}

function SocialFeedWidget({ params }: { params: Record<string, any> }) {
  const [posts, setPosts] = useState<any[]>([]);
  useEffect(() => { let live = true; supabase.from('social_messages').select('id,username,content,created_at').eq('channel', params.channel ?? 'social-general').order('created_at', { ascending: false }).limit(params.limit ?? 3).then(({ data }) => { if (live && data) setPosts(data as any); }); return () => { live = false; }; }, []);
  return (<div>{posts.length===0?<div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>No posts yet</div>:posts.map((p,i) => (<a key={p.id} href="/social" style={{ display:'block', padding:'5px 0', textDecoration:'none', borderTop:i?'1px solid rgba(255,255,255,.05)':'none' }}><span style={{ fontSize:11, fontWeight:900, color:'#5aa2ff' }}>@{p.username??'anon'} </span><span style={{ fontSize:11, color:'rgba(255,255,255,.7)' }}>{p.content.slice(0,70)}{p.content.length>70?'…':''}</span></a>))}</div>);
}

function KOLFeedWidget({ params }: { params: Record<string, any> }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { let live = true; supabase.from('kol_alerts').select('id,wallet,token_symbol,action,amount_sol,created_at').order('created_at', { ascending: false }).limit(params.limit ?? 5).then(({ data }) => { if (live && data) setRows(data as any); }); return () => { live = false; }; }, []);
  return (<div>{rows.length===0?<div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>No KOL activity yet</div>:rows.map((r,i) => (<div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderTop:i?'1px solid rgba(255,255,255,.05)':'none' }}><span style={{ fontSize:10, color:r.action==='buy'?'#34d399':'#fb7185', fontWeight:900, textTransform:'uppercase', width:28 }}>{r.action}</span><span style={{ fontSize:12, fontWeight:800, color:'#fff', flex:1 }}>${r.token_symbol}</span><span style={{ fontSize:11, color:'rgba(255,255,255,.5)' }}>{Number(r.amount_sol).toFixed(1)} SOL</span></div>))}</div>);
}

function FearGreedWidget() {
  const [val, setVal] = useState<number | null>(null), [label, setLabel] = useState('');
  useEffect(() => { fetch('https://api.alternative.me/fng/').then(r => r.json()).then(d => { if (d?.data?.[0]) { setVal(Number(d.data[0].value)); setLabel(d.data[0].value_classification); } }).catch(() => {}); }, []);
  const color = val===null?'#888':val<25?'#fb7185':val<50?'#fbbf24':val<75?'#34d399':'#22d3ee';
  return (<div style={{ textAlign:'center', padding:'4px 0' }}><div style={{ fontSize:34, fontWeight:900, color, fontVariantNumeric:'tabular-nums' }}>{val??'—'}</div><div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.6)', marginTop:3 }}>{label||'Loading…'}</div><div style={{ fontSize:9, color:'rgba(255,255,255,.3)', marginTop:1 }}>Fear &amp; Greed Index</div></div>);
}

function VolumeBarWidget({ params }: { params: Record<string, any> }) {
  const [vol, setVol] = useState<number | null>(null);
  useEffect(() => { fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_vol=true').then(r => r.json()).then(j => { if (j?.solana) setVol(j.solana.usd_24h_vol??null); }).catch(() => {}); }, [params.symbol]);
  const fmt = (v: number) => v>1e9?`$${(v/1e9).toFixed(2)}B`:v>1e6?`$${(v/1e6).toFixed(1)}M`:`$${v.toFixed(0)}`;
  return (<div><div style={{ fontSize:22, fontWeight:900, color:'#fff' }}>{vol?fmt(vol):'—'}</div><div style={{ fontSize:10, color:'rgba(255,255,255,.35)', marginTop:4 }}>24h Volume</div></div>);
}

function TopTradersWidget({ params }: { params: Record<string, any> }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { let live = true; supabase.from('kol_alerts').select('wallet,token_symbol,amount_sol').order('amount_sol', { ascending: false }).limit(params.limit ?? 5).then(({ data }) => { if (live && data) setRows(data as any); }); return () => { live = false; }; }, []);
  const medals = ['🥇','🥈','🥉'];
  return (<div>{rows.length===0?<div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>No trader data yet</div>:rows.map((t,i) => (<div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderTop:i?'1px solid rgba(255,255,255,.05)':'none' }}><span style={{ fontSize:13, width:20 }}>{medals[i]??`${i+1}`}</span><span style={{ flex:1, fontSize:10, color:'rgba(255,255,255,.45)', fontFamily:'monospace' }}>{(t.wallet as string)?.slice(0,10)}…</span><span style={{ fontSize:11, fontWeight:800, color:'#34d399' }}>{Number(t.amount_sol).toFixed(1)} SOL</span></div>))}</div>);
}

function CustomCodeWidget({ params }: { params: Record<string, any> }) {
  const code = (params.code as string) ?? '', [error, setError] = useState('');
  const Component = useMemo(() => {
    if (!code) return null;
    try {
      const fn = new Function('React','useState','useEffect','useMemo','useCallback','fetch','supabase','params',`"use strict"; const Component = (${code}); return Component;`);
      return fn({ useState, useEffect, useMemo, useCallback },
        useState, useEffect, useMemo, useCallback, window.fetch.bind(window), supabase, params);
    } catch (e) { setError(String(e)); return null; }
  }, [code]);
  if (error) return <div style={{ fontSize:11, color:'#fb7185', wordBreak:'break-word' }}>⚠ {error}</div>;
  if (!Component) return <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>No code provided</div>;
  try { return <Component params={params} />; } catch (e) { return <div style={{ fontSize:11, color:'#fb7185' }}>⚠ {String(e)}</div>; }
}

function WidgetRenderer({ widget }: { widget: WidgetConfig }) {
  switch (widget.type) {
    case 'sol_price':        return <SolPriceWidget />;
    case 'trending':         return <TrendingWidget params={widget.params} />;
    case 'social_feed':      return <SocialFeedWidget params={widget.params} />;
    case 'wallet':           return <WalletWidget params={widget.params} />;
    case 'fear_greed':       return <FearGreedWidget />;
    case 'price_chart':      return <PriceChartWidget params={widget.params} />;
    case 'dex_chart':        return <DexChartWidget params={widget.params} />;
    case 'token_info':       return <TokenInfoWidget params={widget.params} />;
    case 'wallet_portfolio': return <WalletPortfolioWidget params={widget.params} />;
    case 'wallet_tracker':   return <WalletTrackerWidget params={widget.params} />;
    case 'kol_feed':         return <KOLFeedWidget params={widget.params} />;
    case 'volume_bar':       return <VolumeBarWidget params={widget.params} />;
    case 'top_traders':      return <TopTradersWidget params={widget.params} />;
    case 'custom_code':      return <CustomCodeWidget params={widget.params} />;
    default:                 return <div style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>Unknown widget</div>;
  }
}

interface Msg { role: 'user' | 'ai'; text: string; }

const FALLBACK_REPLIES: Record<string, string> = {
  sol_price: '✅ Added live SOL price!', trending: '✅ Added trending tokens!',
  price_chart: '✅ Added price chart!', dex_chart: '✅ Added DEX pair chart!',
  token_info: '✅ Added token info!', wallet: '✅ Added wallet tracker!',
  wallet_portfolio: '✅ Added full portfolio!', wallet_tracker: '✅ Added wallet tracker — buys, sells & holdings tabs!',
  kol_feed: '✅ Added KOL whale alerts!', fear_greed: '✅ Added Fear & Greed!',
  volume_bar: '✅ Added volume tracker!', top_traders: '✅ Added top traders!', social_feed: '✅ Added community feed!',
};

export function AIWidgetPanel({ onClose, widgets, setWidgets }: {
  onClose: () => void; widgets: WidgetConfig[]; setWidgets: (w: WidgetConfig[]) => void;
}) {
  const [tab, setTab] = useState<'chat' | 'my' | 'lib'>('chat');
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'ai', text: '⚡ Widget Studio — builds anything permanently to your hub.\n\nType naturally or use commands:\n• /chart BONK — price chart\n• /wallet ADDRESS — buys/sells/holdings\n• /dex JUP — DEX pair\n• @BONK — quick token chart\n• @kol — KOL whale alerts\n• /help — all commands' }]);
  const [input, setInput] = useState(''), [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const makeWidget = useCallback((key: string, extra: Record<string, any> = {}): WidgetConfig => {
    const tmpl = TEMPLATES[key] ?? TEMPLATES.sol_price;
    return { ...tmpl, id: `w_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, pos: widgets.length, params: { ...tmpl.params, ...extra }, title: extra.title ?? tmpl.title };
  }, [widgets.length]);

  const pushWidget = useCallback((w: WidgetConfig) => { const next = [...widgets, w]; setWidgets(next); writeWidgets(next); }, [widgets, setWidgets]);
  const removeWidget = useCallback((id: string) => { const next = widgets.filter(w => w.id !== id).map((w, i) => ({ ...w, pos: i })); setWidgets(next); writeWidgets(next); }, [widgets, setWidgets]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMsgs(prev => [...prev, { role: 'user', text }]);
    setBusy(true);
    const cmd = parseCmd(text);
    if (cmd === 'help') { setMsgs(prev => [...prev, { role: 'ai', text: CMD_HELP }]); setBusy(false); return; }
    if (cmd) { const w = makeWidget(cmd.key, cmd.extra); pushWidget(w); setMsgs(prev => [...prev, { role: 'ai', text: cmd.reply }]); setBusy(false); return; }
    try {
      const aiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY ?? '';
      if (!aiKey) throw new Error('no key');
      const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiKey}` }, body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 1200, temperature: 0.2, messages: [{ role: 'system', content: AI_SYSTEM }, ...msgs.slice(-6).map(m => ({ role: m.role==='ai'?'assistant':'user', content: m.text })), { role: 'user', content: text }] }) });
      const j = await res.json();
      const raw = j.choices?.[0]?.message?.content?.trim() ?? '';
      const parsed = JSON.parse(raw.replace(/^```(?:json)?\n?/,'').replace(/\n?```$/,'').trim());
      const w: WidgetConfig = { id: `w_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type: (parsed.type as WidgetType) ?? 'sol_price', title: parsed.title ?? 'AI Widget', params: parsed.params ?? {}, size: (parsed.size as any) ?? 'md', pos: widgets.length };
      pushWidget(w);
      setMsgs(prev => [...prev, { role: 'ai', text: parsed.reply ?? `✅ Added "${w.title}" permanently to your hub!` }]);
    } catch {
      const { key, extra } = matchIntent(text);
      const w = makeWidget(key, extra);
      pushWidget(w);
      setMsgs(prev => [...prev, { role: 'ai', text: FALLBACK_REPLIES[key] ?? '✅ Widget added permanently!' }]);
    }
    setBusy(false);
  }, [input, busy, msgs, widgets, makeWidget, pushWidget]);

  return (
    <div className="awp-overlay" onClick={onClose}>
      <div className="awp-panel" onClick={e => e.stopPropagation()}>
        <div className="awp-handle" />
        <div className="awp-title-row"><span className="awp-title-text">⚡ Widget Studio</span><button className="awp-close" onClick={onClose}>✕</button></div>
        <div className="awp-tabs">{(['chat','my','lib'] as const).map(t => (<button key={t} className={`awp-tab ${tab===t?'awp-tab-on':''}`} onClick={() => setTab(t)}>{t==='chat'?'🤖 AI Builder':t==='my'?`📦 My Widgets${widgets.length?` (${widgets.length})`:''}`:`📚 Library`}</button>))}</div>
        {tab === 'chat' && (<>
          <div className="awp-msgs">
            {msgs.map((m, i) => (<div key={i} className={`awp-msg awp-msg-${m.role}`}>{m.role==='ai'&&<div className="awp-avatar">⚡</div>}<div className="awp-bubble">{m.text.split('\n').map((ln, j) => <div key={j}>{ln}</div>)}</div></div>))}
            {busy && <div className="awp-msg awp-msg-ai"><div className="awp-avatar">⚡</div><div className="awp-bubble awp-dots"><span /><span /><span /></div></div>}
            <div ref={bottomRef} />
          </div>
          <div className="awp-input-row"><input className="awp-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Describe a widget, /cmd, or @mention…" disabled={busy} /><button className="awp-send-btn" onClick={send} disabled={!input.trim()||busy}><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg></button></div>
          <div className="awp-pills">{['/help','/chart BONK','/wallet','/dex JUP','@kol','/fear'].map(q => (<button key={q} className="awp-pill" onClick={() => setInput(q)}>{q}</button>))}</div>
        </>)}
        {tab === 'my' && (<div className="awp-list">{widgets.length===0?<div className="awp-empty">No widgets yet — try /help!</div>:widgets.map(w => (<div key={w.id} className="awp-list-item"><div className="awp-list-icon">{LIB_ICONS[w.type]??'📊'}</div><div style={{ flex:1, minWidth:0 }}><div className="awp-list-name">{w.title}</div><div className="awp-list-meta">{w.type} · {w.size}</div></div><button className="awp-del-btn" onClick={() => removeWidget(w.id)}>✕</button></div>))}</div>)}
        {tab === 'lib' && (<div className="awp-list">{Object.entries(TEMPLATES).map(([key, tmpl]) => (<button key={key} className="awp-lib-row" onClick={() => { pushWidget(makeWidget(key)); setTab('my'); }}><div className="awp-list-icon">{LIB_ICONS[key]??'📊'}</div><div style={{ flex:1, textAlign:'left' }}><div className="awp-list-name">{tmpl.title}</div><div className="awp-list-meta">Size: {tmpl.size}</div></div><div className="awp-add-badge">+ Add</div></button>))}</div>)}
      </div>
    </div>
  );
}

export function MobileWidgetGrid({ solPrice, solChange, trending, widgets, setWidgets, onOpenPanel }: {
  solPrice: number | null; solChange: number | null;
  trending: { mint: string; symbol: string; change24h: number | null }[];
  widgets: WidgetConfig[]; setWidgets: (w: WidgetConfig[]) => void; onOpenPanel: () => void;
}) {}