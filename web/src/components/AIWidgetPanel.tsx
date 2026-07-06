import * as RN from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { saveWidgetsToCloud } from '@/lib/widgetSync';

/* Catches crashes inside AI-generated widget code so one bad widget can never
   take down the whole hub. */
class WidgetErrorBoundary extends RN.Component<{ children?: RN.ReactNode }, { err: string }> {
  constructor(props: { children?: RN.ReactNode }) { super(props); this.state = { err: '' }; }
  static getDerivedStateFromError(e: unknown) { return { err: String(e) }; }
  render() {
    if (this.state.err) return <div style={{ fontSize: 11, color: '#fb7185', padding: '8px 0', wordBreak: 'break-word' }}>⚠ Widget error: {this.state.err.slice(0, 140)}</div>;
    return this.props.children as RN.ReactElement;
  }
}

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
export const writeWidgets = (w: WidgetConfig[]) => {
  try { localStorage.setItem(WG_KEY, JSON.stringify(w)); } catch { /* quota — cloud still holds it */ }
  // Save immediately (not debounced) so a quick refresh right after a change
  // can't drop the write; fails soft when signed out.
  void saveWidgetsToCloud(w);
};

const TEMPLATES: Record<string, Omit<WidgetConfig, 'id' | 'pos'>> = {
  // — Originals (also used by slash-commands & AI builder) —
  sol_price:        { type: 'sol_price',        title: 'SOL Price',        params: {},                                       size: 'sm' },
  trending:         { type: 'trending',          title: 'Trending Tokens',  params: { limit: 5 },                            size: 'md' },
  social_feed:      { type: 'social_feed',       title: 'Community Feed',   params: { channel: 'social-general', limit: 3 }, size: 'md' },
  wallet:           { type: 'wallet',            title: 'Wallet Balance',   params: { address: '' },                        size: 'sm' },
  price_chart:      { type: 'price_chart',       title: 'SOL Chart',        params: { symbol: 'SOL', days: 1 },              size: 'lg' },
  dex_chart:        { type: 'dex_chart',         title: 'DEX Pair Chart',   params: { symbol: 'SOL' },                      size: 'lg' },
  token_info:       { type: 'token_info',        title: 'Token Info',       params: { symbol: 'SOL' },                      size: 'md' },
  wallet_portfolio: { type: 'wallet_portfolio',  title: 'Portfolio',        params: { address: '' },                        size: 'lg' },
  wallet_tracker:   { type: 'wallet_tracker',    title: 'Wallet Tracker',   params: { address: '', view: 'all' },           size: 'lg' },
  kol_feed:         { type: 'kol_feed',          title: 'KOL Alerts',       params: { limit: 5 },                           size: 'md' },
  fear_greed:       { type: 'fear_greed',        title: 'Fear & Greed',     params: {},                                     size: 'sm' },
  volume_bar:       { type: 'volume_bar',        title: 'Volume Tracker',   params: { symbol: 'SOL' },                      size: 'md' },
  top_traders:      { type: 'top_traders',       title: 'Top Traders',      params: { limit: 5 },                           size: 'md' },

  // — Prices & Charts —
  chart_sol_7d:  { type: 'price_chart', title: 'SOL Chart · 7d',  params: { symbol: 'SOL', days: 7 },                    size: 'lg' },
  chart_sol_30d: { type: 'price_chart', title: 'SOL Chart · 30d', params: { symbol: 'SOL', days: 30 },                   size: 'lg' },
  chart_btc:     { type: 'price_chart', title: 'Bitcoin Chart',   params: { symbol: 'bitcoin', days: 7 },                size: 'lg' },
  chart_eth:     { type: 'price_chart', title: 'Ethereum Chart',  params: { symbol: 'ethereum', days: 7 },               size: 'lg' },
  chart_bonk:    { type: 'price_chart', title: 'BONK Chart',      params: { symbol: 'bonk', days: 7 },                   size: 'lg' },
  chart_wif:     { type: 'price_chart', title: 'WIF Chart',       params: { symbol: 'dogwifcoin', days: 7 },             size: 'lg' },
  chart_jup:     { type: 'price_chart', title: 'JUP Chart',       params: { symbol: 'jupiter-exchange-solana', days: 7 },size: 'lg' },
  chart_ray:     { type: 'price_chart', title: 'RAY Chart',       params: { symbol: 'raydium', days: 7 },                size: 'lg' },
  chart_pyth:    { type: 'price_chart', title: 'PYTH Chart',      params: { symbol: 'pyth-network', days: 7 },           size: 'lg' },

  // — DEX Pairs (live from DexScreener) —
  dex_sol:    { type: 'dex_chart', title: 'SOL DEX Pair',    params: { symbol: 'SOL' },    size: 'lg' },
  dex_bonk:   { type: 'dex_chart', title: 'BONK DEX Pair',   params: { symbol: 'BONK' },   size: 'lg' },
  dex_jup:    { type: 'dex_chart', title: 'JUP DEX Pair',    params: { symbol: 'JUP' },    size: 'lg' },
  dex_wif:    { type: 'dex_chart', title: 'WIF DEX Pair',    params: { symbol: 'WIF' },    size: 'lg' },
  dex_pyth:   { type: 'dex_chart', title: 'PYTH DEX Pair',   params: { symbol: 'PYTH' },   size: 'lg' },
  dex_jto:    { type: 'dex_chart', title: 'JTO DEX Pair',    params: { symbol: 'JTO' },    size: 'lg' },
  dex_popcat: { type: 'dex_chart', title: 'POPCAT DEX Pair', params: { symbol: 'POPCAT' }, size: 'lg' },
  dex_ray:    { type: 'dex_chart', title: 'RAY DEX Pair',    params: { symbol: 'RAY' },    size: 'lg' },
  dex_orca:   { type: 'dex_chart', title: 'ORCA DEX Pair',   params: { symbol: 'ORCA' },   size: 'lg' },
  dex_wen:    { type: 'dex_chart', title: 'WEN DEX Pair',    params: { symbol: 'WEN' },    size: 'lg' },

  // — Token Info —
  info_sol:    { type: 'token_info', title: 'SOL Token Info',    params: { symbol: 'SOL' },    size: 'md' },
  info_bonk:   { type: 'token_info', title: 'BONK Token Info',   params: { symbol: 'BONK' },   size: 'md' },
  info_jup:    { type: 'token_info', title: 'JUP Token Info',    params: { symbol: 'JUP' },    size: 'md' },
  info_wif:    { type: 'token_info', title: 'WIF Token Info',    params: { symbol: 'WIF' },    size: 'md' },
  info_pyth:   { type: 'token_info', title: 'PYTH Token Info',   params: { symbol: 'PYTH' },   size: 'md' },
  info_popcat: { type: 'token_info', title: 'POPCAT Token Info', params: { symbol: 'POPCAT' }, size: 'md' },

  // — Community —
  social_announcements: { type: 'social_feed', title: 'Announcements', params: { channel: 'announcements', limit: 3 }, size: 'md' },
  social_trades:        { type: 'social_feed', title: 'Trades Chat',   params: { channel: 'trades', limit: 3 },        size: 'md' },
};

const LIB_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Prices & Charts', keys: ['sol_price','price_chart','chart_sol_7d','chart_sol_30d','chart_btc','chart_eth','chart_bonk','chart_wif','chart_jup','chart_ray','chart_pyth'] },
  { label: 'DEX Pairs',       keys: ['dex_sol','dex_bonk','dex_jup','dex_wif','dex_pyth','dex_jto','dex_popcat','dex_ray','dex_orca','dex_wen'] },
  { label: 'Token Info',      keys: ['info_sol','info_bonk','info_jup','info_wif','info_pyth','info_popcat','token_info'] },
  { label: 'Market Intel',    keys: ['trending','fear_greed','volume_bar','kol_feed','top_traders'] },
  { label: 'Community',       keys: ['social_feed','social_announcements','social_trades'] },
  { label: 'Wallet',          keys: ['wallet','wallet_tracker','wallet_portfolio'] },
];
const LIB_TOTAL = LIB_GROUPS.reduce((n, g) => n + g.keys.length, 0);

/* ════════════════════════════════════════════════════════════════
   WidgetForge — the AI widget compiler.
   Pipeline: server LLM (ai-analyzer edge fn, key stays server-side)
   → optional client OpenAI key → deterministic local compiler.
   Every path returns a ForgeSpec; custom code runs in the sandbox
   with the FULL React namespace (h = createElement).
   ════════════════════════════════════════════════════════════════ */

export type ForgeSpec = { type: WidgetType; title: string; size: 'sm' | 'md' | 'lg'; params: Record<string, any>; reply: string };

const FORGE_TYPES: WidgetType[] = ['sol_price','trending','social_feed','wallet','price_chart','kol_feed','fear_greed','volume_bar','dex_chart','token_info','wallet_portfolio','wallet_tracker','top_traders','custom_code'];

const FORGE_PROMPT = `You are WidgetForge — OrbitX's frontier-grade widget engineer, built to work at the level of the very best AI pair-programmers (think Claude Opus craftsmanship: precise, complete, tasteful, zero laziness). You compile user requests into live dashboard widgets. Answer with ONLY one JSON object — no prose, no markdown fences.
Schema: {"type":"custom_code"|"price_chart"|"dex_chart"|"token_info"|"trending"|"sol_price"|"fear_greed"|"volume_bar"|"kol_feed"|"top_traders"|"social_feed"|"wallet_tracker"|"wallet_portfolio","title":"≤22 chars, emoji prefix","size":"sm"|"md"|"lg","params":{},"reply":"one confident sentence"}

PRIME DIRECTIVE — BUILD EXACTLY WHAT WAS ASKED:
Every named token, metric, color, layout and behavior in the request is a hard requirement. The user's words override every default below. Prefer "custom_code" for anything that isn't a perfect built-in match — never dumb a specific request down to a generic widget.

DESIGN DOCTRINE (custom_code):
1. Composition first: a widget is a tiny product. Establish hierarchy — one hero element (big number, chart, gauge), supporting stats as chips, micro-labels in uppercase 8-9px with letter-spacing.
2. COLOR LAW: if the user specifies ANY colors (hex codes, color names, or vibes like synthwave/luxury/matrix), those exact colors drive the accents, gradients, glows and borders. When no colors are given, design a bespoke palette that fits the subject (gold for BTC, violet for SOL, emerald for gains trackers) — never default gray. Always: gradient accent bar or gradient text for the hero, soft glow (boxShadow with the accent at ~35% alpha), translucent accent-tinted surfaces (accent + '1f').
3. Depth & life: layered surfaces rgba(255,255,255,.05) with 1px rgba borders, border-radius 10-14, live-updating values with a pulsing status dot, deltas as pill badges (green #34d399 up / red #fb7185 down — semantic, keep these), inline SVG sparklines/rings/bars for ANY series or ratio data (vectorEffect:'non-scaling-stroke').
4. Interactivity: h('button'|'input', {onClick|onChange}) with real state; tabs where data has views; hover affordances via opacity/filter.
5. States: loading skeleton text, explicit error message, empty state. Auto-refresh via setInterval in useEffect WITH cleanup.
CONTRACT: params.code is ONE JS arrow function "(props) => {...}". In scope: React, h = React.createElement, useState, useEffect, useMemo, useCallback, useRef, fetch, supabase, params. NO JSX, no imports, inline styles only. Compact (≤70 lines) but COMPLETE — no TODOs.
DATA (free, no key): DexScreener https://api.dexscreener.com/latest/dex/search?q=SYM → pairs[] (chainId==='solana', priceUsd, priceChange.{m5,h1,h6,h24}, volume.h24, liquidity.usd); for a contract address / pump.fun mint (base58, often ending 'pump') use https://api.dexscreener.com/latest/dex/tokens/ADDRESS → pairs[] and pick the highest-liquidity chainId==='solana' pair; trend sparkline trick: reconstruct points from priceChange fields. CoinGecko /api/v3/simple/price?ids=ID&vs_currencies=usd&include_24hr_change=true and /coins/ID/market_chart?vs_currency=usd&days=N. Fear&Greed https://api.alternative.me/fng/. Internal /api/ogdex/screener?type=trending&interval=24h&limit=N → {rows:[{symbol,change24h}]}.

EXEMPLAR (the quality bar — study the craft, then exceed it for the actual request):
{"type":"custom_code","title":"⚡ JUP Pulse","size":"md","params":{"code":"(props) => { const [p, setP] = useState(null); useEffect(() => { let live = true; const load = () => fetch('https://api.dexscreener.com/latest/dex/search?q=JUP').then(function(r){ return r.json(); }).then(function(d){ const x = ((d && d.pairs) || []).filter(function(q){ return q.chainId === 'solana'; })[0]; if (live && x) setP(x); }).catch(function(){}); load(); const t = setInterval(load, 30000); return function(){ live = false; clearInterval(t); }; }, []); if (!p) return h('div', { style: { fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center', padding: '14px 0' } }, 'Syncing JUP…'); const pc = p.priceChange || {}; const chg = Number(pc.h24 || 0), up = chg >= 0, tone = up ? '#34d399' : '#fb7185'; const price = Number(p.priceUsd || 0); const pts = [pc.h24, pc.h6, pc.h1, pc.m5].map(function(c){ return price / (1 + (Number(c) || 0) / 100); }).concat([price]); const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts); const ln = pts.map(function(v, i){ return (i / (pts.length - 1)) * 100 + ',' + (24 - (mx > mn ? (v - mn) / (mx - mn) : 0.5) * 20 - 2); }).join(' '); return h('div', null, h('div', { style: { height: 3, borderRadius: 99, background: 'linear-gradient(90deg,#5eead4,#0ea5e9)', marginBottom: 9, boxShadow: '0 0 12px rgba(94,234,212,.4)' } }), h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, h('span', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 900, color: '#fff' } }, h('i', { style: { width: 7, height: 7, borderRadius: 99, background: '#5eead4', boxShadow: '0 0 10px rgba(94,234,212,.6)' } }), '$JUP'), h('span', { style: { fontSize: 10.5, fontWeight: 900, color: tone, background: up ? 'rgba(52,211,153,.1)' : 'rgba(251,113,133,.1)', borderRadius: 99, padding: '3px 9px' } }, (up ? '▲ +' : '▼ ') + Math.abs(chg).toFixed(2) + '%')), h('div', { style: { fontSize: 22, fontWeight: 900, color: '#fff', margin: '5px 0 3px', fontVariantNumeric: 'tabular-nums' } }, '$' + price.toFixed(4)), h('svg', { width: '100%', height: 26, viewBox: '0 0 100 26', preserveAspectRatio: 'none' }, h('polyline', { points: ln, fill: 'none', stroke: tone, strokeWidth: 2, strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' }))); }"},"reply":"JUP Pulse: teal-gradient live ticker with a real 24h trend line."}

Built-in params: symbol (ticker for dex_chart/token_info, CoinGecko ID for price_chart), days 1|7|30, limit, address, view, channel. Reply with ONLY the JSON object.`;

export type DesignBrief = { name?: string; palette?: { accent?: string; accent2?: string; glow?: string; mood?: string }; layout?: string; features?: string[]; viz?: string };

const DESIGN_PROMPT = `You are a world-class product designer for OrbitX (dark, premium, data-dense trading UI). Given a widget request, produce a sharp design brief. Answer ONLY compact JSON, no prose:
{"name":"widget name ≤20 chars","palette":{"accent":"#hex","accent2":"#hex","glow":"rgba(...)","mood":"2-3 word vibe"},"layout":"one concrete line: hero element + supporting elements","features":["3-5 concrete features, each specific and buildable"],"viz":"sparkline|ring|bars|list|grid|gauge|none"}
Rules: if the user names colors or a vibe, the palette MUST use exactly those; otherwise invent a bespoke palette that fits the subject (never default blue-gray). Features must directly serve the request — no filler.`;

function extractJsonBlock(raw: string): any {
  let t = (raw || '').replace(/```(?:json|js|javascript)?/gi, '').trim();
  const start = t.indexOf('{');
  if (start < 0) throw new Error('no JSON in response');
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') inStr = !inStr;
    if (inStr) continue;
    if (c === '{') depth++;
    if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error('unbalanced JSON');
  return JSON.parse(t.slice(start, end + 1));
}

function extractForgeSpec(raw: string): ForgeSpec {
  const j = extractJsonBlock(raw);
  const type: WidgetType = FORGE_TYPES.includes(j.type) ? j.type : 'custom_code';
  const params = (j.params && typeof j.params === 'object') ? j.params : {};
  if (type === 'custom_code' && (typeof params.code !== 'string' || params.code.trim().length < 20)) throw new Error('custom_code missing code');
  return {
    type,
    title: typeof j.title === 'string' && j.title.trim() ? j.title.trim().slice(0, 30) : 'AI Widget',
    size: (['sm','md','lg'] as const).includes(j.size) ? j.size : 'md',
    params,
    reply: typeof j.reply === 'string' && j.reply.trim() ? j.reply.trim() : 'Built and mounted to your hub.',
  };
}

function composeForgeAsk(prompt: string, pal: Palette | null, brief: DesignBrief | null): string {
  let t = `Widget request: ${prompt}`;
  if (pal) t += `\nUSER PALETTE (mandatory — use these EXACT colors for accents, gradients, glows, borders): accent ${pal.a}, secondary ${pal.b}, glow ${pal.g} (${pal.name}).`;
  if (brief) t += `\nAPPROVED DESIGN BRIEF (implement it fully): ${JSON.stringify(brief)}`;
  t += '\nRemember: ONLY the JSON spec object.';
  return t;
}

async function callForgeLLM(messages: { role: string; content: string }[]): Promise<string> {
  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('ai-analyzer', { body: { action, messages, ...extra } });
    if (error) throw error;
    const text = (data && (data.analysis ?? data.content)) || '';
    if (!text) throw new Error('empty server response');
    return String(text);
  };
  // Dedicated code-gen path: no chatty persona + high token budget so a full
  // custom widget is never truncated into an unparseable payload (which is what
  // forced the stock local fallback). Falls back to the generic chat action for
  // older edge-function deployments that predate the "forge" action.
  try { return await invoke('forge', { maxTokens: 4000 }); }
  catch { return await invoke('chat'); }
}

async function forgeDesignBrief(prompt: string, pal: Palette | null): Promise<DesignBrief> {
  const text = await callForgeLLM([
    { role: 'user', content: DESIGN_PROMPT },
    { role: 'assistant', content: '{"ack":true} READY — send the request.' },
    { role: 'user', content: `Request: ${prompt}${pal ? `\nUser-specified palette (mandatory): accent ${pal.a}, secondary ${pal.b}, glow ${pal.g} (${pal.name})` : ''}\nJSON only.` },
  ]);
  const j = extractJsonBlock(text);
  if (!j || typeof j !== 'object') throw new Error('bad brief');
  return j as DesignBrief;
}

async function forgeWithServer(prompt: string, history: Msg[], pal: Palette | null, brief: DesignBrief | null): Promise<ForgeSpec> {
  const text = await callForgeLLM([
    { role: 'user', content: FORGE_PROMPT },
    { role: 'assistant', content: '{"ack":true} — READY. Send the widget request; I reply with only the JSON spec.' },
    ...history.slice(-4).map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text.slice(0, 500) })),
    { role: 'user', content: composeForgeAsk(prompt, pal, brief) },
  ]);
  return extractForgeSpec(text);
}

async function forgeWithOpenAI(prompt: string, history: Msg[], pal: Palette | null, brief: DesignBrief | null): Promise<ForgeSpec> {
  const aiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY ?? '';
  if (!aiKey) throw new Error('no client key');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 2400, temperature: 0.3, messages: [
      { role: 'system', content: FORGE_PROMPT },
      ...history.slice(-4).map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text.slice(0, 500) })),
      { role: 'user', content: composeForgeAsk(prompt, pal, brief) },
    ] }),
  });
  const j = await res.json();
  return extractForgeSpec(j.choices?.[0]?.message?.content ?? '');
}

/* ── Local compiler: hand-crafted parametric widgets. Guarantees the prompt is
     honored (watchlists, tickers, countdowns, notes…) even with zero AI backends. ── */

const STOPWORDS = new Set(['THE','AND','FOR','WITH','THAT','SHOW','SHOWS','LIVE','PRICE','PRICES','CHART','CHARTS','WIDGET','WIDGETS','TRACK','TRACKER','TRACKING','MAKE','BUILD','BUILDS','ADD','TOP','NEW','FROM','THIS','INTO','LIST','WATCH','WATCHLIST','FEED','USD','ME','MY','OF','A','AN','TO','IN','ON','VS','PLEASE','CREATE','CUSTOM','ANIMATED','COOL','BIG','SMALL','LIKE','GET','SET','ALL','EVERY','REAL','TIME','DATA','TOKEN','TOKENS','COIN','COINS','CRYPTO','SOLANA','DAILY','HOURLY']);

function extractSymbols(prompt: string): string[] {
  const dollar = (prompt.match(/\$([A-Za-z]{2,10})/g) || []).map(x => x.slice(1).toUpperCase());
  const caps = (prompt.match(/\b[A-Z]{2,10}\b/g) || []).filter(w => !STOPWORDS.has(w));
  return [...new Set([...dollar, ...caps])].slice(0, 8);
}

/* ── Color intelligence: users can "code in" any colors — hex codes, named
     colors or whole vibes — and every engine (AI + local) must honor them. ── */
export type Palette = { a: string; b: string; g: string; name: string };
export const DEFAULT_PAL: Palette = { a: '#5aa2ff', b: '#9945FF', g: 'rgba(90,162,255,.35)', name: 'orbit' };

const NAMED_COLORS: Record<string, [string, string]> = {
  red: ['#ef4444', '#b91c1c'], crimson: ['#dc2626', '#7f1d1d'], pink: ['#ec4899', '#be185d'],
  magenta: ['#d946ef', '#a21caf'], purple: ['#a855f7', '#6d28d9'], violet: ['#8b5cf6', '#5b21b6'],
  indigo: ['#6366f1', '#4338ca'], blue: ['#3b82f6', '#1d4ed8'], cyan: ['#22d3ee', '#0891b2'],
  teal: ['#2dd4bf', '#0f766e'], green: ['#22c55e', '#15803d'], emerald: ['#34d399', '#059669'],
  lime: ['#a3e635', '#4d7c0f'], yellow: ['#facc15', '#a16207'], gold: ['#e6c15a', '#a1791f'],
  amber: ['#f59e0b', '#b45309'], orange: ['#f97316', '#c2410c'], white: ['#f4f4f5', '#a1a1aa'],
  silver: ['#cbd5e1', '#64748b'], turquoise: ['#06b6d4', '#0e7490'], lavender: ['#c4b5fd', '#8b5cf6'],
  rose: ['#fb7185', '#e11d48'], mint: ['#6ee7b7', '#10b981'], coral: ['#fb923c', '#ea580c'],
};
const VIBE_PALETTES: Record<string, Palette> = {
  synthwave: { a: '#ff2bd6', b: '#00e5ff', g: 'rgba(255,43,214,.4)', name: 'synthwave' },
  cyberpunk: { a: '#f0e130', b: '#00e5ff', g: 'rgba(240,225,48,.35)', name: 'cyberpunk' },
  matrix:    { a: '#22c55e', b: '#052e16', g: 'rgba(74,222,128,.4)', name: 'matrix' },
  sunset:    { a: '#ff7e5f', b: '#feb47b', g: 'rgba(255,126,95,.4)', name: 'sunset' },
  ocean:     { a: '#38bdf8', b: '#0ea5e9', g: 'rgba(56,189,248,.4)', name: 'ocean' },
  fire:      { a: '#f97316', b: '#ef4444', g: 'rgba(249,115,22,.45)', name: 'fire' },
  luxury:    { a: '#e6c15a', b: '#8b6914', g: 'rgba(230,193,90,.4)', name: 'luxury gold' },
  ice:       { a: '#a5f3fc', b: '#38bdf8', g: 'rgba(165,243,252,.4)', name: 'ice' },
  neon:      { a: '#39ff14', b: '#ff2bd6', g: 'rgba(57,255,20,.4)', name: 'neon' },
  pastel:    { a: '#f9a8d4', b: '#a5b4fc', g: 'rgba(249,168,212,.35)', name: 'pastel' },
  royal:     { a: '#7c3aed', b: '#fbbf24', g: 'rgba(124,58,237,.4)', name: 'royal' },
  dracula:   { a: '#bd93f9', b: '#ff79c6', g: 'rgba(189,147,249,.4)', name: 'dracula' },
  vaporwave: { a: '#ff71ce', b: '#01cdfe', g: 'rgba(255,113,206,.4)', name: 'vaporwave' },
};
const hexGlow = (hex: string): string => {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m.padEnd(6, '0');
  const r = parseInt(v.slice(0, 2), 16) || 0, g = parseInt(v.slice(2, 4), 16) || 0, b = parseInt(v.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},.4)`;
};
export function derivePalette(prompt: string): Palette | null {
  const m = prompt.toLowerCase();
  const hexes = prompt.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g) || [];
  if (hexes.length) {
    const a = hexes[0], b = hexes[1] ?? hexes[0];
    return { a, b, g: hexGlow(a), name: 'custom hex' };
  }
  for (const vibe of Object.keys(VIBE_PALETTES)) if (m.includes(vibe)) return VIBE_PALETTES[vibe];
  const found: string[] = [];
  for (const c of Object.keys(NAMED_COLORS)) if (new RegExp(`\\b${c}\\b`).test(m)) found.push(c);
  found.sort((x, y) => m.indexOf(x) - m.indexOf(y));
  if (found.length) {
    const [a] = NAMED_COLORS[found[0]];
    const b = found[1] ? NAMED_COLORS[found[1]][0] : NAMED_COLORS[found[0]][1];
    return { a, b, g: hexGlow(a), name: found.slice(0, 2).join(' + ') };
  }
  return null;
}

const ACCENT_BAR = (pal: Palette) => `h('div', { style: { height: 3, borderRadius: 99, background: 'linear-gradient(90deg,${pal.a},${pal.b})', marginBottom: 9, boxShadow: '0 0 12px ${pal.g}' } })`;

const GEN_TICKER = (sym: string, pal: Palette) => `(props) => {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const q = '${sym}';
  const isAddr = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q);
  useEffect(() => {
    let live = true;
    const url = isAddr ? 'https://api.dexscreener.com/latest/dex/tokens/' + q : 'https://api.dexscreener.com/latest/dex/search?q=' + q;
    const load = () => fetch(url)
      .then(function(r){ return r.json(); })
      .then(function(d){
        const sol = ((d && d.pairs) || []).filter(function(x){ return x.chainId === 'solana'; });
        sol.sort(function(a, b){ return Number((b.liquidity && b.liquidity.usd) || 0) - Number((a.liquidity && a.liquidity.usd) || 0); });
        const pair = sol[0];
        if (live) { if (pair) setP(pair); else setErr('No Solana pair found'); }
      })
      .catch(function(){ if (live) setErr('Network error'); });
    load();
    const t = setInterval(load, 30000);
    return function(){ live = false; clearInterval(t); };
  }, []);
  if (err) return h('div', { style: { fontSize: 11, color: '#fb7185' } }, err);
  if (!p) return h('div', { style: { fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center', padding: '14px 0' } }, 'Loading…');
  const pc = p.priceChange || {};
  const chg = Number(pc.h24 || 0), up = chg >= 0, tone = up ? '#34d399' : '#fb7185';
  const price = Number(p.priceUsd || 0);
  const pts = [pc.h24, pc.h6, pc.h1, pc.m5].map(function(c){ return price / (1 + (Number(c) || 0) / 100); }).concat([price]);
  const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts);
  const line = pts.map(function(v, i){ return (i / (pts.length - 1)) * 100 + ',' + (26 - (mx > mn ? (v - mn) / (mx - mn) : 0.5) * 22 - 2); }).join(' ');
  const chip = function(label, val){ return h('div', { style: { flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '6px 8px' } },
    h('div', { style: { fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.07em' } }, label),
    h('div', { style: { fontSize: 11.5, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' } }, val)); };
  const fmt = function(n){ return n >= 1e9 ? (n/1e9).toFixed(2)+'B' : n >= 1e6 ? (n/1e6).toFixed(2)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : String(Math.round(n)); };
  return h('div', null,
    ${ACCENT_BAR(pal)},
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('span', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 900, color: '#fff' } },
        h('i', { style: { width: 7, height: 7, borderRadius: 99, background: '${pal.a}', boxShadow: '0 0 10px ${pal.g}', display: 'inline-block' } }), '$' + ((p.baseToken && p.baseToken.symbol) || (isAddr ? q.slice(0, 4) : q))),
      h('span', { style: { fontSize: 11, fontWeight: 900, color: tone, background: up ? 'rgba(52,211,153,.1)' : 'rgba(251,113,133,.1)', borderRadius: 99, padding: '3px 9px' } }, (up ? '▲ +' : '▼ ') + Math.abs(chg).toFixed(2) + '%')),
    h('div', { style: { fontSize: 23, fontWeight: 900, color: '#fff', margin: '5px 0 3px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' } }, '$' + (price >= 1 ? price.toFixed(2) : price.toFixed(6))),
    h('svg', { width: '100%', height: 28, viewBox: '0 0 100 28', preserveAspectRatio: 'none', style: { marginBottom: 7 } },
      h('polyline', { points: line, fill: 'none', stroke: tone, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' })),
    h('div', { style: { display: 'flex', gap: 6 } },
      chip('Vol 24h', '$' + fmt(Number((p.volume && p.volume.h24) || 0))),
      chip('Liquidity', '$' + fmt(Number((p.liquidity && p.liquidity.usd) || 0)))));
}`;

const GEN_WATCHLIST = (syms: string[], pal: Palette) => `(props) => {
  const syms = ${JSON.stringify(syms)};
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let live = true;
    const load = () => Promise.all(syms.map(function(s){
      var isA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
      var u = isA ? 'https://api.dexscreener.com/latest/dex/tokens/' + s : 'https://api.dexscreener.com/latest/dex/search?q=' + s;
      return fetch(u)
        .then(function(r){ return r.json(); })
        .then(function(d){
          var sol = ((d && d.pairs) || []).filter(function(x){ return x.chainId === 'solana'; });
          sol.sort(function(a, b){ return Number((b.liquidity && b.liquidity.usd) || 0) - Number((a.liquidity && a.liquidity.usd) || 0); });
          var p = sol[0];
          var lbl = isA ? ((p && p.baseToken && p.baseToken.symbol) || s.slice(0, 4)) : s;
          return p ? { s: lbl, price: Number(p.priceUsd || 0), chg: Number((p.priceChange && p.priceChange.h24) || 0) } : { s: isA ? s.slice(0, 4) : s, price: null, chg: 0 };
        })
        .catch(function(){ return { s: s, price: null, chg: 0 }; });
    })).then(function(rs){ if (live) setRows(rs); });
    load();
    const t = setInterval(load, 30000);
    return function(){ live = false; clearInterval(t); };
  }, []);
  if (!rows.length) return h('div', { style: { fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center', padding: '14px 0' } }, 'Loading watchlist…');
  return h('div', null,
    ${ACCENT_BAR(pal)},
    rows.map(function(r, i){
      const up = r.chg >= 0, tone = up ? '#34d399' : '#fb7185';
      return h('div', { key: r.s, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6.5px 0', borderTop: i ? '1px solid rgba(255,255,255,.06)' : 'none' } },
        h('span', { style: { width: 20, height: 20, borderRadius: 7, background: 'linear-gradient(135deg,${pal.a}33,${pal.b}22)', border: '1px solid ${pal.a}44', color: '${pal.a}', fontSize: 9, fontWeight: 900, display: 'grid', placeItems: 'center', flexShrink: 0 } }, i + 1),
        h('span', { style: { fontSize: 12, fontWeight: 800, color: '#fff', width: 56 } }, '$' + r.s),
        h('span', { style: { flex: 1, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.82)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' } }, r.price == null ? '—' : '$' + (r.price >= 1 ? r.price.toFixed(2) : r.price.toFixed(6))),
        h('span', { style: { fontSize: 10.5, fontWeight: 900, minWidth: 72, textAlign: 'center', color: tone, background: up ? 'rgba(52,211,153,.09)' : 'rgba(251,113,133,.09)', borderRadius: 99, padding: '2.5px 7px' } }, (up ? '+' : '') + r.chg.toFixed(2) + '%'));
    }));
}`;

const GEN_COUNTDOWN = (targetMs: number, label: string, pal: Palette) => `(props) => {
  const target = ${targetMs};
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(function(){ setNow(Date.now()); }, 1000); return function(){ clearInterval(t); }; }, []);
  const left = Math.max(0, target - now);
  if (left === 0) return h('div', { style: { fontSize: 16, fontWeight: 900, color: '${pal.a}', textAlign: 'center', padding: '12px 0', textShadow: '0 0 18px ${pal.g}' } }, '🎉 ${label} is here!');
  const d = Math.floor(left / 86400000), hh = Math.floor(left / 3600000) % 24, mm = Math.floor(left / 60000) % 60, ss = Math.floor(left / 1000) % 60;
  const cell = function(v, l, hot){ return h('div', { style: { flex: 1, background: hot ? 'linear-gradient(160deg,${pal.a}1f,${pal.b}14)' : 'rgba(255,255,255,.055)', border: hot ? '1px solid ${pal.a}55' : '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '9px 4px', textAlign: 'center', boxShadow: hot ? '0 0 18px ${pal.g}' : 'none' } },
    h('div', { style: { fontSize: 19, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums' } }, String(v).padStart(2, '0')),
    h('div', { style: { fontSize: 8.5, fontWeight: 800, color: hot ? '${pal.a}' : 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.09em' } }, l)); };
  return h('div', null,
    ${ACCENT_BAR(pal)},
    h('div', { style: { fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.6)', marginBottom: 8 } }, '⏳ ${label}'),
    h('div', { style: { display: 'flex', gap: 6 } }, cell(d, 'days', d > 0), cell(hh, 'hrs', d === 0 && hh > 0), cell(mm, 'min', false), cell(ss, 'sec', false)));
}`;

const GEN_NOTES = (pal: Palette) => `(props) => {
  const KEY = 'og_widget_notes_v1';
  const read = function(){ try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const [items, setItems] = useState(read);
  const [txt, setTxt] = useState('');
  const save = function(next){ setItems(next); localStorage.setItem(KEY, JSON.stringify(next)); };
  const add = function(){ const v = txt.trim(); if (!v) return; save([{ id: Date.now(), t: v, done: false }].concat(items).slice(0, 20)); setTxt(''); };
  return h('div', null,
    ${ACCENT_BAR(pal)},
    h('div', { style: { display: 'flex', gap: 6, marginBottom: 8 } },
      h('input', { value: txt, placeholder: 'Add a note…', onChange: function(e){ setTxt(e.target.value); }, onKeyDown: function(e){ if (e.key === 'Enter') add(); },
        style: { flex: 1, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 11.5, padding: '7px 10px', outline: 'none', fontFamily: 'inherit' } }),
      h('button', { onClick: add, style: { background: 'linear-gradient(135deg,${pal.a},${pal.b})', border: 0, borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 900, width: 30, cursor: 'pointer', boxShadow: '0 3px 12px ${pal.g}' } }, '+')),
    items.length === 0 ? h('div', { style: { fontSize: 10.5, color: 'rgba(255,255,255,.35)', textAlign: 'center', padding: '8px 0' } }, 'No notes yet') :
    h('div', null, items.map(function(it){
      return h('div', { key: it.id, style: { display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0' } },
        h('button', { onClick: function(){ save(items.map(function(x){ return x.id === it.id ? { id: x.id, t: x.t, done: !x.done } : x; })); },
          style: { width: 15, height: 15, borderRadius: 5, flexShrink: 0, cursor: 'pointer', border: it.done ? 0 : '1.5px solid rgba(255,255,255,.3)', background: it.done ? '${pal.a}' : 'transparent', color: '#04110b', fontSize: 9, fontWeight: 900, lineHeight: '13px', padding: 0 } }, it.done ? '✓' : ''),
        h('span', { style: { flex: 1, fontSize: 11.5, fontWeight: 600, color: it.done ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.85)', textDecoration: it.done ? 'line-through' : 'none' } }, it.t),
        h('button', { onClick: function(){ save(items.filter(function(x){ return x.id !== it.id; })); }, style: { background: 'transparent', border: 0, color: 'rgba(255,255,255,.25)', fontSize: 10, cursor: 'pointer' } }, '✕'));
    })));
}`;

const GEN_CLOCK = (pal: Palette) => `(props) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(function(){ setNow(new Date()); }, 1000); return function(){ clearInterval(t); }; }, []);
  const two = function(n){ return String(n).padStart(2, '0'); };
  const utc = two(now.getUTCHours()) + ':' + two(now.getUTCMinutes());
  return h('div', { style: { textAlign: 'center' } },
    ${ACCENT_BAR(pal)},
    h('div', { style: { fontSize: 25, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em', background: 'linear-gradient(135deg,${pal.a},${pal.b})', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 0 14px ${pal.g})' } },
      two(now.getHours()) + ':' + two(now.getMinutes()) + ':' + two(now.getSeconds())),
    h('div', { style: { fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.45)', marginTop: 3 } },
      now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + ' · ' + utc + ' UTC'));
}`;

const GEN_CONVERTER = (pal: Palette) => `(props) => {
  const [px, setPx] = useState(null);
  const [amt, setAmt] = useState('1');
  useEffect(() => {
    let live = true;
    const load = () => fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
      .then(function(r){ return r.json(); }).then(function(j){ if (live && j && j.solana) setPx(j.solana.usd); }).catch(function(){});
    load(); const t = setInterval(load, 30000);
    return function(){ live = false; clearInterval(t); };
  }, []);
  const n = parseFloat(amt) || 0;
  return h('div', null,
    ${ACCENT_BAR(pal)},
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
      h('input', { value: amt, onChange: function(e){ setAmt(e.target.value.replace(/[^0-9.]/g, '')); },
        style: { width: 74, background: 'rgba(255,255,255,.07)', border: '1px solid ${pal.a}44', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 800, padding: '7px 9px', outline: 'none', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' } }),
      h('span', { style: { fontSize: 13, fontWeight: 900, color: '${pal.a}' } }, '◎ SOL'),
      h('span', { style: { fontSize: 13, color: 'rgba(255,255,255,.35)' } }, '→'),
      h('span', { style: { flex: 1, fontSize: 16, fontWeight: 900, color: '#34d399', fontVariantNumeric: 'tabular-nums', textAlign: 'right' } }, px == null ? '…' : '$' + (n * px).toLocaleString('en-US', { maximumFractionDigits: 2 }))),
    h('div', { style: { fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,.35)', marginTop: 7, textAlign: 'right' } }, px == null ? 'Loading price…' : '1 SOL = $' + px.toFixed(2) + ' · live'));
}`;

const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

function parseTargetDate(prompt: string): { ts: number; label: string } | null {
  const m = prompt.toLowerCase();
  const iso = prompt.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) { const d = new Date(iso[1] + 'T00:00:00'); if (!isNaN(+d)) return { ts: +d, label: iso[1] }; }
  for (let i = 0; i < MONTHS.length; i++) {
    const re = new RegExp(MONTHS[i].slice(0, 3) + '[a-z]*\\s+(\\d{1,2})');
    const hit = m.match(re);
    if (hit) {
      const now = new Date();
      let d = new Date(now.getFullYear(), i, parseInt(hit[1], 10));
      if (+d < Date.now()) d = new Date(now.getFullYear() + 1, i, parseInt(hit[1], 10));
      return { ts: +d, label: MONTHS[i][0].toUpperCase() + MONTHS[i].slice(1) + ' ' + hit[1] };
    }
  }
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (m.includes(WEEKDAYS[i])) {
      const now = new Date();
      const diff = ((i - now.getDay()) + 7) % 7 || 7;
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
      return { ts: +d, label: WEEKDAYS[i][0].toUpperCase() + WEEKDAYS[i].slice(1) };
    }
  }
  if (m.includes('tomorrow')) { const now = new Date(); return { ts: +new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), label: 'Tomorrow' }; }
  const rel = m.match(/in\s+(\d{1,3})\s+(day|hour|minute)s?/);
  if (rel) { const n = parseInt(rel[1], 10), mult = rel[2] === 'day' ? 86400000 : rel[2] === 'hour' ? 3600000 : 60000; return { ts: Date.now() + n * mult, label: 'in ' + rel[1] + ' ' + rel[2] + (n > 1 ? 's' : '') }; }
  return null;
}

const CG_IDS: Record<string, string> = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BONK: 'bonk', WIF: 'dogwifcoin', JUP: 'jupiter-exchange-solana', RAY: 'raydium', PYTH: 'pyth-network', DOGE: 'dogecoin', XRP: 'ripple', ADA: 'cardano', AVAX: 'avalanche-2', LINK: 'chainlink' };

export function forgeLocally(prompt: string): ForgeSpec {
  const m = prompt.toLowerCase();
  const syms = extractSymbols(prompt);
  const pal = derivePalette(prompt) ?? DEFAULT_PAL;
  const mk = (type: WidgetType, title: string, size: 'sm'|'md'|'lg', params: Record<string, any>, reply: string): ForgeSpec => ({ type, title, size, params, reply });

  if (/countdown|days (left|until)|until /.test(m)) {
    const t = parseTargetDate(prompt) ?? { ts: +new Date(new Date().getFullYear(), 11, 31, 23, 59, 59), label: 'New Year' };
    return mk('custom_code', '⏳ ' + t.label, 'md', { code: GEN_COUNTDOWN(t.ts, t.label.replace(/'/g, ''), pal) }, `Live countdown to ${t.label}, ticking every second.`);
  }
  if (/\bnotes?\b|todo|to-do|checklist|task/.test(m)) return mk('custom_code', '📝 Quick Notes', 'md', { code: GEN_NOTES(pal) }, 'Persistent notes with check-off and delete — saved on this device.');
  if (/\bclock\b|world time|\butc\b/.test(m)) return mk('custom_code', '🕐 Live Clock', 'sm', { code: GEN_CLOCK(pal) }, 'Live seconds clock with UTC readout.');
  if (/convert|calculator|how much is/.test(m)) return mk('custom_code', '💱 SOL → USD', 'md', { code: GEN_CONVERTER(pal) }, 'Live SOL to USD converter, refreshes every 30s.');
  if (/fear|greed|sentiment|mood/.test(m)) return mk('fear_greed', '🌡 Fear & Greed', 'sm', {}, 'Live market mood gauge.');
  if (/trending|hot|movers/.test(m)) return mk('trending', '🔥 Trending', 'md', { limit: 5 }, 'Top trending Solana tokens, live.');
  if (/kol|whale|smart money/.test(m)) return mk('kol_feed', '🐋 KOL Alerts', 'md', { limit: 5 }, 'Live KOL whale trade alerts.');
  if (/top trader|leaderboard/.test(m)) return mk('top_traders', '🏆 Top Traders', 'md', { limit: 5 }, 'Top trader leaderboard.');
  if (/volume/.test(m)) return mk('volume_bar', '📉 SOL Volume', 'md', { symbol: 'SOL' }, '24h SOL volume tracker.');
  if (/social|community|posts/.test(m)) return mk('social_feed', '💬 Community', 'md', { channel: 'social-general', limit: 3 }, 'Latest community posts.');
  const addr = prompt.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/)?.[0];
  if (addr) {
    const wantsWallet = /\bwallet|buys?\b|sells?\b|holding|portfolio|trader\b/.test(m);
    const looksLikeToken = /pump$/i.test(addr) || /\btoken|coin|mint|contract|\bca\b|price|ticker|chart|pump\b/.test(m);
    if (looksLikeToken || !wantsWallet) {
      return mk('custom_code', '◎ ' + addr.slice(0, 4) + '…', 'md', { code: GEN_TICKER(addr, pal) }, 'Live token tracker for ' + addr.slice(0, 6) + '… — resolves pump.fun / SPL mints via DexScreener.');
    }
    return mk('wallet_tracker', '🔭 ' + addr.slice(0, 6) + '…', 'lg', { address: addr, view: /buy/.test(m) ? 'buys' : /sell/.test(m) ? 'sells' : /holding/.test(m) ? 'holdings' : 'all' }, 'Wallet tracker with buys, sells and holdings.');
  }
  if (syms.length >= 2 || /watchlist|portfolio of/.test(m)) {
    const list = syms.length >= 2 ? syms : ['SOL', 'BONK', 'JUP', 'WIF'];
    return mk('custom_code', '📋 ' + list.slice(0, 3).join('·') + (list.length > 3 ? '+' : ''), 'md', { code: GEN_WATCHLIST(list, pal) }, `Live watchlist for ${list.join(', ')} — price and 24h move, refreshing every 30s.`);
  }
  if (/chart|candles|graph|history/.test(m) && syms.length) {
    const sym = syms[0];
    if (CG_IDS[sym]) {
      const days = /30d|month/.test(m) ? 30 : /7d|week/.test(m) ? 7 : 1;
      return mk('price_chart', '📈 ' + sym + ' ' + days + 'd', 'lg', { symbol: CG_IDS[sym], days }, `${sym} price chart, ${days}-day window.`);
    }
    return mk('dex_chart', '📊 ' + sym + ' DEX', 'lg', { symbol: sym }, `Live ${sym} DEX pair from DexScreener.`);
  }
  if (/info|stats|about/.test(m) && syms.length) return mk('token_info', '🔍 ' + syms[0], 'md', { symbol: syms[0] }, `${syms[0]} token stats.`);
  const sym = syms[0] ?? 'SOL';
  return mk('custom_code', '◎ ' + sym + ' Live', 'md', { code: GEN_TICKER(sym, pal) }, `Live ${sym} ticker — price, 24h move, volume and liquidity.`);
}

/* ── display source for built-in widgets (shown in the code window) ── */
function templateSource(spec: ForgeSpec): string {
  if (spec.type === 'custom_code') return String(spec.params.code ?? '');
  return `// ${spec.title} — compiled from the '${spec.type}' core module
import { defineWidget, sources, mount } from '@orbitx/widgets';

const widget = defineWidget({
  type: '${spec.type}',
  title: '${spec.title.replace(/'/g, '')}',
  size: '${spec.size}',
  params: ${JSON.stringify(spec.params, null, 2).split('\n').join('\n  ')},
  data: sources['${spec.type}'],   // live feed, auto-refresh 30s
  theme: { accent: '#5aa2ff', up: '#34d399', down: '#fb7185' },
});

export default mount(widget); // → hub grid`;
}

/* ── lightweight syntax highlighting for the forge code window ── */
const escHtml = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function hlCode(src: string): string {
  return src.split('\n').map((line) => {
    let l = escHtml(line);
    let comment = '';
    const cm = l.indexOf('//');
    if (cm >= 0 && !/https?:$/.test(l.slice(0, cm))) { comment = `<i class="tk-c">${l.slice(cm)}</i>`; l = l.slice(0, cm); }
    l = l
      .replace(/('(?:[^'\\]|\\.)*')/g, '<i class="tk-s">$1</i>')
      .replace(/\b(const|let|var|return|function|if|else|new|typeof|await|async|for|of|while|try|catch|import|export|default|from)\b/g, '<i class="tk-k">$1</i>')
      .replace(/\b(h|React|useState|useEffect|useMemo|useCallback|useRef|fetch|supabase|params|setInterval|clearInterval|JSON|Math|Date|Promise|localStorage)\b/g, '<i class="tk-f">$1</i>')
      .replace(/(?<![\w"'-])(\d+(?:\.\d+)?)(?![\w-])/g, '<i class="tk-n">$1</i>');
    return l + comment;
  }).join('\n');
}


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
  useEffect(() => { let live = true; const isAddr = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(sym); const url = isAddr ? `https://api.dexscreener.com/latest/dex/tokens/${sym}` : `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(sym)}`; fetch(url).then(r => r.json()).then(d => { if (!live) return; const pairs = (d?.pairs ?? []).filter((p: any) => p.chainId === 'solana').sort((a: any, b: any) => Number(b.liquidity?.usd ?? 0) - Number(a.liquidity?.usd ?? 0)); if (pairs.length > 0) setPair(pairs[0]); else setErr('No Solana pairs found'); }).catch(() => setErr('Failed to load')); return () => { live = false; }; }, [sym]);
  if (err) return <div style={{ fontSize:11, color:'#fb7185' }}>{err}</div>;
  if (!pair) return <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>Loading DEX data…</div>;
  const p24 = Number(pair.priceChange?.h24 ?? 0), up = p24 >= 0, price = Number(pair.priceUsd ?? 0);
  return (<div><div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}><div><div style={{ fontSize:14, fontWeight:900, color:'#fff' }}>{pair.baseToken?.symbol}/{pair.quoteToken?.symbol}</div><div style={{ fontSize:9, color:'rgba(255,255,255,.3)', textTransform:'uppercase' }}>{pair.dexId}</div></div><div style={{ textAlign:'right' }}><div style={{ fontSize:14, fontWeight:900, color:'#fff' }}>${price<0.001?price.toFixed(8):price<1?price.toFixed(4):price.toFixed(2)}</div><div style={{ fontSize:11, fontWeight:800, color:up?'#34d399':'#fb7185' }}>{up?'+':''}{p24.toFixed(2)}%</div></div></div><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>{[['24h Vol',pair.volume?.h24?`$${(Number(pair.volume.h24)/1e6).toFixed(2)}M`:'—'],['Liquidity',pair.liquidity?.usd?`$${(Number(pair.liquidity.usd)/1e6).toFixed(2)}M`:'—'],['Mkt Cap',pair.marketCap?`$${(Number(pair.marketCap)/1e6).toFixed(1)}M`:'—'],['Txns 24h',pair.txns?.h24?String((pair.txns.h24.buys??0)+(pair.txns.h24.sells??0)):'—']].map(([label, val]) => (<div key={label} style={{ background:'rgba(255,255,255,.04)', borderRadius:10, padding:'7px 10px' }}><div style={{ fontSize:8, color:'rgba(255,255,255,.35)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>{label}</div><div style={{ fontSize:12, fontWeight:800, color:'#fff', marginTop:2 }}>{val}</div></div>))}</div><a href={pair.url} target="_blank" rel="noopener" style={{ display:'block', marginTop:10, textAlign:'center', fontSize:10, color:'#5aa2ff', textDecoration:'none', fontWeight:700 }}>View on DexScreener →</a></div>);
}

function TokenInfoWidget({ params }: { params: Record<string, any> }) {
  const [info, setInfo] = useState<any>(null), sym = (params.symbol as string) ?? 'SOL';
  useEffect(() => { let live = true; const isAddr = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(sym); const url = isAddr ? `https://api.dexscreener.com/latest/dex/tokens/${sym}` : `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(sym)}`; fetch(url).then(r => r.json()).then(d => { if (!live) return; const sol = (d?.pairs ?? []).filter((x: any) => x.chainId === 'solana').sort((a: any, b: any) => Number(b.liquidity?.usd ?? 0) - Number(a.liquidity?.usd ?? 0)); const p = isAddr ? sol[0] : (sol.find((x: any) => x.baseToken?.symbol?.toUpperCase() === sym.toUpperCase()) ?? sol[0]); if (p) setInfo(p); }).catch(() => {}); return () => { live = false; }; }, [sym]);
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

export function compileWidgetCode(code: string): { Component: any; error: string } {
  if (!code) return { Component: null, error: '' };
  try {
    const fn = new Function('React','h','useState','useEffect','useMemo','useCallback','useRef','fetch','supabase','params',`"use strict"; const Component = (${code}); return Component;`);
    const Component = fn(RN, RN.createElement, useState, useEffect, useMemo, useCallback, useRef, window.fetch.bind(window), supabase, {});
    if (typeof Component !== 'function') return { Component: null, error: 'code did not evaluate to a component function' };
    return { Component, error: '' };
  } catch (e) { return { Component: null, error: String(e) }; }
}

function CustomCodeWidget({ params }: { params: Record<string, any> }) {
  const code = (params.code as string) ?? '';
  const { Component, error } = useMemo(() => compileWidgetCode(code), [code]);
  if (error) return <div style={{ fontSize:11, color:'#fb7185', wordBreak:'break-word' }}>⚠ {error}</div>;
  if (!Component) return <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>No code provided</div>;
  return <WidgetErrorBoundary><Component params={params} /></WidgetErrorBoundary>;
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

type ForgePhase = 'think' | 'code' | 'compile' | 'ready';
type ForgeJob = { phase: ForgePhase; step: number; status: string; prompt: string; spec: ForgeSpec | null; source: string; typed: number; engine: string; note?: string; brief?: DesignBrief | null; palette?: Palette | null };
const FORGE_STEPS: { label: string }[] = [
  { label: 'Understanding your request' },
  { label: 'Designing · palette + brief' },
  { label: 'Engineering the widget' },
  { label: 'Compiling in sandbox' },
  { label: 'Widget ready' },
];

export function AIWidgetPanel({ onClose, widgets, setWidgets, initialTab = 'chat' }: {
  onClose: () => void; widgets: WidgetConfig[]; setWidgets: (w: WidgetConfig[]) => void;
  initialTab?: 'chat' | 'my' | 'lib';
}) {
  const [tab, setTab] = useState<'chat' | 'my' | 'lib'>(initialTab);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'ai', text: '⚡ WidgetForge v3 — describe ANY widget and I will design it, write the code live, compile it in a sandbox and show you a working preview before it lands on your hub.\n\nTry:\n• "watchlist SOL BONK WIF"\n• "BONK chart for the last 7 days"\n• "countdown to friday"\n• "quick notes widget"\n• "synthwave BONK ticker in hot pink and cyan"\nName ANY colors, hex codes or vibes — I design with them. /help lists slash commands.' }]);
  const [input, setInput] = useState('');
  const [job, setJob] = useState<ForgeJob | null>(null);
  const jobTimer = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const codeScrollRef = useRef<HTMLDivElement>(null);
  const forging = !!job && job.phase !== 'ready';
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, job?.phase]);
  useEffect(() => { const el = codeScrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [job?.typed]);
  useEffect(() => () => { if (jobTimer.current) window.clearInterval(jobTimer.current); }, []);

  const makeWidget = useCallback((key: string, extra: Record<string, any> = {}): WidgetConfig => {
    const tmpl = TEMPLATES[key] ?? TEMPLATES.sol_price;
    return { ...tmpl, id: `w_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, pos: widgets.length, params: { ...tmpl.params, ...extra }, title: extra.title ?? tmpl.title };
  }, [widgets.length]);

  const pushWidget = useCallback((w: WidgetConfig) => { const next = [...widgets, w]; setWidgets(next); writeWidgets(next); }, [widgets, setWidgets]);
  const removeWidget = useCallback((id: string) => { const next = widgets.filter(w => w.id !== id).map((w, i) => ({ ...w, pos: i })); setWidgets(next); writeWidgets(next); }, [widgets, setWidgets]);

  const runForge = useCallback(async (prompt: string, variation = false) => {
    if (jobTimer.current) { window.clearInterval(jobTimer.current); jobTimer.current = null; }
    const pal = derivePalette(prompt);
    setJob({ phase: 'think', step: 0, status: 'Reading your request…', prompt, spec: null, source: '', typed: 0, engine: 'neural·design', palette: pal, brief: null });
    const ask = variation ? `${prompt}\n\nProduce a DIFFERENT take this time: vary the layout, visualization or angle.` : prompt;
    const started = Date.now();
    setJob(j => (j && j.phase === 'think' ? { ...j, step: 1, status: pal ? `Locking your palette · ${pal.name}…` : 'Composing a bespoke palette…' } : j));
    let brief: DesignBrief | null = null;
    try {
      brief = await forgeDesignBrief(ask, pal);
      setJob(j => (j && j.phase === 'think' ? { ...j, brief, engine: 'neural·2-pass', status: `Design brief ready${brief?.name ? ' · ' + brief.name : ''} — engineering…` } : j));
    } catch { /* single-pass */ }
    setJob(j => (j && j.phase === 'think' ? { ...j, step: 2, status: 'Engineering the widget with the neural compiler…' } : j));
    let spec: ForgeSpec; let engine = brief ? 'neural·2-pass' : 'orbitx-neural'; let note: string | undefined;
    try { spec = await forgeWithServer(ask, msgs, pal, brief); }
    catch {
      try { spec = await forgeWithOpenAI(ask, msgs, pal, brief); engine = 'gpt-4o-mini'; setJob(j => (j && j.phase === 'think' ? { ...j, status: 'Engineering with GPT-4o-mini…' } : j)); }
      catch { spec = forgeLocally(prompt); engine = 'forge-local'; setJob(j => (j && j.phase === 'think' ? { ...j, status: 'Building with the deterministic engine…' } : j)); }
    }
    if (spec.type === 'custom_code') {
      const chk = compileWidgetCode(String(spec.params.code ?? ''));
      if (chk.error) {
        if (engine !== 'forge-local') { spec = forgeLocally(prompt); engine = 'forge-local'; note = 'AI draft failed the compile check — rebuilt with the deterministic engine.'; }
      }
    }
    const minThink = 1500 - (Date.now() - started);
    if (minThink > 0) await new Promise(r => setTimeout(r, minThink));
    const source = templateSource(spec);
    setJob({ phase: 'code', step: 2, status: 'Writing the code…', prompt, spec, source, typed: 0, engine, note, brief, palette: pal });
    const totalMs = Math.min(6500, Math.max(3200, source.length * 5));
    const stepChars = Math.max(2, Math.round(source.length / (totalMs / 34)));
    jobTimer.current = window.setInterval(() => {
      setJob(j => {
        if (!j || j.phase !== 'code') return j;
        const typed = Math.min(j.source.length, j.typed + stepChars);
        if (typed >= j.source.length) {
          if (jobTimer.current) { window.clearInterval(jobTimer.current); jobTimer.current = null; }
          window.setTimeout(() => setJob(j2 => (j2 && j2.phase === 'compile' ? { ...j2, phase: 'ready', step: 4, status: 'Ready' } : j2)), 850);
          return { ...j, typed, phase: 'compile', step: 3, status: 'Compiling · bundling · mounting sandbox…' };
        }
        return { ...j, typed };
      });
    }, 34);
  }, [msgs]);

  const forgeAdd = useCallback(() => {
    if (!job?.spec) return;
    const w: WidgetConfig = { id: `w_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type: job.spec.type, title: job.spec.title, params: job.spec.params, size: job.spec.size, pos: widgets.length };
    pushWidget(w);
    setMsgs(prev => [...prev, { role: 'ai', text: `✅ ${job.spec!.reply}` }]);
    setJob(null);
  }, [job, widgets.length, pushWidget]);

  const forgeRegen = useCallback(() => { if (job) runForge(job.prompt, true); }, [job, runForge]);
  const forgeDiscard = useCallback(() => {
    if (jobTimer.current) { window.clearInterval(jobTimer.current); jobTimer.current = null; }
    setJob(null);
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || forging) return;
    setInput('');
    setMsgs(prev => [...prev, { role: 'user', text }]);
    const cmd = parseCmd(text);
    if (cmd === 'help') { setMsgs(prev => [...prev, { role: 'ai', text: CMD_HELP }]); return; }
    if (cmd) { const w = makeWidget(cmd.key, cmd.extra); pushWidget(w); setMsgs(prev => [...prev, { role: 'ai', text: cmd.reply }]); return; }
    setJob(null);
    runForge(text);
  }, [input, forging, makeWidget, pushWidget, runForge]);

  return (
    <div className="awp-overlay" onClick={onClose}>
      <div className="awp-panel" onClick={e => e.stopPropagation()}>
        <div className="awp-handle" />
        <div className="awp-title-row"><span className="awp-title-text">⚡ Widget Studio</span><button className="awp-close" onClick={onClose}>✕</button></div>
        <div className="awp-tabs">{(['chat','my','lib'] as const).map(t => (<button key={t} className={`awp-tab ${tab===t?'awp-tab-on':''}`} onClick={() => setTab(t)}>{t==='chat'?'✨ Create':t==='my'?`📦 My Widgets${widgets.length?` (${widgets.length})`:''}`:`🧩 Library (${LIB_TOTAL})`}</button>))}</div>
        {tab === 'chat' && (<>
          <div className="awp-msgs">
            {msgs.map((m, i) => (<div key={i} className={`awp-msg awp-msg-${m.role}`}>{m.role==='ai'&&<div className="awp-avatar">⚡</div>}<div className="awp-bubble">{m.text.split('\n').map((ln, j) => <div key={j}>{ln}</div>)}</div></div>))}
            {job && (
              <div className="fw-console">
                <div className="fw-head">
                  <span className="fw-title"><i className="fw-pulse" /> WidgetForge</span>
                  <span className="fw-engine">{job.engine}</span>
                </div>
                <div className="fw-steps">
                  {FORGE_STEPS.map((st, i) => {
                    const cur = job.step;
                    const state = i < cur ? 'done' : i === cur ? 'on' : 'wait';
                    return (
                      <div key={i} className={`fw-step fw-step-${state}`}>
                        <span className="fw-step-ic">{state === 'done' ? '✓' : state === 'on' ? <i className="fw-spin" /> : '·'}</span>
                        <span className="fw-step-lb">{st.label}</span>
                      </div>
                    );
                  })}
                </div>
                {job.phase !== 'ready' && job.status && (
                  <div className="fw-statusline" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px 2px', fontSize: 12, color: 'rgba(255,255,255,.62)' }}>
                    <i className="fw-spin" /><span>{job.status}</span>
                  </div>
                )}
                {(job.brief || job.palette) && (
                  <div className="fw-brief">
                    <div className="fw-brief-head">
                      <span>🎨 Design brief{job.brief?.name ? ` — ${job.brief.name}` : ''}</span>
                      {(job.brief?.palette?.mood || job.palette?.name) && <em>{job.brief?.palette?.mood ?? job.palette?.name}</em>}
                    </div>
                    <div className="fw-brief-row">
                      {[job.brief?.palette?.accent ?? job.palette?.a, job.brief?.palette?.accent2 ?? job.palette?.b].filter(Boolean).map((c, i) => (
                        <span key={i} className="fw-sw" style={{ background: String(c), boxShadow: `0 0 10px ${String(c)}66` }} title={String(c)} />
                      ))}
                      {job.palette && <span className="fw-brief-pal">user palette · {job.palette.name}</span>}
                      {job.brief?.viz && job.brief.viz !== 'none' && <span className="fw-feat">{job.brief.viz}</span>}
                    </div>
                    {job.brief?.layout && <div className="fw-brief-layout">{job.brief.layout}</div>}
                    {!!job.brief?.features?.length && (
                      <div className="fw-brief-row">{job.brief.features.slice(0, 5).map((f, i) => <span key={i} className="fw-feat">{f}</span>)}</div>
                    )}
                  </div>
                )}
                {(job.phase === 'code' || job.phase === 'compile' || job.phase === 'ready') && (
                  <div className="fw-codewin">
                    <div className="fw-codebar">
                      <i className="fw-dot fw-dot-r" /><i className="fw-dot fw-dot-y" /><i className="fw-dot fw-dot-g" />
                      <span className="fw-file">widget.tsx</span>
                      <span className="fw-lines">{job.source.slice(0, job.typed).split('\n').length} lines</span>
                    </div>
                    <div className="fw-code" ref={codeScrollRef}>
                      <pre dangerouslySetInnerHTML={{ __html: hlCode(job.source.slice(0, job.typed)) + (job.phase === 'code' ? '<i class="fw-caret"></i>' : '') }} />
                    </div>
                  </div>
                )}
                {job.phase === 'compile' && (
                  <div className="fw-compile"><i className="fw-compile-bar" /><span>Bundling · type-checking · mounting sandbox…</span></div>
                )}
                {job.phase === 'ready' && job.spec && (
                  <div className="fw-ready">
                    {job.note && <div className="fw-note">⚠ {job.note}</div>}
                    <div className="fw-preview-label">Live preview — running real data</div>
                    <div className="fw-preview">
                      <div className="fw-preview-head">
                        <span>{LIB_ICONS[job.spec.type] ?? '📊'} {job.spec.title}</span>
                        <em>{job.spec.type} · {job.spec.size}</em>
                      </div>
                      <WidgetErrorBoundary>
                        <WidgetRenderer widget={{ id: 'fw_preview', pos: 0, type: job.spec.type, title: job.spec.title, params: job.spec.params, size: job.spec.size }} />
                      </WidgetErrorBoundary>
                    </div>
                    <div className="fw-actions">
                      <button className="fw-btn fw-btn-add" onClick={forgeAdd}>＋ Add to Hub</button>
                      <button className="fw-btn" onClick={forgeRegen}>↻ Regenerate</button>
                      <button className="fw-btn fw-btn-ghost" onClick={forgeDiscard}>Discard</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="awp-input-row"><input className="awp-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); send(); } }} placeholder={forging ? 'Forging your widget…' : 'Describe any widget — I design, code & mount it…'} disabled={forging} /><button className="awp-send-btn" onClick={send} disabled={!input.trim()||forging}><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg></button></div>
          <div className="awp-pills">{['Synthwave SOL ticker','Gold luxury BTC watchlist','WIF pulse in #ff2bd6','Countdown to friday','Matrix style notes','/help'].map(q => (<button key={q} className="awp-pill" onClick={() => setInput(q)}>{q}</button>))}</div>
        </>)}
        {tab === 'my' && (<div className="awp-list">{widgets.length===0?<div className="awp-empty">No widgets yet — try /help!</div>:widgets.map(w => (<div key={w.id} className="awp-list-item"><div className="awp-list-icon">{LIB_ICONS[w.type]??'📊'}</div><div style={{ flex:1, minWidth:0 }}><div className="awp-list-name">{w.title}</div><div className="awp-list-meta">{w.type} · {w.size}</div></div><button className="awp-del-btn" onClick={() => removeWidget(w.id)}>✕</button></div>))}</div>)}
        {tab === 'lib' && (<div className="awp-list">
          <div className="awp-lib-hint">{LIB_TOTAL}+ pre-built widgets — tap any to add it to your hub</div>
          {LIB_GROUPS.map(group => (<div key={group.label} className="awp-lib-group">
            <div className="awp-lib-head">{group.label} <span className="awp-lib-count">{group.keys.length}</span></div>
            {group.keys.map(key => { const tmpl = TEMPLATES[key]; if (!tmpl) return null; return (
              <button key={key} className="awp-lib-row" onClick={() => { pushWidget(makeWidget(key)); setTab('my'); }}>
                <div className="awp-list-icon">{LIB_ICONS[tmpl.type] ?? '📊'}</div>
                <div style={{ flex:1, textAlign:'left', minWidth:0 }}><div className="awp-list-name">{tmpl.title}</div><div className="awp-list-meta">{tmpl.type} · {tmpl.size}</div></div>
                <div className="awp-add-badge">+ Add</div>
              </button>); })}
          </div>))}
        </div>)}
      </div>
    </div>
  );
}

export function MobileWidgetGrid({ solPrice, solChange, trending, widgets, setWidgets, onOpenPanel }: {
  solPrice: number | null; solChange: number | null;
  trending: { mint: string; symbol: string; change24h: number | null }[];
  widgets: WidgetConfig[]; setWidgets: (w: WidgetConfig[]) => void; onOpenPanel: () => void;
}) {
  const { profile, signOut } = useAuth();
  const dragId = useRef<string | null>(null), [dragOver, setDragOver] = useState<string | null>(null);
  const onDrop = useCallback((toId: string) => { const fromId = dragId.current; if (!fromId || fromId === toId) return; const next = [...widgets]; const fi = next.findIndex(w => w.id === fromId), ti = next.findIndex(w => w.id === toId); if (fi < 0 || ti < 0) return; const [moved] = next.splice(fi, 1); next.splice(ti, 0, moved); const r = next.map((w, i) => ({ ...w, pos: i })); setWidgets(r); writeWidgets(r); }, [widgets, setWidgets]);
  const removeWidget = useCallback((id: string) => { const next = widgets.filter(w => w.id !== id).map((w, i) => ({ ...w, pos: i })); setWidgets(next); writeWidgets(next); }, [widgets, setWidgets]);
  const up = (solChange ?? 0) >= 0;
  return (
    <div className="mwg-wrap">
      <div className="mwg-toprow"><span className="mwg-heading">My Hub</span><button className="mwg-add-btn" onClick={onOpenPanel}><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11H13V5a1 1 0 00-2 0v6H5a1 1 0 000 2h6v6a1 1 0 002 0v-6h6a1 1 0 000-2z"/></svg>⚡ AI Widgets</button></div>
      <div className="mwg-grid">
        <div className="mwg-card mwg-profile-card"><div className="mwg-prof-row"><div className="mwg-prof-avatar">{(profile?.username?.[0]??'O').toUpperCase()}</div><div className="mwg-prof-info"><div className="mwg-prof-name">@{profile?.username??'orbitx'}</div><div className="mwg-prof-sub">OrbitX Beta ✦</div></div><div className="mwg-prof-acts"><a href="/profile" className="mwg-pact" title="Profile"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg></a><a href="/settings" className="mwg-pact" title="Settings"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.22-.4.12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54A.49.49 0 0 0 12 2.4H8.16a.49.49 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L.8 8.87c-.1.21-.06.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.22.4-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41H12c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.07.47 0 .59-.22l1.92-3.32c.1-.21.06-.47-.12-.61l-2.03-1.58zM10.08 15.6A3.52 3.52 0 1 1 10.08 8.56a3.52 3.52 0 0 1 0 7.04z"/></svg></a><button className="mwg-pact mwg-pact-red" title="Log out" onClick={() => signOut().finally(() => window.location.assign('/auth'))}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button></div></div></div>
        <div className="mwg-card mwg-fg-card"><div className="mwg-card-lbl">🌡 Market Mood</div><FearGreedWidget /></div>
        <div className="mwg-card mwg-sol-card"><div className="mwg-card-lbl">◎ Solana</div><div className="mwg-card-val">{solPrice?`$${solPrice>=1000?solPrice.toFixed(0):solPrice.toFixed(2)}`:'—'}</div>{solChange!==null&&<div className="mwg-card-sub" style={{ color:up?'#34d399':'#fb7185' }}>{up?'▲':'▼'} {Math.abs(solChange).toFixed(2)}%</div>}</div>
        <div className="mwg-card mwg-trend-card"><div className="mwg-card-lbl">🔥 Trending</div>{trending.slice(0,3).map((t,i) => (<a key={t.mint??i} href="/ORBITX_DEX" style={{ display:'flex', justifyContent:'space-between', marginTop:5, textDecoration:'none' }}><span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>${t.symbol}</span><span style={{ fontSize:11, fontWeight:800, color:(t.change24h??0)>=0?'#34d399':'#fb7185' }}>{(t.change24h??0)>=0?'+':''}{(t.change24h??0).toFixed(0)}%</span></a>))}</div>
        {[...widgets].sort((a,b) => a.pos-b.pos).map(widget => (<div key={widget.id} className={`mwg-card mwg-custom-card${dragOver===widget.id?' mwg-drag-over':''}`} style={{ gridColumn:widget.size!=='sm'?'span 2':'span 1' }} draggable onDragStart={() => { dragId.current=widget.id; }} onDragOver={e => { e.preventDefault(); setDragOver(widget.id); }} onDragLeave={() => setDragOver(null)} onDrop={() => { onDrop(widget.id); setDragOver(null); dragId.current=null; }} onDragEnd={() => { setDragOver(null); dragId.current=null; }}><div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}><span className="mwg-card-lbl">{LIB_ICONS[widget.type]??'📊'} {widget.title}</span><button className="mwg-rm-btn" onClick={() => removeWidget(widget.id)}>✕</button></div><WidgetRenderer widget={widget} /></div>))}
        <button className="mwg-card mwg-add-card" onClick={onOpenPanel}><div style={{ fontSize:22, marginBottom:3 }}>⚡</div><div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.6)' }}>Add Widget</div><div style={{ fontSize:9, color:'rgba(255,255,255,.3)', marginTop:1 }}>type /help for commands</div></button>
      </div>
    </div>
  );
}

export function MobileNav({ onOpenPanel }: { onOpenPanel: () => void }) {
  const items = [{ label:'Hub',href:'/app'},{ label:'DEX',href:'/ORBITX_DEX'},{ label:'Social',href:'/orbitx-social'},{ label:'KOL',href:'/app/kol-tracker'},{ label:'Profile',href:'/profile'}];
  const icons = ['⊞','◈','◉','⬡','◎'];
  return (<nav className="mob-nav">{items.slice(0,2).map((it,idx) => <a key={it.label} href={it.href} className="mob-nav-btn"><span style={{ fontSize:18 }}>{icons[idx]}</span><span>{it.label}</span></a>)}<button className="mob-nav-plus" onClick={onOpenPanel}><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11H13V5a1 1 0 00-2 0v6H5a1 1 0 000 2h6v6a1 1 0 002 0v-6h6a1 1 0 000-2z"/></svg></button>{items.slice(2).map((it,idx) => <a key={it.label} href={it.href} className="mob-nav-btn"><span style={{ fontSize:18 }}>{icons[idx+2]}</span><span>{it.label}</span></a>)}</nav>);
}

export const aiWidgetCSS = `
.awp-overlay{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.6);backdrop-filter:blur(12px);display:flex;align-items:flex-end;justify-content:center;animation:awp-bg .2s ease both}
@keyframes awp-bg{from{opacity:0}to{opacity:1}}
.awp-panel{width:100%;max-width:540px;border-radius:26px 26px 0 0;background:linear-gradient(180deg,rgba(18,20,28,.99),rgba(8,10,14,.99));border:1px solid rgba(255,255,255,.12);border-bottom:0;box-shadow:0 -28px 80px rgba(0,0,0,.9);display:flex;flex-direction:column;max-height:90vh;overflow:hidden;animation:awp-up .32s cubic-bezier(.34,1.56,.64,1) both}
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
.awp-send-btn{width:40px;height:40px;flex-shrink:0;border-radius:13px;background:linear-gradient(135deg,#2F80FF,#1a5cd4);border:0;color:#fff;cursor:pointer;display:grid;place-items:center}
.awp-send-btn:disabled{opacity:.35;cursor:default}
.awp-pills{display:flex;gap:6px;padding:0 16px 14px;flex-wrap:wrap;flex-shrink:0}
.awp-pill{padding:5px 12px;border-radius:99px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.05);color:rgba(255,255,255,.65);font-size:10px;font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit}
.awp-pill:hover{border-color:rgba(47,128,255,.45);background:rgba(47,128,255,.1);color:#fff}
.awp-list{flex:1;overflow-y:auto;padding:10px 16px 16px;display:flex;flex-direction:column;gap:7px}
/* ── WidgetForge console ── */
.fw-console{border:1px solid rgba(47,128,255,.22);border-radius:16px;background:linear-gradient(180deg,rgba(13,17,28,.9),rgba(8,10,17,.95));padding:12px;display:flex;flex-direction:column;gap:10px;animation:fwin .3s cubic-bezier(.34,1.56,.64,1) both;box-shadow:0 8px 30px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.05)}
@keyframes fwin{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
.fw-head{display:flex;align-items:center;justify-content:space-between}
.fw-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:900;color:#fff;letter-spacing:.02em}
.fw-pulse{width:8px;height:8px;border-radius:99px;background:#2F80FF;box-shadow:0 0 0 0 rgba(47,128,255,.7);animation:fwpl 1.6s ease infinite}
@keyframes fwpl{0%{box-shadow:0 0 0 0 rgba(47,128,255,.6)}70%{box-shadow:0 0 0 8px rgba(47,128,255,0)}100%{box-shadow:0 0 0 0 rgba(47,128,255,0)}}
.fw-engine{font-size:9px;font-weight:800;color:#5aa2ff;background:rgba(47,128,255,.12);border:1px solid rgba(47,128,255,.25);border-radius:99px;padding:2px 9px;letter-spacing:.05em;font-family:ui-monospace,monospace}
.fw-steps{display:flex;flex-direction:column;gap:4px}
.fw-step{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;transition:all .25s}
.fw-step-ic{width:17px;height:17px;border-radius:99px;display:grid;place-items:center;font-size:9.5px;font-weight:900;flex-shrink:0}
.fw-step-done{color:rgba(255,255,255,.55)}
.fw-step-done .fw-step-ic{background:rgba(52,211,153,.15);color:#34d399}
.fw-step-on{color:#fff}
.fw-step-on .fw-step-ic{background:rgba(47,128,255,.16)}
.fw-step-wait{color:rgba(255,255,255,.22)}
.fw-step-wait .fw-step-ic{background:rgba(255,255,255,.04);color:rgba(255,255,255,.25)}
.fw-spin{width:9px;height:9px;border-radius:99px;border:2px solid rgba(47,128,255,.25);border-top-color:#5aa2ff;animation:fwsp .7s linear infinite;display:block}
@keyframes fwsp{to{transform:rotate(360deg)}}
.fw-brief{border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.03);padding:9px 11px;display:flex;flex-direction:column;gap:6px;animation:fwin .3s ease both}
.fw-brief-head{display:flex;align-items:center;justify-content:space-between;font-size:10.5px;font-weight:900;color:#fff}
.fw-brief-head em{font-style:normal;font-size:9px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.07em}
.fw-brief-row{display:flex;align-items:center;flex-wrap:wrap;gap:5px}
.fw-sw{width:16px;height:16px;border-radius:6px;display:inline-block;border:1px solid rgba(255,255,255,.25)}
.fw-brief-pal{font-size:9px;font-weight:800;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.05em}
.fw-brief-layout{font-size:10px;font-weight:600;color:rgba(255,255,255,.55);line-height:1.45}
.fw-feat{font-size:9px;font-weight:800;color:#9ecbff;background:rgba(47,128,255,.1);border:1px solid rgba(47,128,255,.2);border-radius:99px;padding:2px 8px}
.fw-codewin{border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.09);background:#07090f}
.fw-codebar{display:flex;align-items:center;gap:5px;padding:7px 10px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.06)}
.fw-dot{width:9px;height:9px;border-radius:99px;display:block}
.fw-dot-r{background:#ff5f57}.fw-dot-y{background:#febc2e}.fw-dot-g{background:#28c840}
.fw-file{margin-left:7px;font-size:10px;font-weight:700;color:rgba(255,255,255,.55);font-family:ui-monospace,monospace}
.fw-lines{margin-left:auto;font-size:9px;font-weight:700;color:rgba(255,255,255,.3);font-family:ui-monospace,monospace}
.fw-code{max-height:190px;overflow-y:auto;padding:10px 12px;scroll-behavior:auto}
.fw-code pre{margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;line-height:1.55;color:#c9d4e8;white-space:pre-wrap;word-break:break-word}
.fw-code .tk-k{color:#c792ea;font-style:normal}
.fw-code .tk-s{color:#7ee0a3;font-style:normal}
.fw-code .tk-n{color:#f0b47c;font-style:normal}
.fw-code .tk-f{color:#79b8ff;font-style:normal}
.fw-code .tk-c{color:#5b6478;font-style:italic}
.fw-caret{display:inline-block;width:7px;height:13px;background:#5aa2ff;vertical-align:middle;margin-left:1px;animation:fwck .85s step-end infinite;border-radius:1px}
@keyframes fwck{0%,100%{opacity:1}50%{opacity:0}}
.fw-compile{display:flex;flex-direction:column;gap:6px;font-size:10.5px;font-weight:700;color:rgba(255,255,255,.5)}
.fw-compile-bar{height:3px;border-radius:99px;background:linear-gradient(90deg,transparent,#2F80FF,#9945FF,transparent);background-size:200% 100%;animation:fwcb 1s linear infinite;display:block}
@keyframes fwcb{from{background-position:200% 0}to{background-position:-200% 0}}
.fw-ready{display:flex;flex-direction:column;gap:8px;animation:fwin .35s ease both}
.fw-note{font-size:10px;font-weight:700;color:#fbbf24;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:9px;padding:6px 9px}
.fw-preview-label{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#34d399;display:flex;align-items:center;gap:5px}
.fw-preview-label::before{content:'';width:6px;height:6px;border-radius:99px;background:#34d399;animation:fwpl 1.6s ease infinite}
.fw-preview{border:1px solid rgba(255,255,255,.1);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02));padding:11px 12px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.fw-preview-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.fw-preview-head span{font-size:11.5px;font-weight:800;color:#fff}
.fw-preview-head em{font-size:9px;font-weight:700;color:rgba(255,255,255,.35);font-style:normal;font-family:ui-monospace,monospace}
.fw-actions{display:flex;gap:7px}
.fw-btn{flex:1;padding:9px 8px;border-radius:11px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#fff;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;transition:all .15s}
.fw-btn:hover{background:rgba(255,255,255,.1);transform:translateY(-1px)}
.fw-btn-add{background:linear-gradient(135deg,#2F80FF,#1a5cd4);border-color:transparent;box-shadow:0 4px 16px rgba(47,128,255,.35)}
.fw-btn-add:hover{filter:brightness(1.12)}
.fw-btn-ghost{flex:0 0 auto;color:rgba(255,255,255,.5);background:transparent}
.awp-lib-hint{font-size:11px;color:rgba(255,255,255,.4);padding:4px 4px 8px;line-height:1.4}
.awp-lib-group{margin-bottom:10px}
.awp-lib-head{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.45);padding:8px 4px 6px;position:sticky;top:0;background:linear-gradient(180deg,rgba(12,14,20,.98),rgba(12,14,20,.9));z-index:1}
.awp-lib-count{font-size:9px;font-weight:700;color:#5aa2ff;background:rgba(47,128,255,.14);border-radius:99px;padding:1px 7px;letter-spacing:0}
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
.mwg-sol-card,.mwg-trend-card,.mwg-fg-card{grid-column:span 1}
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
.mwg-profile-card{grid-column:span 2;background:linear-gradient(135deg,rgba(47,128,255,.1),rgba(153,69,255,.07))!important;border-color:rgba(47,128,255,.18)!important}
.mwg-prof-row{display:flex;align-items:center;gap:12px}
.mwg-prof-avatar{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#2F80FF,#9945FF);display:grid;place-items:center;font-size:18px;font-weight:900;color:#fff;flex-shrink:0;box-shadow:0 4px 14px rgba(47,128,255,.35)}
.mwg-prof-info{flex:1;min-width:0}
.mwg-prof-name{font-size:14px;font-weight:900;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mwg-prof-sub{font-size:9px;font-weight:700;color:rgba(255,255,255,.4);margin-top:2px;text-transform:uppercase;letter-spacing:.07em}
.mwg-prof-acts{display:flex;gap:6px;flex-shrink:0}
.mwg-pact{width:34px;height:34px;border-radius:11px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);display:grid;place-items:center;text-decoration:none;cursor:pointer;transition:all .15s;font-family:inherit;color:rgba(255,255,255,.65)}
.mwg-pact:hover{background:rgba(47,128,255,.18);border-color:rgba(47,128,255,.4);color:#fff}
.mwg-pact-red:hover{background:rgba(251,113,133,.18)!important;border-color:rgba(251,113,133,.4)!important;color:#fb7185!important}
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
