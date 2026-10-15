/**
 * OrbitX Social Center — "The place to chat, discover and find what's happening on chain."
 * X.com-format shell (3-col web / bottom-tab mobile) with OrbitX identity:
 * blue (#3b82f6) primary · gold (#f0c75e) verified/premium · black/white base.
 *
 * Data layer: Supabase social_messages (channel "social-general"), profiles,
 * communities, followers, notifications. All queries/realtime/actions preserved.
 */
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Home, Search, Bell, Mail, Globe, User,
  Feather, X as XIcon, Heart, MessageCircle, Repeat2, Share, MoreHorizontal,
  Trash2, Copy, Flag, BadgeCheck, Loader2, TrendingUp, ArrowUpRight,
  ArrowDownRight, Users, Bookmark, LogOut, Settings, Coins, Image as ImageIcon, Smile,
  Sparkles, Zap, Shield, Wallet, ChevronRight, Check, BarChart3, ExternalLink,
  Gift, ArrowLeftRight, TrendingDown, Siren, Lock, Gem,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { validateUploadFile, safeExtForMime } from "@/lib/safeUpload";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn, safeAvatarUrl } from "@/lib/utils";
import "./x-social.css";
import { embedSnippet } from "./embeds";
import { AgentBadge } from "./VerifiedHoldings";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { callSupercomputerTool } from "@/tokenomics/mcpClient";
import { getBillingAuthCode } from "@/tokenomics/auth";
import {
  TradeSheet, TipSheet, SirenCard, extractCallTokens, isSirenContent,
  fetchRugFlaggers, hasFlagged, RUG_SIREN_THRESHOLD,
  type TradeMode,
} from "./social-trade";

/* ── Lazy heavy tabs (reuse existing pages — zero functionality lost) ── */
const ChatHub = lazy(() => import("@/pages/SocialHub"));
const RoomsPage = lazy(() => import("@/pages/CommunityRooms"));
const SpacesPage = lazy(() => import("@/pages/Spaces"));
const CommunitiesPage = lazy(() => import("@/pages/Communities"));
const MessagesPage = lazy(() => import("@/pages/DirectMessages"));
const ProfilePage = lazy(() => import("@/components/profile-20x/UserProfile"));

/* ═══════════ Types ═══════════ */
export type XTab =
  | "home" | "explore" | "notifications" | "messages"
  | "communities" | "profile" | "bookmarks";

interface Post {
  id: string; user_id: string; username: string | null; avatar_url: string | null;
  content: string; likes_count: number | null; liked_by: string[] | null; created_at: string; reply_to?: string | null; repost_of?: string | null;
  gate_meta?: GateMeta | null; nft_mint?: string | null; nft_price_usd?: number | null;
}
/** Token gate for a "Holders only" post (social_messages.gate_meta JSONB). */
interface GateMeta {
  kind?: string | null;
  mint: string;
  symbol?: string | null;
  min_amount: number;
}
interface Suggestion { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null; is_official_account?: boolean | null; bio?: string | null; }
interface Ticker { mint: string; symbol: string | null; priceUsd: number | null; change24h: number | null; }
interface NotifRow { id: string; type: string; title: string; message: string; is_read: boolean; created_at: string; }
interface CommunityLite { id: string; name: string; description: string | null; member_count: number | null; avatar_url?: string | null; icon?: string | null; category?: string | null; }

const FEED_CHANNEL = "social-general";
const MAX_LEN = 500;
const BOOKMARKS_KEY = "orbitx-x-bookmarks";
const DRAFT_KEY = "orbitx-x-draft";
const ONBOARD_KEY = "orbitx-social-onboarded";
const EMOJIS = ["🔥", "🚀", "💎", "📈", "📉", "🐂", "🐻", "🤝", "💰", "🎯", "👀", "🙌", "😂", "😅", "😎", "🤔", "🫡", "🧠", "⚡", "✨", "🌙", "☀️", "💯", "🏆", "👑", "🥳", "😤", "🤯", "🫠", "💀", "🤡", "🧢", "🐋", "🦍", "🍀", "⏰", "📊", "❤️", "🎉", "🙏"];

const dicebear = (seed: string) => `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(seed || "og")}`;
const avatarOf = (url: string | null | undefined, seed: string) => safeAvatarUrl(url) || dicebear(seed);

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (isNaN(s) || s < 0) return "now";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* Token mentions ($SYMBOL) → blue, #tags → gold, @users → blue, mints → mono link. */
function renderContent(text: string, onMint?: (m: string) => void) {
  const parts: (string | JSX.Element)[] = [];
  const tokenRe = /(\$[A-Za-z][A-Za-z0-9]{1,14}|@[A-Za-z0-9_]{2,20}|#[A-Za-z0-9_]{2,30}|https?:\/\/[^\s]+|[1-9A-HJ-NP-Za-km-z]{32,44})/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("$")) {
      // Deep-link $cashtags to the trade app when we know the mint.
      const mint = mintForCashtag(tok.slice(1));
      if (mint) parts.push(<a key={i++} href={`/trade/token/${mint}`} onClick={(e) => e.stopPropagation()} className="osc-mention" title={`Trade $${tok.slice(1)} on OrbitX`}>{tok}</a>);
      else parts.push(<span key={i++} className="osc-mention">{tok}</span>);
    }
    else if (tok.startsWith("#")) parts.push(<span key={i++} className="osc-tag">{tok}</span>);
    else if (tok.startsWith("@")) parts.push(<span key={i++} className="osc-mention">{tok}</span>);
    else if (tok.startsWith("http")) parts.push(<a key={i++} href={tok} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="osc-mention break-all">{tok}</a>);
    else if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(tok)) parts.push(<button key={i++} type="button" onClick={(e) => { e.stopPropagation(); onMint?.(tok); }} className="font-mono text-[12px] text-[#60a5fa] hover:underline">{tok.slice(0, 4)}…{tok.slice(-4)}</button>);
    else parts.push(tok);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function loadBookmarks(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "[]")); } catch { return new Set(); }
}
function saveBookmarks(s: Set<string>) {
  try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
}

/* ── $cashtag → mint map (powers trade deep-links) ── */
const CASHTAG_MINTS_KEY = "orbitx-cashtag-mints";
const cashtagMints = new Map<string, string>(); // UPPER_SYMBOL -> mint
try {
  const raw = localStorage.getItem(CASHTAG_MINTS_KEY);
  if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, string>)) cashtagMints.set(k.toUpperCase(), v);
} catch { /* ignore */ }
function saveCashtagMint(symbol: string, mint: string) {
  if (!symbol || !mint) return;
  cashtagMints.set(symbol.toUpperCase(), mint);
  try {
    const obj: Record<string, string> = {};
    cashtagMints.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(CASHTAG_MINTS_KEY, JSON.stringify(obj));
  } catch { /* ignore */ }
}
const mintForCashtag = (symbol: string): string | null => cashtagMints.get(symbol.toUpperCase()) || null;

/* ── Chart embeds: [chart:<mint>] markers in post text ── */
const CHART_RE = /\[chart:([1-9A-HJ-NP-Za-km-z]{32,44})\]/g;
function splitCharts(content: string): { text: string; charts: string[] } {
  const safe = content || "";
  const charts: string[] = [];
  let m: RegExpExecArray | null;
  CHART_RE.lastIndex = 0;
  while ((m = CHART_RE.exec(safe)) !== null) charts.push(m[1]);
  const text = safe.replace(CHART_RE, "").replace(/\n{3,}/g, "\n\n").trim();
  return { text, charts: [...new Set(charts)].slice(0, 2) };
}

interface CoinLite { mint: string; symbol: string | null; name: string | null; icon: string | null; priceUsd: number | null; change24h: number | null; }

/* Search Solana tokens by symbol/name — DexScreener, highest liquidity first. */
async function searchCoins(q: string): Promise<CoinLite[]> {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
    const d = await r.json();
    const seen = new Set<string>();
    return (((d && d.pairs) || []) as any[])
      .filter((p) => p.chainId === "solana" && p.baseToken?.address)
      .sort((a, b) => Number(b.liquidity?.usd ?? 0) - Number(a.liquidity?.usd ?? 0))
      .filter((p) => (seen.has(p.baseToken.address) ? false : (seen.add(p.baseToken.address), true)))
      .slice(0, 8)
      .map((p) => ({
        mint: p.baseToken.address as string,
        symbol: (p.baseToken.symbol as string) ?? null,
        name: (p.baseToken.name as string) ?? null,
        icon: (p.info?.imageUrl as string) ?? null,
        priceUsd: p.priceUsd != null ? Number(p.priceUsd) : null,
        change24h: p.priceChange?.h24 != null ? Number(p.priceChange.h24) : null,
      } as CoinLite));
  } catch { return []; }
}

function fmtPrice(v: number | null): string {
  if (v == null) return "—";
  if (v === 0) return "$0";
  if (v < 0.0001) return "$" + v.toExponential(2);
  if (v < 1) return "$" + v.toFixed(4);
  return "$" + v.toLocaleString(undefined, { maximumFractionDigits: v < 100 ? 2 : 0 });
}

/* Pull image URLs out of post text so they render as real media, X-style. */
const IMG_URL_RE = /https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s]*)?/gi;
function splitMedia(content: string): { text: string; imgs: string[] } {
  const safe = content || "";
  const imgs = safe.match(IMG_URL_RE) || [];
  let text = safe;
  for (const u of imgs) text = text.replace(u, "").trim();
  return { text, imgs: imgs.slice(0, 4) };
}

/* ═══════════ Nav config ═══════════ */
type NavIcon = React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
const NAV: { id: XTab; label: string; Icon: NavIcon }[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "explore", label: "Explore", Icon: Search },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "messages", label: "Messages", Icon: Mail },
  { id: "communities", label: "Communities", Icon: Users },
  { id: "bookmarks", label: "Bookmarks", Icon: Bookmark },
  { id: "profile", label: "Profile", Icon: User },
];

/* Mobile dock: 4 core tabs + More sheet (Communities, Bookmarks, Profile). */
const CORE_TABS: XTab[] = ["home", "explore", "notifications", "messages"];
const MORE_TABS: XTab[] = ["communities", "bookmarks", "profile"];

const TAB_SHORT: Record<XTab, string> = {
  home: "Home",
  explore: "Explore",
  notifications: "Alerts",
  messages: "Messages",
  communities: "Groups",
  bookmarks: "Saved",
  profile: "Profile",
};

/* Old sidebar/CommunityHub deep-link keys -> shell tabs (keeps every legacy entry point working) */
const ENTRY_MAP: Record<string, XTab> = {
  channels: "messages", social: "messages", chat: "messages",
  rooms: "communities", voice: "communities", spaces: "communities",
  communities: "communities", discover: "communities",
};

function resolveInitialTab(preferred?: XTab): XTab {
  try {
    const entry = localStorage.getItem("og_comm_entry");
    if (entry) {
      localStorage.removeItem("og_comm_entry");
      const mapped = ENTRY_MAP[entry];
      if (mapped) return mapped;
    }
  } catch { /* ignore */ }
  if (preferred) return preferred;
  try {
    const saved = localStorage.getItem("og_x_tab") as XTab | null;
    if (saved && NAV.some((n) => n.id === saved)) return saved;
  } catch { /* ignore */ }
  return "home";
}

/** Tabs that use the classic X 600px center column + right rail. */
const NARROW_TABS: XTab[] = ["home", "explore", "notifications", "bookmarks"];

const Spinner = () => (
  <div className="flex h-40 items-center justify-center">
    <Loader2 className="h-5 w-5 animate-spin text-white/30" />
  </div>
);

/* ═══════════ Onboarding flow ═══════════ */
const ONBOARD_INTERESTS = [
  { id: "memecoins", label: "Memecoins", Icon: Zap },
  { id: "defi", label: "DeFi", Icon: Coins },
  { id: "nfts", label: "NFTs", Icon: Sparkles },
  { id: "trading", label: "Trading calls", Icon: TrendingUp },
  { id: "alpha", label: "Alpha & news", Icon: Globe },
  { id: "dev", label: "Dev & building", Icon: Shield },
];

function OnboardingFlow({ suggestions, onFollow, onDone, onConnectWallet, onFirstPost }: {
  suggestions: Suggestion[];
  onFollow: (uid: string) => void;
  onDone: () => void;
  onConnectWallet: () => void;
  onFirstPost: () => void;
}) {
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const toggleInterest = (id: string) => setInterests((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const follow = (uid: string) => { setFollowed((p) => new Set(p).add(uid)); onFollow(uid); };
  const steps = ["Welcome", "Interests", "People", "Wallet"];
  return (
    <div className="osc-onb">
      <div className="osc-onb__card x-rise">
        <div className="osc-onb__dots">
          {steps.map((_, i) => <span key={i} className={cn("osc-onb__dot", i <= step && "osc-onb__dot--on")} />)}
        </div>
        <div className="osc-onb__mark">O</div>

        {step === 0 && (
          <>
            <div className="osc-onb__title">Welcome to <em>OrbitX Social Center</em></div>
            <p className="osc-onb__sub">The place to chat, discover and find what's happening on chain. Post your calls, track the trenches, and never miss a move.</p>
            <div className="osc-onb__nav">
              <button type="button" onClick={() => setStep(1)} className="osc-btn-primary">Get started <ChevronRight className="inline h-4 w-4 -mt-0.5" /></button>
            </div>
            <button type="button" onClick={onDone} className="mt-4 text-[13px] font-bold text-white/35 hover:text-white/60">Skip for now</button>
          </>
        )}

        {step === 1 && (
          <>
            <div className="osc-onb__title">What are you <em>into?</em></div>
            <p className="osc-onb__sub">Pick a few — we'll tune your For You feed around them.</p>
            <div className="osc-onb__grid">
              {ONBOARD_INTERESTS.map(({ id, label, Icon }) => (
                <button key={id} type="button" onClick={() => toggleInterest(id)} className={cn("osc-onb__opt", interests.has(id) && "osc-onb__opt--on")}>
                  <Icon className="h-4 w-4 shrink-0" /> {label}
                  {interests.has(id) && <Check className="ml-auto h-4 w-4 text-[#3b82f6]" />}
                </button>
              ))}
            </div>
            <div className="osc-onb__nav">
              <button type="button" onClick={() => setStep(0)} className="osc-btn-ghost">Back</button>
              <button type="button" onClick={() => setStep(2)} className="osc-btn-primary">Continue</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="osc-onb__title">Follow the <em>trenches</em></div>
            <p className="osc-onb__sub">Start with a few voices worth hearing.</p>
            <div className="my-5 max-h-64 space-y-1 overflow-y-auto text-left">
              {suggestions.slice(0, 8).map((s) => (
                <div key={s.user_id} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white/[0.04]">
                  <img src={avatarOf(s.avatar_url, s.user_id)} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-[14px] font-extrabold text-white">
                      <span className="truncate">{s.display_name || s.username}</span>
                      {s.is_official_account && <BadgeCheck className="h-4 w-4 shrink-0 text-[#f0c75e]" />}
                    </div>
                    <div className="truncate text-[12px] text-white/40">@{s.username}</div>
                  </div>
                  {followed.has(s.user_id) ? (
                    <span className="flex items-center gap-1 rounded-full bg-[#3b82f6]/15 px-4 py-1.5 text-[13px] font-bold text-[#60a5fa]"><Check className="h-3.5 w-3.5" /> On</span>
                  ) : (
                    <button type="button" onClick={() => follow(s.user_id)} className="rounded-full bg-white px-4 py-1.5 text-[13px] font-extrabold text-black transition hover:bg-white/85 active:scale-95">Follow</button>
                  )}
                </div>
              ))}
              {suggestions.length === 0 && <div className="py-6 text-center text-[13px] text-white/40">Loading suggestions…</div>}
            </div>
            <div className="osc-onb__nav">
              <button type="button" onClick={() => setStep(1)} className="osc-btn-ghost">Back</button>
              <button type="button" onClick={() => setStep(3)} className="osc-btn-primary">Continue</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="osc-onb__mark" style={{ background: "linear-gradient(135deg,#f0c75e,#f5d67b)" }}><Wallet className="h-7 w-7 text-black" /></div>
            <div className="osc-onb__title">One wallet, <em>everywhere</em></div>
            <p className="osc-onb__sub">Your OrbitX in-app wallet powers trading, tips and the whole platform. Connect it once and you're set.</p>
            <div className="osc-onb__nav" style={{ marginTop: 22 }}>
              <button type="button" onClick={() => setStep(2)} className="osc-btn-ghost">Back</button>
              <button type="button" onClick={onConnectWallet} className="osc-btn-primary">Connect wallet</button>
            </div>
            <button type="button" onClick={() => { onDone(); onFirstPost(); }} className="mt-4 text-[13px] font-bold text-[#60a5fa] hover:underline">Skip — take me to the feed</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════ Tweetable chart card — real interactive chart ═══════════ */
const TF_OPTS = [
  { id: "1h", label: "1H", interval: "5m", limit: 12 },
  { id: "24h", label: "24H", interval: "1h", limit: 24 },
  { id: "7d", label: "7D", interval: "4h", limit: 42 },
] as const;

function ChartCard({ mint }: { mint: string }) {
  const [coin, setCoin] = useState<CoinLite | null>(null);
  const [tf, setTf] = useState<(typeof TF_OPTS)[number]>(TF_OPTS[1]);
  const [points, setPoints] = useState<{ time: number; value: number }[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartApi = useRef<any>(null);
  const seriesApi = useRef<any>(null);

  // Live token snapshot
  useEffect(() => {
    let on = true;
    fetch(`/api/ogdex/token?mint=${mint}`)
      .then((r) => r.json())
      .then((d) => {
        if (!on || !d?.token) return;
        const t = d.token;
        const c: CoinLite = {
          mint, symbol: t.symbol ?? null, name: t.name ?? null, icon: t.icon ?? null,
          priceUsd: t.priceUsd ?? null,
          change24h: t.priceChange24h ?? t.change24h ?? null,
        };
        setCoin(c);
        if (c.symbol) saveCashtagMint(c.symbol, mint);
      })
      .catch(() => {});
    return () => { on = false; };
  }, [mint]);

  // Candles for the selected timeframe
  useEffect(() => {
    let on = true;
    setPoints([]);
    fetch(`/api/ogdex/chart?mint=${mint}&interval=${tf.interval}&limit=${tf.limit}`)
      .then((r) => r.json())
      .then((d) => {
        if (!on || !d?.candles?.length) return;
        const pts = (d.candles as any[])
          .map((k) => ({
            time: Math.floor(new Date(k.time ?? k[0]).getTime() / 1000) as any,
            value: Number(k.close ?? k[4] ?? 0),
          }))
          .filter((p) => p.value > 0 && p.time > 0)
          .sort((a, b) => a.time - b.time);
        setPoints(pts);
      })
      .catch(() => {});
    return () => { on = false; };
  }, [mint, tf]);

  // Build the lightweight-charts instance once
  useEffect(() => {
    let chart: any = null;
    let ro: ResizeObserver | null = null;
    (async () => {
      const { createChart, ColorType } = await import("lightweight-charts");
      if (!chartRef.current) return;
      const el = chartRef.current;
      chart = createChart(el, {
        layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "rgba(255,255,255,0.35)", fontSize: 10 },
        grid: { vertLines: { visible: false }, horzLines: { color: "rgba(255,255,255,0.05)" } },
        width: el.clientWidth, height: 148,
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
        rightPriceScale: { borderVisible: false },
        crosshair: { horzLine: { visible: false } },
      });
      const up = true;
      const series = chart.addAreaSeries({
        lineColor: "#60a5fa", lineWidth: 2,
        topColor: "rgba(59,130,246,0.35)", bottomColor: "rgba(59,130,246,0.0)",
        priceLineVisible: false, lastValueVisible: false,
      });
      chartApi.current = chart;
      seriesApi.current = series;
      if (points.length) series.setData(points);
      ro = new ResizeObserver(() => { try { chart.applyOptions({ width: el.clientWidth }); } catch {} });
      ro.observe(el);
    })();
    return () => { ro?.disconnect(); try { chart?.remove(); } catch {} chartApi.current = null; seriesApi.current = null; };
  }, []);

  // Push new data + recolor by trend
  useEffect(() => {
    const s = seriesApi.current;
    if (!s || !points.length) return;
    try {
      s.setData(points);
      const up = points[points.length - 1].value >= points[0].value;
      s.applyOptions({
        lineColor: up ? "#34d399" : "#fb7185",
        topColor: up ? "rgba(52,211,153,0.30)" : "rgba(251,113,133,0.30)",
        bottomColor: up ? "rgba(52,211,153,0.0)" : "rgba(251,113,133,0.0)",
      });
      chartApi.current?.timeScale().fitContent();
    } catch {}
  }, [points]);

  const chg = coin?.change24h;
  const up = (chg ?? 0) >= 0;
  return (
    <div className="osc-chartcard x-fade-in" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3">
        {coin?.icon ? (
          <img src={coin.icon} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10" />
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#3b82f6]/15 text-[14px] font-extrabold text-[#60a5fa]">
            {(coin?.symbol || "?").slice(0, 2)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-extrabold text-white">${coin?.symbol || "…"}</span>
            {coin?.name && <span className="truncate text-[12px] text-white/40">{coin.name}</span>}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[17px] font-extrabold text-white">{fmtPrice(coin?.priceUsd ?? null)}</span>
            {chg != null && (
              <span className={cn("flex items-center gap-0.5 text-[12.5px] font-extrabold", up ? "text-emerald-400" : "text-rose-400")}>
                {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {up ? "+" : ""}{chg.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
        <a href={`/trade/token/${mint}`} onClick={(e) => e.stopPropagation()} className="osc-chartcard__trade">Trade <ChevronRight className="h-4 w-4" /></a>
      </div>
      <div className="mt-2 flex gap-1.5">
        {TF_OPTS.map((o) => (
          <button
            key={o.id} type="button"
            onClick={(e) => { e.stopPropagation(); setTf(o); }}
            className={cn("osc-chip", tf.id === o.id && "osc-chip--on")}
            style={{ padding: "4px 12px", fontSize: 11.5 }}
          >{o.label}</button>
        ))}
        <span className="ml-auto self-center text-[10px] font-semibold text-white/25">drag to explore · live</span>
      </div>
      <div ref={chartRef} className="mt-1 w-full" style={{ height: 148 }}>
        {points.length === 0 && <div className="x-shim h-[148px] rounded-xl" />}
      </div>
      <div className="mt-1 flex items-center justify-between text-[10.5px] font-semibold text-white/30">
        <span>{tf.label} · via OrbitX</span>
        <span className="font-mono">{mint.slice(0, 4)}…{mint.slice(-4)}</span>
      </div>
    </div>
  );
}

/* ═══════════ Token picker (chart attach) ═══════════ */
function TokenPicker({ onPick, onClose, title }: { onPick: (c: CoinLite) => void; onClose: () => void; title?: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CoinLite[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setResults([]); return; }
    setBusy(true);
    const t = setTimeout(async () => {
      setResults(await searchCoins(query));
      setBusy(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="osc-modal" onClick={onClose}>
      <div className="osc-modal__card x-fade-in" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="osc-modal__head">
          <BarChart3 className="h-5 w-5 text-[#60a5fa]" />
          <span className="text-[16px] font-extrabold text-white" style={{ fontFamily: "var(--osc-font-display)" }}>{title || "Attach a chart"}</span>
          <button type="button" onClick={onClose} className="ml-auto rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"><XIcon className="h-5 w-5" /></button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search token by name, symbol or mint…"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#3b82f6]"
            />
          </div>
          <div className="mt-2 max-h-72 overflow-y-auto">
            {busy && <div className="py-6 text-center text-[13px] text-white/40">Searching…</div>}
            {!busy && q.trim().length >= 2 && results.length === 0 && (
              <div className="py-6 text-center text-[13px] text-white/40">No tokens found.</div>
            )}
            {results.map((r) => (
              <button key={r.mint} type="button" onClick={() => onPick(r)} className="osc-row w-full text-left">
                {r.icon ? <img src={r.icon} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10" />
                  : <span className="grid h-9 w-9 place-items-center rounded-full bg-[#3b82f6]/15 text-[12px] font-extrabold text-[#60a5fa]">{(r.symbol || "?").slice(0, 2)}</span>}
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-extrabold text-white">${r.symbol} <span className="font-semibold text-white/40">{r.name}</span></div>
                  <div className="font-mono text-[10.5px] text-white/30">{r.mint.slice(0, 6)}…{r.mint.slice(-4)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-extrabold text-white">{fmtPrice(r.priceUsd)}</div>
                  {r.change24h != null && <div className={cn("text-[11px] font-bold", r.change24h >= 0 ? "text-emerald-400" : "text-rose-400")}>{r.change24h >= 0 ? "+" : ""}{r.change24h.toFixed(1)}%</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ Main component ═══════════ */
export default function XSocialApp({ onSelectMint, initialTab }: { onSelectMint?: (m: string) => void; initialTab?: XTab }) {
  const { user, profile, signOut } = useAuth();
  const [tab, setTab] = useState<XTab>(() => resolveInitialTab(initialTab));
  const [feedMode, setFeedMode] = useState<"foryou" | "following">("foryou");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState(() => { try { return localStorage.getItem(DRAFT_KEY) || ""; } catch { return ""; } });
  const [posting, setPosting] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [detailReplies, setDetailReplies] = useState<Post[]>([]);
  const [detailParent, setDetailParent] = useState<{ id: string; username: string | null } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [repostOriginals, setRepostOriginals] = useState<Record<string, Post>>({});
  const [, setClockTick] = useState(0);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ticker, setTicker] = useState<Ticker[]>([]);
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(loadBookmarks);
  const [bookmarkPosts, setBookmarkPosts] = useState<Post[]>([]);
  const [bmLoading, setBmLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchScope, setSearchScope] = useState<"all" | "people" | "coins" | "communities">("all");
  const [foundProfiles, setFoundProfiles] = useState<Suggestion[]>([]);
  const [foundComms, setFoundComms] = useState<CommunityLite[]>([]);
  const [foundDexCoins, setFoundDexCoins] = useState<Ticker[]>([]);
  const [topComms, setTopComms] = useState<CommunityLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [commView, setCommView] = useState<"groups" | "rooms" | "spaces">("groups");
  const [msgView, setMsgView] = useState<"direct" | "groups">("direct");
  const [moreOpen, setMoreOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<"all" | "mentions" | "likes" | "follows">("all");
  const [newPosts, setNewPosts] = useState(0);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [chartPickerOpen, setChartPickerOpen] = useState(false);
  const [cashtag, setCashtag] = useState<{ query: string; results: CoinLite[]; index: number; busy: boolean } | null>(null);
  /* Feed superpowers (trade / tip / copy / rug siren) */
  const [tradeSheet, setTradeSheet] = useState<{ mint: string; symbol: string; mode: TradeMode; post: { id: string; username: string | null; created_at: string } | null } | null>(null);
  const [tipSheet, setTipSheet] = useState<Post | null>(null);
  const [tipped, setTipped] = useState<Record<string, number>>({});
  const cashtagTimer = useRef<number | null>(null);
  /* Token-gated posts ("Holders only") */
  const [gateOn, setGateOn] = useState(false);
  const [gateToken, setGateToken] = useState<CoinLite | null>(null);
  const [gateMin, setGateMin] = useState("1");
  const [gatePickerOpen, setGatePickerOpen] = useState(false);
  const [gateStatus, setGateStatus] = useState<Record<string, { loading: boolean; allowed: boolean }>>({});
  const gateCheckedRef = useRef<Set<string>>(new Set());
  /* Tweet-as-NFT */
  const [mintPost, setMintPost] = useState<Post | null>(null);
  /* AI agent accounts (user_id -> info) */
  const [agentMap, setAgentMap] = useState<Map<string, { username: string; vibe: string | null }>>(new Map());
  const { wallet: deskWallet } = useOrbitxBilling();
  const feedScrollRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef(tab); tabRef.current = tab;
  const uidRef = useRef(user?.id); uidRef.current = user?.id;

  /* remember the active tab + honor legacy sidebar deep links */
  useEffect(() => {
    try { localStorage.setItem("og_x_tab", tab); } catch { /* ignore */ }
  }, [tab]);
  useEffect(() => {
    const id = window.setInterval(() => setClockTick((t) => (t + 1) % 1000000), 60000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    try { if (text.trim()) localStorage.setItem(DRAFT_KEY, text); else localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }, [text]);
  useEffect(() => {
    const sync = () => {
      try {
        const entry = localStorage.getItem("og_comm_entry");
        if (!entry) return;
        localStorage.removeItem("og_comm_entry");
        const mapped = ENTRY_MAP[entry];
        if (mapped) setTab(mapped);
      } catch { /* ignore */ }
    };
    window.addEventListener("og:community-sub-tab", sync);
    window.addEventListener("og:comm-entry", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("og:community-sub-tab", sync);
      window.removeEventListener("og:comm-entry", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  /* First visit → show the onboarding flow */
  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARD_KEY)) setOnboardOpen(true);
    } catch { /* ignore */ }
  }, []);
  const dismissOnboard = useCallback(() => {
    setOnboardOpen(false);
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch { /* ignore */ }
  }, []);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLTextAreaElement>(null);
  const composerFileRef = useRef<HTMLInputElement>(null);
  const exploreSearchRef = useRef<HTMLInputElement>(null);

  const displayName = profile?.display_name || profile?.username || "You";
  const handle = profile?.username || "anon";
  const myAvatar = avatarOf(profile?.avatar_url, user?.id || "me");

  /* ── Feed data ── */
  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("social_messages")
        .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at,repost_of")
        .eq("channel", FEED_CHANNEL).is("reply_to", null).order("created_at", { ascending: false }).limit(100);
      if (error) console.error("[social] feed load error:", error.message);
      if (data) setPosts(data as Post[]);
    } catch (e) {
      console.error("[social] feed load failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("x-home-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_messages", filter: `channel=eq.${FEED_CHANNEL}` },
        (p) => { const row = p.new as Post; if (row.reply_to) return; setPosts((prev) => prev.some((x) => x.id === row.id) ? prev : [row, ...prev]); if (tabRef.current === "home" && row.user_id !== uidRef.current && (feedScrollRef.current?.scrollTop ?? 0) > 300) setNewPosts((n) => n + 1); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "social_messages", filter: `channel=eq.${FEED_CHANNEL}` },
        (p) => { const row = p.new as Post; setPosts((prev) => prev.map((x) => x.id === row.id ? { ...x, likes_count: row.likes_count, liked_by: row.liked_by, content: row.content } : x)); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "social_messages" },
        (p) => { const row = p.old as { id?: string }; if (row?.id) setPosts((prev) => prev.filter((x) => x.id !== row.id)); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => { if (!menuId) return; const h = () => setMenuId(null); document.addEventListener("click", h); return () => document.removeEventListener("click", h); }, [menuId]);

  /* ── Following + suggestions ── */
  useEffect(() => {
    if (!user) return;
    supabase.from("followers").select("followee_id").eq("follower_id", user.id)
      .then(({ data }) => { if (data) setFollowingSet(new Set((data as { followee_id: string }[]).map((r) => r.followee_id))); });
  }, [user]);

  useEffect(() => {
    supabase.from("profiles").select("user_id,username,display_name,avatar_url,is_official_account,bio")
      .not("username", "is", null).order("is_official_account", { ascending: false }).order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => { if (data) setSuggestions(data as Suggestion[]); });
  }, []);

  useEffect(() => {
    supabase.from("communities").select("id,name,description,member_count,avatar_url,icon,category").order("member_count", { ascending: false }).limit(6)
      .then(({ data }) => { if (data) setTopComms(data as CommunityLite[]); });
  }, []);

  /* ── Trends (market ticker) ── */
  useEffect(() => {
    let on = true;
    const fetchTicker = () => fetch("/api/ogdex/screener?type=trending&interval=24h&limit=20")
      .then((r) => r.json()).then((d) => {
        if (on && d?.rows) {
          const rows = (d.rows as Ticker[]).filter((x) => x.symbol).slice(0, 20);
          setTicker(rows);
          // Seed $cashtag -> mint so feed cashtags deep-link to the trade app
          rows.forEach((t) => { if (t.symbol && t.mint && !mintForCashtag(t.symbol)) saveCashtagMint(t.symbol, t.mint); });
        }
      }).catch(() => {});
    fetchTicker();
    const id = setInterval(fetchTicker, 30000);
    return () => { on = false; clearInterval(id); };
  }, []);

  /* ── Notifications ── */
  useEffect(() => {
    if (!user) return;
    setNotifsLoading(true);
    supabase.from("notifications").select("id,type,title,message,is_read,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { setNotifs((data as NotifRow[]) || []); setNotifsLoading(false); });
  }, [user, tab === "notifications"]);

  /* ── Bookmarks ── */
  useEffect(() => {
    if (tab !== "bookmarks") return;
    const ids = [...bookmarks].filter((id) => !id.startsWith("tmp-"));
    if (ids.length === 0) { setBookmarkPosts([]); return; }
    setBmLoading(true);
    supabase.from("social_messages")
      .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at")
      .in("id", ids)
      .then(({ data }) => {
        const rows = ((data as Post[]) || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setBookmarkPosts(rows);
        setBmLoading(false);
      });
  }, [tab, bookmarks]);

  /* ── Universal search ── */
  useEffect(() => {
    const q = searchQ.trim().replace(/[%,()]/g, "");
    if (q.length < 2) { setFoundProfiles([]); setFoundComms([]); setFoundDexCoins([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const like = `%${q}%`;
      const coinsP = fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => {
          const seen = new Set<string>();
          return (((d && d.pairs) || []) as any[])
            .filter((p) => p.chainId === "solana" && p.baseToken?.address)
            .sort((a, b) => Number(b.liquidity?.usd ?? 0) - Number(a.liquidity?.usd ?? 0))
            .filter((p) => (seen.has(p.baseToken.address) ? false : (seen.add(p.baseToken.address), true)))
            .slice(0, 8)
            .map((p) => ({
              mint: p.baseToken.address as string,
              symbol: (p.baseToken.symbol as string) ?? null,
              priceUsd: p.priceUsd != null ? Number(p.priceUsd) : null,
              change24h: p.priceChange?.h24 != null ? Number(p.priceChange.h24) : null,
            } as Ticker));
        })
        .catch(() => [] as Ticker[]);
      const [pRes, cRes, coins] = await Promise.all([
        supabase.from("profiles")
          .select("user_id,username,display_name,avatar_url,is_official_account,bio")
          .or(`username.ilike.${like},display_name.ilike.${like}`)
          .not("username", "is", null).limit(12),
        supabase.from("communities")
          .select("id,name,description,member_count,avatar_url,icon,category")
          .or(`name.ilike.${like},description.ilike.${like}`)
          .limit(10),
        coinsP,
      ]);
      setFoundProfiles((pRes.data as Suggestion[]) || []);
      setFoundComms((cRes.data as CommunityLite[]) || []);
      setFoundDexCoins(coins);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  const markAllRead = async () => {
    if (!user) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  };

  /* ── Actions ── */
  const notify = async (recipientId: string | null | undefined, type: string, title: string, message: string, targetId?: string) => {
    if (!recipientId || !user || recipientId === user.id) return;
    try {
      await supabase.from("notifications").insert({
        user_id: recipientId, type, title, message,
        is_read: false, read: false, actor_id: user.id, kind: type,
        target_type: "post", target_id: targetId ?? null, created_at: new Date().toISOString(),
      });
    } catch { /* best-effort */ }
  };

  /* Public by default: writes need X auth. SSO — if already authed via /auth, they're in. */
  const requireAuth = (action: string): boolean => {
    if (user) return true;
    toast.error(`Sign in to ${action}`, {
      action: { label: "Sign in", onClick: () => { window.location.href = `/auth?return=${encodeURIComponent("/orbitx-social")}`; } },
      duration: 5000,
    });
    return false;
  };

  const follow = async (uid: string) => {
    if (!requireAuth("follow")) return;
    setFollowingSet((prev) => new Set(prev).add(uid));
    const { error } = await supabase.from("followers").insert({ follower_id: user.id, followee_id: uid });
    if (error) setFollowingSet((prev) => { const n = new Set(prev); n.delete(uid); return n; });
    else void notify(uid, "follow", "New follower", `@${handle} followed you`);
  };

  const uploadComposerImage = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploadingImg(true);
    try {
      for (const file of Array.from(files).slice(0, 4)) {
        if (validateUploadFile(file, { maxMB: 5 })) continue;
        const ext = safeExtForMime(file.type);
        const path = `posts/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("profile-media").upload(path, file, { contentType: file.type, upsert: false });
        if (error) { toast.error("Image upload failed"); continue; }
        const { data } = supabase.storage.from("profile-media").getPublicUrl(path);
        if (data?.publicUrl) setPendingImages((prev) => [...prev, data.publicUrl].slice(0, 4));
      }
    } finally { setUploadingImg(false); }
  };

  const submit = async (raw?: string) => {
    const base = (raw ?? text).trim();
    const media = pendingImages.length ? pendingImages.join("\n") : "";
    const content = [base, media].filter(Boolean).join("\n").trim();
    if (!content || !user || posting) return;
    const gate_meta: GateMeta | null = gateOn && gateToken
      ? { kind: "token_holders", mint: gateToken.mint, symbol: gateToken.symbol || null, min_amount: Math.max(0, Number(gateMin) || 0) }
      : null;
    setPosting(true); setText("");
    const imgsSnapshot = pendingImages;
    setPendingImages([]);
    const optimistic: Post = { id: `tmp-${Date.now()}`, user_id: user.id, username: profile?.username || "Anon", avatar_url: profile?.avatar_url || null, content, likes_count: 0, liked_by: [], created_at: new Date().toISOString(), gate_meta };
    setPosts((prev) => [optimistic, ...prev]);
    const payload: Record<string, unknown> = { channel: FEED_CHANNEL, user_id: user.id, username: profile?.username || "Anon", avatar_url: profile?.avatar_url, content, likes_count: 0, liked_by: [] };
    if (gate_meta) payload.gate_meta = gate_meta;
    let res = await supabase.from("social_messages")
      .insert(payload)
      .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at").single();
    if (res.error && gate_meta && /gate_meta/i.test(res.error.message || "")) {
      // Pre-migration: gate_meta column doesn't exist yet — post without the gate.
      delete payload.gate_meta;
      res = await supabase.from("social_messages")
        .insert(payload)
        .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at").single();
    }
    const { data, error } = res;
    if (error) { toast.error("Could not post. Try again."); setPosts((prev) => prev.filter((p) => p.id !== optimistic.id)); setText(base); setPendingImages(imgsSnapshot); }
    else if (data) setPosts((prev) => prev.map((p) => p.id === optimistic.id ? ({ ...(data as Post), gate_meta } as Post) : p));
    if (!error) { setGateOn(false); setGateToken(null); setGateMin("1"); }
    setPosting(false);
    setComposeOpen(false);
  };

  useEffect(() => {
    if (!openPostId) { setDetailPost(null); setDetailReplies([]); setDetailParent(null); return; }
    const existing = posts.find((p) => p.id === openPostId) || null;
    setDetailPost(existing);
    setDetailParent(null);
    setDetailLoading(true);
    let cancelled = false;
    (async () => {
      let thePost = existing;
      if (!thePost) {
        const { data } = await supabase.from("social_messages").select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at,reply_to").eq("id", openPostId).single();
        if (!cancelled && data) { thePost = data as Post; setDetailPost(data as Post); }
      }
      if (thePost?.reply_to) {
        const { data: par } = await supabase.from("social_messages").select("id,username").eq("id", thePost.reply_to).single();
        if (!cancelled && par) setDetailParent({ id: (par as { id: string }).id, username: (par as { username: string | null }).username });
      }
      const { data: reps } = await supabase.from("social_messages").select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at,reply_to").eq("reply_to", openPostId).order("created_at", { ascending: true }).limit(100);
      if (!cancelled) { setDetailReplies((reps as Post[]) || []); setDetailLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [openPostId, posts]);

  const submitReply = async () => {
    const content = replyText.trim();
    if (!content || !user || !openPostId || replyPosting) return;
    const parentId = openPostId;
    setReplyPosting(true); setReplyText("");
    const { data, error } = await supabase.from("social_messages")
      .insert({ channel: FEED_CHANNEL, user_id: user.id, username: profile?.username || "Anon", avatar_url: profile?.avatar_url, content, likes_count: 0, liked_by: [], reply_to: parentId })
      .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at").single();
    if (error) { toast.error("Could not reply. Try again."); setReplyText(content); }
    else if (data) { setDetailReplies((prev) => [...prev, data as Post]); setReplyCounts((prev) => ({ ...prev, [parentId]: (prev[parentId] || 0) + 1 })); void notify(detailPost?.user_id, "reply", "New reply", `@${handle} replied: ${content.slice(0, 80)}`, parentId); }
    setReplyPosting(false);
  };

  const feedIdsKey = useMemo(() => posts.map((p) => p.id).join(","), [posts]);
  useEffect(() => {
    const ids = feedIdsKey ? feedIdsKey.split(",") : [];
    if (ids.length === 0) { setReplyCounts({}); return; }
    let cancelled = false;
    supabase.from("social_messages").select("reply_to").in("reply_to", ids).limit(2000)
      .then(({ data }) => {
        if (cancelled) return;
        const m: Record<string, number> = {};
        ((data as Array<{ reply_to: string | null }>) || []).forEach((r) => { if (r.reply_to) m[r.reply_to] = (m[r.reply_to] || 0) + 1; });
        setReplyCounts(m);
      });
    return () => { cancelled = true; };
  }, [feedIdsKey]);

  /* ═══════════ Track 3: token gates, NFT extras, AI agents ═══════════ */
  /** Is the viewer allowed to see a gated post? Fails closed (locked). */
  const checkGateAllowed = useCallback(async (p: Post): Promise<boolean> => {
    const g = p.gate_meta;
    if (!g?.mint) return true;
    if (user && p.user_id === user.id) return true; // authors always see their own
    // 1) Contracted gate-check endpoint (Track 1): GET /api/social/gate-check?post_id=X
    try {
      const r = await fetch(`/api/social/gate-check?post_id=${encodeURIComponent(p.id)}${user ? `&viewer_id=${encodeURIComponent(user.id)}` : ""}`);
      if (r.ok) {
        const d = await r.json();
        if (typeof d?.allowed === "boolean") return d.allowed;
      }
    } catch { /* not deployed yet — fall through to tokengate */ }
    // 2) Live fallback: Track 1's tokengate against the viewer's in-app wallet
    if (deskWallet) {
      try {
        const r = await fetch(`/api/social/tokengate?wallet=${encodeURIComponent(deskWallet)}&mint=${encodeURIComponent(g.mint)}&min=${encodeURIComponent(String(g.min_amount ?? 0))}`);
        const d = await r.json();
        if (d && typeof d.holds === "boolean") return d.holds;
      } catch { /* fall through to locked */ }
    }
    return false;
  }, [user, deskWallet]);

  useEffect(() => {
    const targets = posts.filter((p) => p.gate_meta?.mint && !gateCheckedRef.current.has(p.id) && !p.id.startsWith("tmp-"));
    if (!targets.length) return;
    for (const t of targets) {
      gateCheckedRef.current.add(t.id);
      setGateStatus((prev) => ({ ...prev, [t.id]: { loading: true, allowed: false } }));
    }
    let cancelled = false;
    (async () => {
      const results = await Promise.all(targets.map(async (t) => ({ id: t.id, allowed: await checkGateAllowed(t) })));
      if (cancelled) return;
      setGateStatus((prev) => {
        const n = { ...prev };
        for (const r of results) n[r.id] = { loading: false, allowed: r.allowed };
        return n;
      });
    })();
    return () => { cancelled = true; };
  }, [posts, checkGateAllowed]);

  /** Post extras (gate_meta, nft_mint, nft_price_usd) via a separate query so the
   *  feed keeps rendering before the migration lands — failures are silent. */
  const fetchPostExtras = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    try {
      const { data, error } = await supabase.from("social_messages").select("id,gate_meta,nft_mint,nft_price_usd").in("id", ids.slice(0, 100));
      if (error || !data) return;
      const m: Record<string, Partial<Post>> = {};
      for (const r of data as Array<{ id: string; gate_meta?: GateMeta | null; nft_mint?: string | null; nft_price_usd?: number | null }>) {
        m[r.id] = { gate_meta: r.gate_meta ?? null, nft_mint: r.nft_mint ?? null, nft_price_usd: r.nft_price_usd ?? null };
      }
      setPosts((prev) => prev.map((p) => (m[p.id] ? { ...p, ...m[p.id] } : p)));
      setDetailPost((prev) => (prev && m[prev.id] ? { ...prev, ...m[prev.id] } : prev));
    } catch { /* pre-migration: columns don't exist yet */ }
  }, []);

  useEffect(() => {
    const ids = posts.map((p) => p.id).filter((id) => !id.startsWith("tmp-"));
    if (ids.length) void fetchPostExtras(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedIdsKey]);

  /** AI agent accounts directory (public; no key material). */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/social/agents")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.agents) return;
        const m = new Map<string, { username: string; vibe: string | null }>();
        for (const a of d.agents) m.set(a.user_id, { username: a.username, vibe: a.vibe ?? null });
        setAgentMap(m);
      })
      .catch(() => { /* directory unavailable — badges just don't show */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const ids = [...new Set(posts.filter((p) => p.repost_of).map((p) => p.repost_of as string))].filter((id) => !repostOriginals[id]);
    if (ids.length === 0) return;
    let cancelled = false;
    supabase.from("social_messages").select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at,repost_of").in("id", ids)
      .then(({ data }) => {
        if (cancelled) return;
        const m: Record<string, Post> = {};
        ((data as Post[]) || []).forEach((pp) => { m[pp.id] = pp; });
        setRepostOriginals((prev) => ({ ...prev, ...m }));
      });
    return () => { cancelled = true; };
  }, [posts]);

  useEffect(() => {
    if (!openPostId) return;
    const parentId = openPostId;
    const ch = supabase.channel(`x-thread-${parentId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_messages", filter: `reply_to=eq.${parentId}` },
        (p) => {
          const row = p.new as Post;
          setDetailReplies((prev) => prev.some((x) => x.id === row.id) ? prev : [...prev, row]);
          if (row.user_id !== uidRef.current) setReplyCounts((prev) => ({ ...prev, [parentId]: (prev[parentId] || 0) + 1 }));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [openPostId]);

  const toggleLike = async (post: Post) => {
    if (!requireAuth("like")) return;
    if (post.id.startsWith("tmp-")) return;
    const likedBy = post.liked_by || [];
    const liked = likedBy.includes(user.id);
    if (!liked) void notify(post.user_id, "like", "New like", `@${handle} liked your post`, post.id);
    const nextLikedBy = liked ? likedBy.filter((x) => x !== user.id) : [...likedBy, user.id];
    setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, liked_by: nextLikedBy, likes_count: nextLikedBy.length } : p));
    const { error } = await supabase.from("social_messages").update({ likes_count: nextLikedBy.length, liked_by: nextLikedBy }).eq("id", post.id);
    if (error) setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, liked_by: likedBy, likes_count: likedBy.length } : p));
  };

  const toggleBookmark = (p: Post) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(p.id)) { next.delete(p.id); toast.success("Removed from bookmarks"); }
      else { next.add(p.id); toast.success("Added to bookmarks"); }
      saveBookmarks(next);
      return next;
    });
  };

  const deletePost = async (p: Post) => {
    if (!user || p.user_id !== user.id) return;
    setMenuId(null);
    setPosts((prev) => prev.filter((x) => x.id !== p.id));
    if (!p.id.startsWith("tmp-")) { const { error } = await supabase.from("social_messages").delete().eq("id", p.id).eq("user_id", user.id); if (error) toast.error("Could not delete post"); }
  };

  const repost = async (p: Post) => {
    if (!requireAuth("repost")) return;
    const target = p.repost_of ? p.repost_of : p.id;
    const orig = p.repost_of ? repostOriginals[p.repost_of] : p;
    const optimistic: Post = { id: `tmp-${Date.now()}`, user_id: user.id, username: profile?.username || "Anon", avatar_url: profile?.avatar_url || null, content: "", likes_count: 0, liked_by: [], created_at: new Date().toISOString(), repost_of: target };
    setPosts((prev) => [optimistic, ...prev]);
    if (orig) setRepostOriginals((prev) => ({ ...prev, [target]: prev[target] ?? orig }));
    const { data, error } = await supabase.from("social_messages")
      .insert({ channel: FEED_CHANNEL, user_id: user.id, username: profile?.username || "Anon", avatar_url: profile?.avatar_url, content: "", likes_count: 0, liked_by: [], repost_of: target })
      .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at,repost_of").single();
    if (error) { toast.error("Could not repost. Try again."); setPosts((prev) => prev.filter((x) => x.id !== optimistic.id)); }
    else if (data) { setPosts((prev) => prev.map((x) => x.id === optimistic.id ? (data as Post) : x)); void notify((orig ?? p).user_id, "repost", "New repost", `@${handle} reposted your post`, target); toast.success("Reposted"); }
  };

  const replyTo = (p: Post) => {
    setTab("home");
    setText((t) => t.startsWith(`@${p.username} `) ? t : `@${p.username || "anon"} ${t}`);
    setTimeout(() => composerRef.current?.focus(), 60);
  };

  const share = async (p: Post) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/social/t/${p.id}`); toast.success("Link copied to clipboard"); } catch { toast.error("Copy failed"); }
  };

  /* ── Feed superpowers: one-tap trade / tip / copy-trade / rug flag ── */
  const openTrade = (mint: string, symbol: string, mode: TradeMode, p: Post | null) => {
    if (!requireAuth(mode === "copy" ? "copy this trade" : "trade")) return;
    setTradeSheet({
      mint, symbol, mode,
      post: p ? { id: p.id, username: p.username, created_at: p.created_at } : null,
    });
  };

  const openTip = (p: Post) => {
    if (!requireAuth("tip")) return;
    setTipSheet(p);
  };

  /** Flag a $cashtag post as a potential rug. At 5 distinct flaggers, auto-post a siren alert. */
  const flagRug = async (p: Post) => {
    if (!requireAuth("flag a post as a potential rug")) return;
    if (p.id.startsWith("tmp-") || !user) return;
    try {
      if (await hasFlagged(p.id, user.id)) { toast.info("You already flagged this post"); return; }
      const { error } = await supabase.from("rug_flags").insert({ post_id: p.id, flagger_user_id: user.id });
      if (error) throw error;
      toast.success("Flagged — thanks for keeping the trenches safe");
      const flaggers = await fetchRugFlaggers(p.id);
      if (flaggers && flaggers.length >= RUG_SIREN_THRESHOLD) {
        // Dedupe: only one siren post per flagged post.
        const { data: existing } = await supabase.from("social_messages").select("id")
          .eq("channel", FEED_CHANNEL).like("content", `%[ORIG:${p.id}]%`).limit(1);
        if (existing && existing.length > 0) return;
        const sym = extractCallTokens(p.content, 1)[0]?.symbol;
        const body = `[RUGSIREN]\n🚨 RUG SIREN: $${sym || "TOKEN"} has been flagged as a potential rug by ${flaggers.length} users. Trade with extreme caution.\n[ORIG:${p.id}]`;
        const { error: postErr } = await supabase.from("social_messages").insert({
          channel: FEED_CHANNEL, user_id: user.id, username: profile?.username || "Anon",
          avatar_url: profile?.avatar_url, content: body, likes_count: 0, liked_by: [],
        });
        if (postErr) throw postErr;
        for (const fid of flaggers) {
          void notify(fid, "rug_siren", "🚨 Rug siren",
            `$${sym || "TOKEN"} was flagged as a potential rug by ${flaggers.length} users. Tread carefully.`, p.id);
        }
        toast.error(`🚨 RUG SIREN: $${sym || "TOKEN"} flagged by ${flaggers.length} users`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/rug_flags|relation|does not exist/i.test(msg)) {
        toast.error("Rug flagging isn't live yet — try again soon");
      } else {
        toast.error("Could not flag this post");
      }
    }
  };

  /* ── Derived ── */
  const shownPosts = useMemo(() => {
    if (feedMode === "following") return posts.filter((p) => followingSet.has(p.user_id) || (user && p.user_id === user.id));
    return posts;
  }, [posts, feedMode, followingSet, user]);

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) for (const t of ((p.content || "").match(/[$#][A-Za-z][A-Za-z0-9_]{1,20}/g) || [])) counts.set(t.toUpperCase(), (counts.get(t.toUpperCase()) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [posts]);

  const officialIds = useMemo(() => new Set(suggestions.filter((x) => x.is_official_account).map((x) => x.user_id)), [suggestions]);

  const whoToFollow = suggestions.filter((s) => s.user_id !== user?.id && !followingSet.has(s.user_id));

  const marketPulse = useMemo(() => {
    const withChg = ticker.filter((t) => t.change24h != null);
    const gainers = withChg.filter((t) => (t.change24h ?? 0) > 0).length;
    const losers = withChg.filter((t) => (t.change24h ?? 0) < 0).length;
    const avg = withChg.length ? withChg.reduce((sum, t) => sum + (t.change24h ?? 0), 0) / withChg.length : 0;
    const sol = ticker.find((t) => (t.symbol || "").toUpperCase() === "SOL") || null;
    const topMovers = [...withChg].sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0)).slice(0, 10);
    return { gainers, losers, avg, sol, topMovers };
  }, [ticker]);

  const shownNotifs = useMemo(() => {
    if (notifFilter === "all") return notifs;
    return notifs.filter((n) => {
      const ty = (n.type || "").toLowerCase();
      if (notifFilter === "likes") return ty.includes("like");
      if (notifFilter === "follows") return ty.includes("follow");
      return ty.includes("repl") || ty.includes("mention") || ty.includes("comment");
    });
  }, [notifs, notifFilter]);

  const searchedUsers = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    const local = suggestions.filter((s) => (s.username || "").toLowerCase().includes(q) || (s.display_name || "").toLowerCase().includes(q));
    const seen = new Set<string>();
    return [...foundProfiles, ...local].filter((s) => (seen.has(s.user_id) ? false : (seen.add(s.user_id), true))).slice(0, 10);
  }, [searchQ, suggestions, foundProfiles]);

  const foundCoins = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    const local = ticker.filter((t) => (t.symbol || "").toLowerCase().includes(q) || t.mint.toLowerCase() === q);
    const seen = new Set<string>();
    return [...local, ...foundDexCoins].filter((t) => (seen.has(t.mint) ? false : (seen.add(t.mint), true))).slice(0, 10);
  }, [searchQ, ticker, foundDexCoins]);

  const isNarrow = NARROW_TABS.includes(tab);
  const unread = notifs.filter((n) => !n.is_read).length;
  const tabLabel = NAV.find((n) => n.id === tab)?.label ?? "Social";
  const dockOnMore = MORE_TABS.includes(tab) || moreOpen;

  /* ═══════════ Sub-renderers ═══════════ */

  /* ── $cashtag autocomplete: detect $query before the cursor ── */
  const detectCashtag = (ta: HTMLTextAreaElement | null) => {
    if (!ta) { setCashtag(null); return; }
    const pos = ta.selectionStart ?? 0;
    const before = ta.value.slice(0, pos);
    const m = /\$([A-Za-z0-9]{1,14})$/.exec(before);
    // Don't trigger inside a chart marker
    if (!m || /\[chart:[^\]]*$/.test(before)) { setCashtag(null); return; }
    const query = m[1];
    setCashtag((prev) => ({ query, results: prev?.query === query ? prev.results : [], index: 0, busy: true }));
    if (cashtagTimer.current) window.clearTimeout(cashtagTimer.current);
    cashtagTimer.current = window.setTimeout(async () => {
      const results = await searchCoins(query);
      setCashtag((prev) => (prev && prev.query === query ? { ...prev, results, busy: false } : prev));
    }, 250);
  };

  const pickCashtag = (coin: CoinLite, ta: HTMLTextAreaElement | null) => {
    if (!ta || !coin.symbol) { setCashtag(null); return; }
    const pos = ta.selectionStart ?? 0;
    const before = ta.value.slice(0, pos);
    const m = /\$([A-Za-z0-9]{1,14})$/.exec(before);
    if (!m) { setCashtag(null); return; }
    const start = pos - m[0].length;
    const next = ta.value.slice(0, start) + "$" + coin.symbol.toUpperCase() + " " + ta.value.slice(pos);
    setText(next.slice(0, MAX_LEN));
    saveCashtagMint(coin.symbol, coin.mint);
    setCashtag(null);
    requestAnimationFrame(() => {
      ta.focus();
      const np = start + coin.symbol!.length + 2;
      ta.setSelectionRange(np, np);
    });
  };

  const attachChart = (coin: CoinLite) => {
    setChartPickerOpen(false);
    if (coin.symbol) saveCashtagMint(coin.symbol, coin.mint);
    setText((t) => {
      const marker = `[chart:${coin.mint}]`;
      if (t.includes(marker)) return t;
      const sep = t.trim() ? "\n" : "";
      return (t + sep + marker).slice(0, MAX_LEN + 100);
    });
    toast.success(`Chart attached — $${coin.symbol || "token"}`);
  };

  const pickGateToken = (coin: CoinLite) => {
    setGatePickerOpen(false);
    setGateToken(coin);
    if (coin.symbol) saveCashtagMint(coin.symbol, coin.mint);
  };

  const Composer = ({ inline, refEl }: { inline?: boolean; refEl: React.RefObject<HTMLTextAreaElement> }) => {
    if (!user) {
      return (
        <div className="osc-composer">
          <span className="osc-topbar__mark" style={{ width: 40, height: 40 }}>O</span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-white">Join the conversation</div>
            <div className="mt-0.5 text-[13px] text-white/45">Sign in with X to post, like and reply — reading is free for everyone.</div>
            <button type="button" onClick={() => { window.location.href = `/auth?return=${encodeURIComponent("/orbitx-social")}`; }} className="osc-btn-primary mt-3">
              Sign in with X
            </button>
          </div>
        </div>
      );
    }
    return (
    <div className="osc-composer">
      <img src={myAvatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <div className="relative">
        <textarea
          ref={refEl}
          value={text}
          onChange={(e) => { setText(e.target.value.slice(0, MAX_LEN)); detectCashtag(e.target); }}
          onKeyUp={(e) => detectCashtag(e.currentTarget)}
          onClick={(e) => detectCashtag(e.currentTarget)}
          placeholder="What's happening?"
          rows={inline ? 2 : 4}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { submit(); return; }
            if (cashtag && cashtag.results.length > 0) {
              if (e.key === "ArrowDown") { e.preventDefault(); setCashtag((p) => p && ({ ...p, index: (p.index + 1) % p.results.length })); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setCashtag((p) => p && ({ ...p, index: (p.index - 1 + p.results.length) % p.results.length })); }
              else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickCashtag(cashtag.results[cashtag.index], e.currentTarget); }
              else if (e.key === "Escape") { setCashtag(null); }
            } else if (e.key === "Escape") setCashtag(null);
          }}
        />
        {cashtag && (cashtag.busy || cashtag.results.length > 0) && (
          <div className="osc-cashtag">
            {cashtag.busy && cashtag.results.length === 0 ? (
              <div className="px-4 py-3 text-[13px] text-white/40">Searching tokens…</div>
            ) : cashtag.results.map((r, i) => (
              <button
                key={r.mint}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pickCashtag(r, refEl.current); }}
                onMouseEnter={() => setCashtag((p) => p && ({ ...p, index: i }))}
                className={cn("osc-cashtag__row", i === cashtag.index && "osc-cashtag__row--on")}
              >
                {r.icon ? <img src={r.icon} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10" />
                  : <span className="grid h-8 w-8 place-items-center rounded-full bg-[#3b82f6]/15 text-[11px] font-extrabold text-[#60a5fa]">{(r.symbol || "?").slice(0, 2)}</span>}
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[13.5px] font-extrabold text-white">${r.symbol}</span>
                  <span className="block truncate text-[11px] text-white/40">{r.name}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[12.5px] font-extrabold text-white">{fmtPrice(r.priceUsd)}</span>
                  {r.change24h != null && <span className={cn("block text-[10.5px] font-bold", r.change24h >= 0 ? "text-emerald-400" : "text-rose-400")}>{r.change24h >= 0 ? "+" : ""}{r.change24h.toFixed(1)}%</span>}
                </span>
              </button>
            ))}
          </div>
        )}
        </div>
        {pendingImages.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {pendingImages.map((url) => (
              <div key={url} className="relative h-16 w-16 overflow-hidden rounded-xl ring-1 ring-white/10">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setPendingImages((prev) => prev.filter((u) => u !== url))} className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-white/80 transition hover:text-white" aria-label="Remove image">
                  <XIcon className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {gateOn && (
          <div className="osc-gate">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setGatePickerOpen(true)} className="osc-gate__pick">
                {gateToken ? (
                  <>{gateToken.icon ? <img src={gateToken.icon} alt="" className="h-5 w-5 rounded-full object-cover" /> : null}<span>${gateToken.symbol}</span></>
                ) : (
                  <><Lock className="h-3.5 w-3.5" /><span>Pick token</span></>
                )}
              </button>
              <input
                value={gateMin}
                onChange={(e) => setGateMin(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="Min amount"
                inputMode="decimal"
                className="osc-gate__min"
              />
              {gateToken && (
                <button type="button" onClick={() => setGateToken(null)} className="osc-gate__clear" title="Clear token">
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
              <button type="button" onClick={() => setGateOn(false)} className="osc-gate__off">Everyone</button>
            </div>
            <div className="osc-gate__hint">
              {gateToken ? <>Only wallets holding ≥ {gateMin || "0"} ${gateToken.symbol} can view this post.</> : "Pick a token — only wallets holding it will be able to view this post."}
            </div>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between border-t border-white/[0.08] pt-2.5">
          <span className="relative flex items-center gap-0.5">
            <button type="button" onClick={() => composerFileRef.current?.click()} disabled={uploadingImg} className="grid h-9 w-9 place-items-center rounded-full text-[#3b82f6] transition hover:bg-[#3b82f6]/10 disabled:opacity-50" title="Add image">
              {uploadingImg ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <ImageIcon className="h-[18px] w-[18px]" />}
            </button>
            <button type="button" onClick={() => setEmojiOpen((v) => !v)} className="grid h-9 w-9 place-items-center rounded-full text-[#3b82f6] transition hover:bg-[#3b82f6]/10" title="Add emoji">
              <Smile className="h-[18px] w-[18px]" />
            </button>
            <button type="button" onClick={() => setChartPickerOpen(true)} className="grid h-9 w-9 place-items-center rounded-full text-[#f0c75e] transition hover:bg-[#f0c75e]/10" title="Attach price chart">
              <BarChart3 className="h-[18px] w-[18px]" />
            </button>
            <button type="button" onClick={() => setGateOn((v) => !v)} className={cn("grid h-9 w-9 place-items-center rounded-full transition", gateOn ? "bg-[#f0c75e]/15 text-[#f0c75e]" : "text-[#3b82f6] hover:bg-[#3b82f6]/10")} title="Holders only — gate this post to token holders">
              <Lock className="h-[18px] w-[18px]" />
            </button>
            {emojiOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setEmojiOpen(false)} />
                <div className="absolute bottom-10 left-0 z-30 w-[248px] rounded-2xl border border-white/10 bg-[#0d1219] p-2 shadow-2xl">
                  <div className="grid grid-cols-8 gap-0.5">
                    {EMOJIS.map((e) => (
                      <button key={e} type="button" onClick={() => { setText((t) => (t + e).slice(0, MAX_LEN)); setEmojiOpen(false); }} className="rounded-md p-1 text-[18px] leading-none transition hover:bg-white/10">{e}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {text.length > MAX_LEN - 40 && (
              <span className="ml-1 text-[12px] font-bold text-orange-400">{MAX_LEN - text.length}</span>
            )}
          </span>
          <button type="button" disabled={(!text.trim() && pendingImages.length === 0) || posting || (gateOn && !gateToken)} onClick={() => submit()} className="osc-btn-primary" title={gateOn && !gateToken ? "Pick a token for the holders-only gate" : undefined}>
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
  };

  /* ═══════════ Tweet-as-NFT: unlock progress + mint ═══════════ */
  const renderNftZone = (p: Post) => {
    const likes = p.likes_count ?? 0;
    if (likes < 500 || p.id.startsWith("tmp-")) return null;
    const comments = replyCounts[p.id] ?? 0;
    const ownPost = Boolean(user && p.user_id === user.id);
    const tier = Math.floor(likes / 1000);
    const priceUsd = 5 * tier;
    if (p.nft_mint) {
      return (
        <div className="osc-nftzone osc-nftzone--minted">
          <Gem className="h-4 w-4 shrink-0 text-[#f0c75e]" />
          <span className="truncate">Minted as NFT{typeof p.nft_price_usd === "number" ? ` · $${p.nft_price_usd}` : ""}</span>
          <a href={`https://solscan.io/token/${p.nft_mint}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="osc-nftzone__link">
            {p.nft_mint.slice(0, 4)}…{p.nft_mint.slice(-4)} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      );
    }
    if (likes >= 1000 && comments >= 100) {
      if (!ownPost) return null;
      return (
        <div className="osc-nftzone osc-nftzone--unlocked">
          <Gem className="h-4 w-4 shrink-0 text-[#f0c75e]" />
          <span className="min-w-0 flex-1 truncate">🔓 NFT mint unlocked · <b>${priceUsd}</b></span>
          <button type="button" onClick={(e) => { e.stopPropagation(); setMintPost(p); }} className="osc-nftzone__btn">
            Mint as NFT
          </button>
        </div>
      );
    }
    const nextMilestone = (tier + 1) * 1000;
    const pct = Math.min(100, Math.round((likes / nextMilestone) * 100));
    return (
      <div className="osc-nftzone">
        <div className="osc-nftzone__bar"><span style={{ width: `${pct}%` }} /></div>
        <div className="osc-nftzone__labels">
          <span>🔥 {likes.toLocaleString()}/{nextMilestone.toLocaleString()} likes to unlock NFT mint</span>
          {comments < 100 && <span>💬 {comments}/100 comments</span>}
        </div>
      </div>
    );
  };

  const NftMintModal = ({ p, onClose, onMinted }: { p: Post; onClose: () => void; onMinted: (mint: string, priceUsd: number) => void }) => {
    const likes = p.likes_count ?? 0;
    const comments = replyCounts[p.id] ?? 0;
    const priceUsd = 5 * Math.floor(likes / 1000);
    const [solPrice, setSolPrice] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [step, setStep] = useState("");
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const postUrl = `https://orbitx.world/social/embed/post/${p.id}`;

    useEffect(() => {
      let cancelled = false;
      fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const v = Number(d?.[SOL_MINT]?.usdPrice);
          if (!cancelled && v > 0) setSolPrice(v);
        })
        .catch(() => {});
      return () => { cancelled = true; };
    }, []);

    const priceSol = solPrice ? priceUsd / solPrice : null;

    const doMint = async () => {
      const authCode = getBillingAuthCode();
      if (!authCode) { toast.error("Link your in-app wallet first (Trade tab → wallet)."); return; }
      setBusy(true);
      try {
        setStep("Uploading post metadata…");
        const { imgs } = splitMedia(p.content);
        const meta = {
          name: `OrbitX Post by @${p.username || "anon"}`,
          symbol: "ORBITXPOST",
          description: `${(p.content || "").slice(0, 280)} — Minted from OrbitX Social Center. ${likes.toLocaleString()} likes · ${comments} comments.`,
          image: imgs[0] || "",
          attributes: [
            { trait_type: "Post ID", value: p.id },
            { trait_type: "Author", value: `@${p.username || "anon"}` },
            { trait_type: "Likes", value: String(likes) },
            { trait_type: "Comments", value: String(comments) },
            { trait_type: "Mint Price USD", value: `$${priceUsd}` },
            { trait_type: "Mint Price SOL", value: priceSol != null ? priceSol.toFixed(6) : "n/a" },
            { trait_type: "Post URL", value: postUrl },
          ],
          properties: { post_id: p.id, post_url: postUrl, author: p.username || null, likes, comments, category: "social" },
        };
        const blob = new Blob([JSON.stringify(meta)], { type: "application/json" });
        const path = `nft-meta/${p.id}.json`;
        const { error: upErr } = await supabase.storage.from("profile-media").upload(path, blob, { contentType: "application/json", upsert: true });
        if (upErr) throw new Error("metadata upload failed");
        const { data: pub } = supabase.storage.from("profile-media").getPublicUrl(path);
        const uri = pub?.publicUrl;
        if (!uri) throw new Error("metadata URL unavailable");

        setStep("Minting NFT from your in-app wallet…");
        const res = await callSupercomputerTool("orbitx_app_nft_mint", {
          name: meta.name,
          symbol: "ORBITXPOST",
          uri,
          ...(imgs[0] ? { imageUrl: imgs[0] } : {}),
          attributes: meta.attributes,
          authCode,
        });
        if (!res?.ok || typeof res.mint !== "string" || !res.mint) {
          throw new Error(typeof res.error === "string" ? res.error : (typeof res.message === "string" ? res.message : "mint failed"));
        }
        const mint = res.mint;
        setStep("Recording the mint…");
        try {
          await supabase.from("social_messages").update({ nft_mint: mint, nft_price_usd: priceUsd }).eq("id", p.id);
        } catch { /* pre-migration: columns missing — UI still updates */ }
        toast.success("NFT minted!", { description: `Mint price $${priceUsd}${priceSol != null ? ` (≈ ${priceSol.toFixed(4)} SOL)` : ""}` });
        onMinted(mint, priceUsd);
      } catch (e) {
        toast.error("Mint failed", { description: String((e as Error)?.message || e).slice(0, 160) });
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="osc-modal" onClick={onClose}>
        <div className="osc-modal__card x-fade-in" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
          <div className="osc-modal__head">
            <Gem className="h-5 w-5 text-[#f0c75e]" />
            <span className="text-[16px] font-extrabold text-white" style={{ fontFamily: "var(--osc-font-display)" }}>Mint post as NFT</span>
            <button type="button" onClick={onClose} className="ml-auto rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"><XIcon className="h-5 w-5" /></button>
          </div>
          <div className="osc-nftmint">
            <div className="osc-nftmint__stats">
              <div><b>{likes.toLocaleString()}</b><span>likes</span></div>
              <div><b>{comments}</b><span>comments</span></div>
            </div>
            <div className="osc-nftmint__price">
              <span>Mint price</span>
              <b>${priceUsd}{priceSol != null && <i> ≈ {priceSol.toFixed(4)} SOL</i>}</b>
            </div>
            <p className="osc-nftmint__note">
              Mints a real Metaplex NFT from your in-app wallet — backend-signed, no popup.
              The metadata references this post (content, author, like count, post URL) and
              records the mint price. Tiers: $5 per 1,000 likes.
            </p>
            <button type="button" disabled={busy} onClick={doMint} className="osc-btn-primary w-full">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {step}</> : `Mint NFT — $${priceUsd}`}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const PostCard = ({ p: raw, onOpen }: { p: Post; onOpen?: (id: string) => void }) => {
    const isRepost = Boolean(raw.repost_of);
    const original = isRepost ? repostOriginals[raw.repost_of as string] : raw;
    if (isRepost && !original) {
      return (
        <article className="osc-post text-[13px] text-white/40">
          <Repeat2 className="mt-0.5 h-4 w-4" /> @{raw.username || "someone"} reposted · loading…
        </article>
      );
    }
    const p = (original ?? raw) as Post;
    const liked = Boolean(user && (p.liked_by || []).includes(user.id));
    const marked = bookmarks.has(p.id);
    const own = user && p.user_id === user.id;
    const isOfficial = officialIds.has(p.user_id);
    const agent = agentMap.get(p.user_id);
    const gate = p.gate_meta;
    const gated = Boolean(gate?.mint);
    const gs = gateStatus[p.id];
    const gateLocked = gated && !own && (!gs || gs.loading || !gs.allowed);
    /* Rug siren alerts render as their own red/pulsing card. */
    if (isSirenContent(p.content)) {
      return <SirenCard content={p.content} onOpenOrig={onOpen} />;
    }
    const callTokens = extractCallTokens(p.content);
    return (
      <article onClick={() => onOpen?.(p.id)} className={cn("osc-post x-fade-in group/post relative", onOpen && "osc-post--click")}>
        <img src={avatarOf(p.avatar_url, p.user_id)} alt="" className="osc-post__avatar transition group-hover/post:ring-[#3b82f6]/50" />
        <div className="min-w-0 flex-1">
          {isRepost && <div className="mb-0.5 flex items-center gap-1.5 text-[12px] font-bold text-white/40"><Repeat2 className="h-3.5 w-3.5" /> @{raw.username || "someone"} reposted</div>}
          <div className="osc-post__head">
            <span className="osc-post__name">{p.username || "Anon"}</span>
            {(isOfficial || officialIds.has(p.user_id)) && <BadgeCheck className="osc-verified h-4 w-4" />}
            {agent && <AgentBadge vibe={agent.vibe} />}
            <span className="osc-post__meta">@{(p.username || "anon").toLowerCase().replace(/\s+/g, "")} · {timeAgo(p.created_at)}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id); }} className="ml-auto rounded-full p-1.5 text-white/30 transition hover:bg-[#3b82f6]/10 hover:text-[#60a5fa]">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
          {gateLocked ? (
            <div className="osc-gated">
              <div className="osc-gated__veil" aria-hidden="true">
                <span /><span /><span />
              </div>
              <div className="osc-gated__lock">
                <Lock className="h-5 w-5 text-[#f0c75e]" />
                <div className="osc-gated__title">🔒 Holders only</div>
                <div className="osc-gated__sub">Hold {gate?.min_amount ?? 0} ${gate?.symbol || "tokens"} to view this post</div>
                {gate?.mint && (
                  <a href={`/trade/token/${gate.mint}`} onClick={(e) => e.stopPropagation()} className="osc-gated__cta">
                    View ${gate.symbol || "token"}
                  </a>
                )}
                {user && !deskWallet && <div className="osc-gated__hint">Link your in-app wallet to verify holdings</div>}
              </div>
            </div>
          ) : ((() => { const { text: chartStripped, charts } = splitCharts(p.content); const { text: body, imgs } = splitMedia(chartStripped); return (
            <>
              {body && <div className="osc-post__body">{renderContent(body, onSelectMint)}</div>}
              {imgs.length > 0 && (
                <div className={cn("mt-2 grid gap-1.5 overflow-hidden rounded-2xl border border-white/[0.08]", imgs.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                  {imgs.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="block overflow-hidden">
                      <img src={u} alt="" loading="lazy" className={cn("w-full object-cover transition duration-300 hover:scale-[1.02]", imgs.length > 1 ? "h-40" : "max-h-[380px]")} />
                    </a>
                  ))}
                </div>
              )}
              {charts.map((mint) => <ChartCard key={mint} mint={mint} />)}
            </>
          ); })())}
          {callTokens.length > 0 && (
            <div className="osc-tradebar" onClick={(e) => e.stopPropagation()}>
              {callTokens.map((ct) => (
                <div key={ct.mint} className="osc-tradebar__row">
                  <span className="osc-tradebar__sym">${ct.symbol}</span>
                  <span className="osc-tradebar__spacer" />
                  <button type="button" onClick={() => openTrade(ct.mint, ct.symbol, "buy", p)} className="osc-tradebar__btn osc-tradebar__btn--buy">
                    <TrendingUp className="h-3.5 w-3.5" /> Buy
                  </button>
                  <button type="button" onClick={() => openTrade(ct.mint, ct.symbol, "sell", p)} className="osc-tradebar__btn osc-tradebar__btn--sell">
                    <TrendingDown className="h-3.5 w-3.5" /> Sell
                  </button>
                  <button type="button" onClick={() => openTrade(ct.mint, ct.symbol, "copy", p)} className="osc-tradebar__btn osc-tradebar__btn--copy">
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Copy
                  </button>
                </div>
              ))}
            </div>
          )}
          {!gateLocked && (
          <div className="osc-actions">
            <button type="button" onClick={(e) => { e.stopPropagation(); onOpen ? onOpen(p.id) : replyTo(p); }} className="osc-act group">
              <span className="osc-act__pill"><MessageCircle className="h-[18px] w-[18px]" /></span>
              {(replyCounts[p.id] ?? 0) > 0 && <span>{replyCounts[p.id]}</span>}
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); repost(p); }} className="osc-act osc-act--green group">
              <span className="osc-act__pill"><Repeat2 className="h-[18px] w-[18px]" /></span>
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); toggleLike(p); }} className={cn("osc-act osc-act--pink group", liked && "osc-act--on")}>
              <span className="osc-act__pill"><Heart className={cn("h-[18px] w-[18px]", liked && "x-like-pop fill-current")} /></span>
              {(p.likes_count ?? 0) > 0 && <span>{p.likes_count}</span>}
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); toggleBookmark(p); }} className={cn("osc-act osc-act--gold group", marked && "osc-act--on")}>
              <span className="osc-act__pill"><Bookmark className={cn("h-[18px] w-[18px]", marked && "fill-current")} /></span>
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); openTip(p); }} className={cn("osc-act osc-act--gold group", tipped[p.id] && "osc-act--on")} title="Tip the author">
              <span className="osc-act__pill"><Gift className={cn("h-[18px] w-[18px]", tipped[p.id] && "fill-current")} /></span>
              {tipped[p.id] ? <span className="text-[#f0c75e]">${tipped[p.id]}</span> : null}
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); share(p); }} className="osc-act group">
              <span className="osc-act__pill"><Share className="h-[18px] w-[18px]" /></span>
            </button>
          </div>
          )}
          {!gateLocked && renderNftZone(p)}
        </div>
        {menuId === p.id && (
          <div className="absolute right-3 top-10 z-20 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0d1219] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {own && (
              <button type="button" onClick={() => deletePost(p)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-bold text-white/55 transition hover:bg-white/[0.04]">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
            <button type="button" onClick={() => { navigator.clipboard.writeText(p.content).catch(() => {}); setMenuId(null); toast.success("Text copied"); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-bold text-white/70 transition hover:bg-white/[0.04]">
              <Copy className="h-4 w-4" /> Copy text
            </button>
            {!p.id.startsWith("tmp-") && (
              <button type="button" onClick={() => { navigator.clipboard.writeText(embedSnippet("post", p.id)).catch(() => {}); setMenuId(null); toast.success("Embed code copied — paste it on any website"); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-bold text-white/70 transition hover:bg-white/[0.04]">
                <ExternalLink className="h-4 w-4" /> Copy embed
              </button>
            )}
            <button type="button" onClick={() => { setMenuId(null); toast.success("Thanks — this post has been reported."); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-bold text-white/70 transition hover:bg-white/[0.04]">
              <Flag className="h-4 w-4" /> Report
            </button>
            {!isSirenContent(p.content) && (
              <button type="button" onClick={() => { setMenuId(null); void flagRug(p); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-bold text-rose-300/90 transition hover:bg-white/[0.04]">
                <Siren className="h-4 w-4" /> Flag as rug
              </button>
            )}
          </div>
        )}
      </article>
    );
  };

  const FollowCard = ({ s }: { s: Suggestion }) => (
    <div className="osc-row osc-row--hover">
      <img src={avatarOf(s.avatar_url, s.user_id)} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[14px] font-extrabold text-white">
          <span className="truncate">{s.display_name || s.username}</span>
          {s.is_official_account && <BadgeCheck className="h-4 w-4 shrink-0 text-[#f0c75e]" />}
          {agentMap.get(s.user_id) && <AgentBadge vibe={agentMap.get(s.user_id)?.vibe} />}
        </div>
        <div className="truncate text-[13px] text-white/35">@{s.username}</div>
        {s.bio && <div className="mt-0.5 line-clamp-1 text-[12px] text-white/50">{s.bio}</div>}
      </div>
      <button type="button" onClick={() => follow(s.user_id)} className="rounded-full bg-white px-4 py-1.5 text-[13px] font-extrabold text-black transition hover:bg-white/85 active:scale-95">
        Follow
      </button>
    </div>
  );

  const TrendRow = ({ t, i }: { t: Ticker; i: number }) => {
    const up = (t.change24h ?? 0) >= 0;
    return (
      <button type="button" onClick={() => onSelectMint?.(t.mint)} className="osc-row w-full text-left">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-white/35">#{i + 1} · Trending on Solana</div>
          <div className="text-[14px] font-extrabold text-white">${t.symbol}</div>
          <div className="text-[11px] text-white/35">{t.priceUsd != null ? `$${t.priceUsd < 0.01 ? t.priceUsd.toExponential(2) : t.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 6 })}` : ""}</div>
        </div>
        <span className={cn("mt-1 inline-flex items-center gap-0.5 text-[12px] font-bold", up ? "text-emerald-400" : "text-rose-400")}>
          {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {Math.abs(t.change24h ?? 0).toFixed(1)}%
        </span>
      </button>
    );
  };

  const CommunityRow = ({ c }: { c: CommunityLite }) => (
    <button type="button" onClick={() => { setCommView("groups"); setTab("communities"); }} className="osc-row w-full text-left">
      {c.avatar_url ? (
        <img src={c.avatar_url} alt="" className="h-11 w-11 shrink-0 rounded-2xl object-cover ring-1 ring-white/[0.1]" />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#3b82f6]/30 to-[#f0c75e]/15 text-[18px] font-extrabold text-white ring-1 ring-white/[0.1]">
          {(c.name || "?").slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-extrabold text-white">{c.name}</span>
          {c.category && <span className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-bold text-white/45 ring-1 ring-white/[0.06]">{c.category}</span>}
        </div>
        <div className="truncate text-[12px] text-white/40">
          {(c.member_count ?? 0).toLocaleString()} member{(c.member_count ?? 0) === 1 ? "" : "s"}{c.description ? ` · ${c.description}` : ""}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-white px-4 py-1.5 text-[12px] font-extrabold text-black transition hover:bg-white/85">View</span>
    </button>
  );

  /* ── Auth-gated 404: shown when a logged-out user hits Messages / Notifications / Bookmarks / Profile ── */
  const AuthGate404 = ({ label }: { label: string }) => (
    <div className="flex h-full min-h-[60dvh] flex-col items-center justify-center px-8 text-center">
      <div className="text-[28px] font-extrabold tracking-tight text-white" style={{ fontFamily: "var(--osc-font-display)" }}>
        {label} doesn't exist
      </div>
      <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-white/45">
        This page requires login. Sign in with X to access your {label.toLowerCase()}.
      </p>
      <button
        type="button"
        onClick={() => { window.location.href = `/auth?return=${encodeURIComponent(window.location.pathname)}`; }}
        className="osc-btn-primary mt-6"
      >
        Log in with X
      </button>
      <button
        type="button"
        onClick={() => setTab("home")}
        className="mt-3 text-[13px] font-bold text-[#60a5fa] hover:underline"
      >
        Back to home
      </button>
    </div>
  );

  /* ═══════════ Center column content ═══════════ */
  const renderCenter = () => {
    /* Auth-gated tabs 404 for logged-out users (public: feed, tweet detail, public profiles, explore, embeds). */
    if (!user && (tab === "messages" || tab === "notifications" || tab === "bookmarks" || tab === "profile")) {
      const label = tab === "messages" ? "Messages" : tab === "notifications" ? "Notifications" : tab === "bookmarks" ? "Bookmarks" : "Profile";
      return <AuthGate404 label={label} />;
    }
    switch (tab) {
      case "home":
        return (
          <>
            <div className="osc-sticky">
              <div className="flex">
                {([["foryou", "For you"], ["following", "Following"]] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFeedMode(id)}
                    className={cn("osc-feedtab", feedMode === id && "osc-feedtab--on")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden lg:block"><Composer inline refEl={composerRef} /></div>

            {loading ? (
              <div>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="osc-post">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-white/[0.06]" />
                    <div className="flex-1 space-y-2.5 py-1">
                      <div className="h-3 w-40 rounded-full bg-white/[0.06]" />
                      <div className="h-3 w-full rounded-full bg-white/[0.04]" />
                      <div className="h-3 w-3/5 rounded-full bg-white/[0.04]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : shownPosts.length === 0 ? (
              <div className="osc-empty">
                <div className="osc-empty__icon"><Sparkles className="h-6 w-6 text-[#f0c75e]" /></div>
                <div className="mt-4 text-[20px] font-extrabold text-white">
                  {feedMode === "following" ? "Nothing here yet" : "Welcome to OrbitX Social Center"}
                </div>
                <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-white/40">
                  {feedMode === "following"
                    ? "Follow people to see their posts in your timeline."
                    : "The place to chat, discover and find what's happening on chain. Your first post kicks off the feed."}
                </p>
                {feedMode === "foryou" && (
                  <button type="button" onClick={() => { setComposeOpen(true); setTimeout(() => modalRef.current?.focus(), 60); }} className="osc-btn-primary mt-5">
                    Write your first post
                  </button>
                )}
              </div>
            ) : (
              <>{shownPosts.map((p) => <PostCard key={p.id} p={p} onOpen={setOpenPostId} />)}</>
            )}
          </>
        );

      case "explore": {
        const scopeChips: { id: "all" | "people" | "coins" | "communities"; label: string }[] = [
          { id: "all", label: "All" },
          { id: "people", label: "People" },
          { id: "coins", label: "Coins" },
          { id: "communities", label: "Communities" },
        ];
        const showPeople = searchScope === "all" || searchScope === "people";
        const showCoins = searchScope === "all" || searchScope === "coins";
        const showComms = searchScope === "all" || searchScope === "communities";
        return (
          <>
            <div className="osc-sticky">
              <div className="p-3 pb-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    ref={exploreSearchRef}
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Search people, coins & communities"
                    className="w-full rounded-full border border-white/[0.08] bg-white/[0.06] py-2.5 pl-11 pr-10 text-[15px] text-white placeholder:text-white/30 outline-none transition focus:border-[#3b82f6] focus:bg-black focus:shadow-[0_0_0_3px_rgba(59,130,246,0.18)]"
                  />
                  {searchQ && (
                    <button type="button" onClick={() => setSearchQ("")} className="absolute right-3 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-white/[0.1] text-white/50 transition hover:bg-white/[0.2] hover:text-white" aria-label="Clear search">
                      <XIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              {searchQ.trim() && (
                <div className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none]">
                  {scopeChips.map((c) => (
                    <button key={c.id} type="button" onClick={() => setSearchScope(c.id)} className={cn("osc-chip", searchScope === c.id && "osc-chip--on")}>
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {searchQ.trim() ? (
              <div className="pb-8">
                {searching && (
                  <div className="h-0.5 w-full overflow-hidden bg-white/[0.04]">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-[#3b82f6] to-[#60a5fa]" />
                  </div>
                )}
                {showPeople && (
                  <section className="border-b border-white/[0.06] pb-2">
                    <div className="osc-sect flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#3b82f6]/15 ring-1 ring-[#3b82f6]/25"><Users className="h-3.5 w-3.5 text-[#60a5fa]" /></span>
                      People <span className="text-[12px] font-bold text-white/30">{searchedUsers.length}</span>
                    </div>
                    {searchedUsers.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[13px] text-white/35">No matching users.</div>
                    ) : searchedUsers.map((s) => <FollowCard key={s.user_id} s={s} />)}
                  </section>
                )}
                {showCoins && (
                  <section className="border-b border-white/[0.06] pb-2">
                    <div className="osc-sect flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f0c75e]/12 ring-1 ring-[#f0c75e]/25"><Coins className="h-3.5 w-3.5 text-[#f0c75e]" /></span>
                      Coins <span className="text-[12px] font-bold text-white/30">{foundCoins.length}</span>
                    </div>
                    {foundCoins.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[13px] text-white/35">No coins found. Try a symbol or paste a contract address.</div>
                    ) : foundCoins.map((t, i) => <TrendRow key={t.mint} t={t} i={i} />)}
                  </section>
                )}
                {showComms && (
                  <section className="pb-2">
                    <div className="osc-sect flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#3b82f6]/15 ring-1 ring-[#3b82f6]/25"><Globe className="h-3.5 w-3.5 text-[#60a5fa]" /></span>
                      Communities <span className="text-[12px] font-bold text-white/30">{foundComms.length}</span>
                    </div>
                    {foundComms.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[13px] text-white/35">No matching communities.</div>
                    ) : foundComms.map((c) => <CommunityRow key={c.id} c={c} />)}
                  </section>
                )}
              </div>
            ) : (
              <div className="pb-10">
                <div className="x-rise relative overflow-hidden border-b border-white/[0.06] px-4 pb-4 pt-4">
                  <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-[#3b82f6]/15 blur-[70px]" />
                  <div className="pointer-events-none absolute -left-16 top-6 h-40 w-40 rounded-full bg-[#f0c75e]/10 blur-[80px]" />
                  <div className="relative">
                    <div className="font-display text-[24px] font-extrabold tracking-tight text-white" style={{ fontFamily: "var(--osc-font-display)" }}>Discover</div>
                    <div className="mt-0.5 text-[13px] text-white/45">Find people, coins and communities across OrbitX.</div>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {([
                        { Icon: Users, label: "People", scope: "people" as const },
                        { Icon: Coins, label: "Coins", scope: "coins" as const },
                        { Icon: Globe, label: "Communities", scope: "communities" as const },
                        { Icon: TrendingUp, label: "Trending", scope: "all" as const },
                      ]).map((c) => (
                        <button key={c.label} type="button" onClick={() => { setSearchScope(c.scope); exploreSearchRef.current?.focus(); }} className="x-tilt group flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] py-3">
                          <c.Icon className="h-5 w-5 text-white/70 transition group-hover:text-[#60a5fa]" />
                          <span className="text-[10.5px] font-bold text-white/60 group-hover:text-white">{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="x-rise border-b border-white/[0.06] px-4 py-3" style={{ animationDelay: "60ms" }}>
                  <div className="mb-2 text-[13px] font-extrabold text-white">Quick searches</div>
                  <div className="flex flex-wrap gap-2">
                    {[...trendingTags.slice(0, 6).map(([t]) => t), "$SOL", "$BONK", "$WIF"].filter((v, i, a) => a.indexOf(v) === i).slice(0, 8).map((tag) => (
                      <button key={tag} type="button" onClick={() => setSearchQ(tag)} className="osc-chip">{tag}</button>
                    ))}
                  </div>
                </div>

                <div className="x-rise border-b border-white/[0.06] px-4 py-3" style={{ animationDelay: "120ms" }}>
                  <div className="mb-2 flex items-center gap-1.5 text-[15px] font-extrabold text-white">🔥 Trending on Solana</div>
                  {ticker.length === 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="x-shim h-[58px] rounded-2xl" />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {ticker.slice(0, 8).map((t) => {
                        const up = (t.change24h ?? 0) >= 0;
                        return (
                          <button key={t.mint} type="button" onClick={() => onSelectMint?.(t.mint)} className="x-tilt flex items-center justify-between rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-white/[0.02] px-3 py-2.5 text-left">
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-extrabold text-white">${t.symbol}</div>
                              <div className="truncate text-[10.5px] text-white/40">{t.priceUsd != null ? "$" + (t.priceUsd < 0.01 ? t.priceUsd.toExponential(1) : t.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })) : "—"}</div>
                            </div>
                            <span className={cn("shrink-0 text-[12px] font-extrabold", up ? "text-emerald-400" : "text-rose-400")}>{up ? "▲" : "▼"}{Math.abs(t.change24h ?? 0).toFixed(1)}%</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {trendingTags.length > 0 && (
                  <div className="x-rise border-b border-white/[0.06] pb-2" style={{ animationDelay: "180ms" }}>
                    <div className="osc-sect">Trending in posts</div>
                    {trendingTags.map(([tag, count]) => (
                      <button key={tag} type="button" onClick={() => setSearchQ(tag)} className="osc-row w-full text-left">
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-extrabold text-[#f0c75e]">{tag}</div>
                          <div className="text-[11px] text-white/35">{count} post{count > 1 ? "s" : ""}</div>
                        </div>
                        <TrendingUp className="h-4 w-4 text-white/25" />
                      </button>
                    ))}
                  </div>
                )}

                {topComms.length > 0 && (
                  <div className="x-rise border-b border-white/[0.06] pb-2" style={{ animationDelay: "200ms" }}>
                    <div className="osc-sect">Communities to explore</div>
                    {topComms.map((c) => <CommunityRow key={c.id} c={c} />)}
                  </div>
                )}

                <div className="x-rise pb-2" style={{ animationDelay: "260ms" }}>
                  <div className="osc-sect">Who to follow</div>
                  {whoToFollow.slice(0, 6).map((s) => <FollowCard key={s.user_id} s={s} />)}
                </div>
              </div>
            )}
          </>
        );
      }

      case "notifications":
        return (
          <>
            <div className="osc-sticky">
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="flex items-center gap-2 text-[19px] font-extrabold text-white" style={{ fontFamily: "var(--osc-font-display)" }}>
                  Notifications
                  {unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#3b82f6] px-1.5 text-[11px] font-extrabold text-white">{unread > 99 ? "99+" : unread}</span>}
                </span>
                {unread > 0 && (
                  <button type="button" onClick={markAllRead} className="osc-btn-ghost">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none]">
                {(([["all", "All"], ["mentions", "Mentions"], ["likes", "Likes"], ["follows", "Follows"]]) as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setNotifFilter(id)} className={cn("osc-chip", notifFilter === id && "osc-chip--on")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {notifsLoading ? <Spinner /> : shownNotifs.length === 0 ? (
              <div className="osc-empty">
                <div className="osc-empty__icon"><Bell className="h-6 w-6 text-[#60a5fa]" /></div>
                <div className="mt-3 text-[17px] font-extrabold text-white">{notifFilter === "all" ? "Nothing yet" : "You're all caught up"}</div>
                <div className="mt-1 text-[13px] text-white/40">{notifFilter === "all" ? "Likes, follows and alerts will show up here." : `No ${notifFilter} notifications.`}</div>
              </div>
            ) : (
              shownNotifs.map((n) => (
                <div key={n.id} className={cn("osc-row x-fade-in", !n.is_read && "bg-[#3b82f6]/[0.05] shadow-[inset_2px_0_0_#3b82f6]")}>
                  {(() => {
                    const ty = (n.type || "").toLowerCase();
                    const [Ic, tone, ring] = ty.includes("like") ? [Heart, "text-pink-400", "from-pink-500/20 to-rose-500/10 ring-pink-500/25"] as const
                      : ty.includes("follow") ? [User, "text-white", "from-white/20 to-white/10 ring-white/25"] as const
                      : ty.includes("repl") || ty.includes("mention") || ty.includes("comment") ? [MessageCircle, "text-[#60a5fa]", "from-[#3b82f6]/20 to-[#3b82f6]/10 ring-[#3b82f6]/25"] as const
                      : ty.includes("alert") || ty.includes("price") ? [TrendingUp, "text-[#f0c75e]", "from-[#f0c75e]/20 to-[#f0c75e]/10 ring-[#f0c75e]/25"] as const
                      : [Bell, "text-[#60a5fa]", "from-[#3b82f6]/20 to-[#3b82f6]/10 ring-[#3b82f6]/25"] as const;
                    return (
                      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br ring-1", ring)}>
                        <Ic className={cn("h-4 w-4", tone)} />
                      </div>
                    );
                  })()}
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-extrabold text-white">{n.title || n.type}</div>
                    <div className="text-[13px] text-white/50">{n.message}</div>
                  </div>
                  <span className="shrink-0 text-[11px] text-white/30">{timeAgo(n.created_at)}</span>
                </div>
              ))
            )}
          </>
        );

      case "bookmarks":
        return (
          <>
            <div className="osc-sticky flex items-center gap-2 px-4 py-3.5">
              <span className="text-[19px] font-extrabold text-white" style={{ fontFamily: "var(--osc-font-display)" }}>Bookmarks</span>
              <span className="text-[13px] font-bold text-white/40">{bookmarks.size}</span>
            </div>
            {bmLoading ? (
              <div>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="osc-post animate-pulse">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-white/[0.07]" />
                    <div className="flex-1 space-y-2 py-1"><div className="h-3 w-36 rounded-full bg-white/[0.07]" /><div className="h-3 w-full rounded-full bg-white/[0.05]" /></div>
                  </div>
                ))}
              </div>
            ) : bookmarkPosts.length === 0 ? (
              <div className="osc-empty">
                <div className="osc-empty__icon"><Bookmark className="h-6 w-6 text-[#f0c75e]" /></div>
                <div className="mt-3 text-[17px] font-extrabold text-white">No bookmarks yet</div>
                <div className="mt-1 text-[13px] text-white/40">Tap the bookmark icon on any post to save it here.</div>
              </div>
            ) : (
              bookmarkPosts.map((p) => <PostCard key={p.id} p={p} onOpen={setOpenPostId} />)
            )}
          </>
        );

      case "messages":
        return (
          <div className="flex h-full min-h-0 flex-col">
            <div className="osc-sticky">
              <div className="px-4 pt-3 pb-2">
                <div className="text-[20px] font-extrabold tracking-tight text-white" style={{ fontFamily: "var(--osc-font-display)" }}>Messages</div>
              </div>
              <div className="flex items-center gap-1.5 px-4 pb-3">
                {([["direct", "Direct"], ["groups", "Groups"]] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setMsgView(id)} className={cn("osc-chip", msgView === id && "osc-chip--on")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <Suspense fallback={<Spinner />}>
                {msgView === "direct" ? (
                  <div className="h-full min-h-0 overflow-hidden"><MessagesPage /></div>
                ) : (
                  <div className="h-full min-h-0 overflow-hidden"><ChatHub /></div>
                )}
              </Suspense>
            </div>
          </div>
        );

      case "communities":
        return (
          <div className="flex h-full min-h-0 flex-col">
            <div className="osc-sticky">
              <div className="px-4 pt-3 pb-2">
                <div className="text-[20px] font-extrabold tracking-tight text-white" style={{ fontFamily: "var(--osc-font-display)" }}>Communities</div>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
                {([["groups", "Groups"], ["rooms", "Rooms"], ["spaces", "Spaces"]] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setCommView(id)} className={cn("osc-chip shrink-0", commView === id && "osc-chip--on")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Suspense fallback={<Spinner />}>
                {commView === "groups" && <CommunitiesPage />}
                {commView === "rooms" && <RoomsPage />}
                {commView === "spaces" && <div className="px-3 py-4"><SpacesPage /></div>}
              </Suspense>
            </div>
          </div>
        );

      case "profile":
        return (
          <Suspense fallback={<Spinner />}>
            <div className="h-full min-h-0 overflow-y-auto"><ProfilePage /></div>
          </Suspense>
        );
    }
  };

  /* ═══════════ Layout ═══════════ */
  const goTab = (id: XTab) => {
    setMoreOpen(false);
    if (tab === id) feedScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    else setTab(id);
  };

  return (
    <div className="osc-shell ox-x-social">
      <div className="osc-shell__atmosphere" aria-hidden>
        <div className="osc-shell__blob osc-shell__blob--a" />
        <div className="osc-shell__blob osc-shell__blob--b" />
      </div>

      {/* ── Mobile top bar ── */}
      <header className="osc-topbar">
        <div className="osc-topbar__brand">
          <span className="osc-topbar__mark">O</span>
          <div>
            <div className="osc-topbar__name">OrbitX <em>Social Center</em></div>
            <div className="osc-topbar__sub">{tabLabel}</div>
          </div>
        </div>
        <button type="button" onClick={() => goTab("notifications")} aria-label="Notifications" className="osc-topbar__bell">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="osc-topbar__badge">{unread > 9 ? "9+" : unread}</span>}
        </button>
      </header>

      {/* ── Desktop left sidebar ── */}
      <nav className="osc-rail" aria-label="Social navigation">
        <div>
          <div className="osc-rail__brand">
            <span className="osc-topbar__mark">O</span>
            <span className="osc-rail__brand-name">OrbitX <em>Social</em></span>
          </div>
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => goTab(n.id)}
              className={cn("osc-rail__link", tab === n.id && "osc-rail__link--on")}
            >
              <span className="relative">
                <n.Icon className="h-6 w-6" strokeWidth={tab === n.id ? 2.4 : 2} />
                {n.id === "notifications" && unread > 0 && (
                  <span className="absolute -right-1.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#3b82f6] px-1 text-[9px] font-extrabold text-white">{unread > 9 ? "9+" : unread}</span>
                )}
              </span>
              <span className="osc-rail__label">{n.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setComposeOpen(true); setTimeout(() => modalRef.current?.focus(), 60); }}
            className="osc-rail__post"
          >
            <Feather className="h-5 w-5" />
            <span className="osc-rail__post-label">Post</span>
          </button>
        </div>

        <div className="osc-rail__user">
          <img src={myAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
          <div className="osc-rail__user-meta">
            <div className="truncate text-[14px] font-extrabold">{displayName}</div>
            <div className="truncate text-[12px] text-white/35">@{handle}</div>
          </div>
          <button type="button" title="Log out" onClick={() => signOut?.()} className="hidden rounded-full p-2 text-white/40 transition hover:bg-white/[0.07] hover:text-white min-[1300px]:block">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </nav>

      {/* ── Center column ── */}
      <main className="osc-main">
        {tab === "home" && newPosts > 0 && (
          <button
            type="button"
            onClick={() => { feedScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); setNewPosts(0); }}
            className="x-rise absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#60a5fa] px-4 py-2 text-[13px] font-extrabold text-white shadow-[0_8px_24px_rgba(59,130,246,0.45)] transition hover:brightness-110 active:scale-95 lg:top-4"
          >
            ↑ {newPosts} new post{newPosts > 1 ? "s" : ""}
          </button>
        )}
        <div
          ref={feedScrollRef}
          onScroll={(e) => { if (e.currentTarget.scrollTop < 200 && newPosts) setNewPosts(0); }}
          className="osc-main__scroll"
        >
          {renderCenter()}
        </div>
      </main>

      {/* ── Desktop right sidebar ── */}
      {isNarrow && (
        <aside className="osc-aside">
          {tab !== "explore" && (
            <div className="osc-search">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); if (e.target.value.trim()) setTab("explore"); }}
                placeholder="Search OrbitX"
              />
            </div>
          )}

          <div className="osc-aside__card x-rise">
            <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
              <span className="osc-aside__card-head" style={{ padding: 0 }}>Market pulse</span>
              <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold", marketPulse.avg >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400")}>
                {marketPulse.avg >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {marketPulse.avg >= 0 ? "+" : ""}{marketPulse.avg.toFixed(1)}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-px bg-white/[0.06] mt-2">
              {([
                { k: "SOL", v: marketPulse.sol?.priceUsd != null ? "$" + marketPulse.sol.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—", c: "text-white" },
                { k: "Gainers", v: String(marketPulse.gainers), c: "text-emerald-400" },
                { k: "Losers", v: String(marketPulse.losers), c: "text-rose-400" },
              ]).map((cell) => (
                <div key={cell.k} className="bg-[#0a0e14] px-3 py-2.5">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-white/35">{cell.k}</div>
                  <div className={cn("text-[14px] font-extrabold", cell.c)}>{cell.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="osc-aside__card x-rise" style={{ animationDelay: "80ms" }}>
            <div className="osc-aside__card-head">What's happening</div>
            {ticker.length === 0 ? (
              <div className="space-y-2.5 px-4 pb-3 pt-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="x-shim h-3 w-24 rounded-full" />
                    <div className="x-shim h-3 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : ticker.slice(0, 5).map((t, i) => <TrendRow key={t.mint} t={t} i={i} />)}
            <button type="button" onClick={() => setTab("explore")} className="w-full px-4 py-3 text-left text-[14px] font-bold text-[#60a5fa] transition hover:bg-white/[0.03]">
              Show more
            </button>
          </div>

          <div className="osc-aside__card x-rise" style={{ animationDelay: "160ms" }}>
            <div className="osc-aside__card-head">Who to follow</div>
            {whoToFollow.slice(0, 3).map((s) => <FollowCard key={s.user_id} s={s} />)}
            <button type="button" onClick={() => setTab("explore")} className="w-full px-4 py-3 text-left text-[14px] font-bold text-[#60a5fa] transition hover:bg-white/[0.03]">
              Show more
            </button>
          </div>

          <footer className="osc-footer">
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/whitepaper">Whitepaper</a>
            <a href="/api">API</a>
            <a href="https://x.com/orbitxwrld" target="_blank" rel="noreferrer">X</a>
            <div className="mt-1">© 2026 OrbitX Social Center · The place to chat, discover and find what's happening on chain.</div>
          </footer>
        </aside>
      )}

      {/* ── Mobile bottom tab bar — centered ── */}
      <nav className="osc-dock-wrap" aria-label="Social navigation">
        <div className="osc-dock">
          {CORE_TABS.slice(0, 2).map((id) => {
            const n = NAV.find((x) => x.id === id)!;
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => goTab(id)}
                className={cn("osc-dock__item", on && "osc-dock__item--on")}
                aria-current={on ? "page" : undefined}
              >
                <span className="osc-dock__icon">
                  <n.Icon className="h-[20px] w-[20px]" strokeWidth={on ? 2.4 : 2} />
                  {id === "notifications" && unread > 0 && <span className="osc-dock__dot" />}
                </span>
                <span className="osc-dock__label">{TAB_SHORT[id]}</span>
              </button>
            );
          })}
          {/* ── Big center compose button ── */}
          <button
            type="button"
            onClick={() => { setComposeOpen(true); setTimeout(() => modalRef.current?.focus(), 60); }}
            className="osc-dock__compose"
            aria-label="Compose post"
          >
            <Feather className="h-7 w-7" />
          </button>
          {CORE_TABS.slice(2).map((id) => {
            const n = NAV.find((x) => x.id === id)!;
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => goTab(id)}
                className={cn("osc-dock__item", on && "osc-dock__item--on")}
                aria-current={on ? "page" : undefined}
              >
                <span className="osc-dock__icon">
                  <n.Icon className="h-[20px] w-[20px]" strokeWidth={on ? 2.4 : 2} />
                  {id === "notifications" && unread > 0 && <span className="osc-dock__dot" />}
                </span>
                <span className="osc-dock__label">{TAB_SHORT[id]}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn("osc-dock__item", dockOnMore && "osc-dock__item--on")}
            aria-expanded={moreOpen}
            aria-label="More"
          >
            <span className="osc-dock__icon">
              <MoreHorizontal className="h-[20px] w-[20px]" strokeWidth={dockOnMore ? 2.4 : 2} />
            </span>
            <span className="osc-dock__label">More</span>
          </button>
        </div>
      </nav>

      {/* ── More sheet ── */}
      {moreOpen && (
        <div className="osc-sheet">
          <div className="osc-sheet__backdrop" onClick={() => setMoreOpen(false)} />
          <div className="osc-sheet__panel x-fade-in">
            <div className="osc-sheet__grab" />
            <div className="osc-sheet__grid">
              {MORE_TABS.map((id) => {
                const n = NAV.find((x) => x.id === id)!;
                const on = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => goTab(id)}
                    className={cn("osc-sheet__item", on && "osc-sheet__item--on")}
                  >
                    <n.Icon className="h-6 w-6" />
                    <span>{n.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile compose FAB ── */}
      {tab === "home" && (
        <button
          type="button"
          onClick={() => { setComposeOpen(true); setTimeout(() => modalRef.current?.focus(), 60); }}
          className="osc-fab"
          aria-label="Compose post"
        >
          <Feather className="h-6 w-6" />
        </button>
      )}

      <input ref={composerFileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void uploadComposerImage(e.target.files); e.currentTarget.value = ""; }} />

      {/* ── Post detail / thread ── */}
      {openPostId && (
        <div className="osc-modal" onClick={() => setOpenPostId(null)}>
          <div className="osc-modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="osc-modal__head">
              <button type="button" onClick={() => setOpenPostId(null)} className="rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"><XIcon className="h-5 w-5" /></button>
              <span className="text-[17px] font-extrabold text-white" style={{ fontFamily: "var(--osc-font-display)" }}>Post</span>
            </div>
            <div className="osc-modal__body">
              {detailParent && (
                <button type="button" onClick={() => setOpenPostId(detailParent.id)} className="osc-row w-full text-left text-[13px] text-white/45">
                  <span className="text-white/30">↑</span> Replying to <span className="font-bold text-[#60a5fa]">@{detailParent.username || "post"}</span>
                </button>
              )}
              {detailPost ? <PostCard p={detailPost} /> : <div className="px-4 py-8 text-center text-sm text-white/40">Loading…</div>}
              {user && (
                <div className="osc-composer" style={{ borderBottom: "1px solid var(--osc-border)" }}>
                  <img src={myAvatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
                  <div className="flex-1">
                    <textarea value={replyText} onChange={(e) => setReplyText(e.target.value.slice(0, MAX_LEN))} placeholder="Post your reply" rows={2} style={{ fontSize: 15 }} />
                    <div className="mt-1 flex justify-end">
                      <button type="button" disabled={!replyText.trim() || replyPosting} onClick={submitReply} className="osc-btn-primary" style={{ padding: "6px 16px", fontSize: 13 }}>{replyPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reply"}</button>
                    </div>
                  </div>
                </div>
              )}
              {detailLoading ? (
                <div className="px-4 py-6 text-center text-sm text-white/40">Loading replies…</div>
              ) : detailReplies.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-white/40">No replies yet. Be the first.</div>
              ) : detailReplies.map((r) => <PostCard key={r.id} p={r} onOpen={setOpenPostId} />)}
            </div>
          </div>
        </div>
      )}

      {/* ── Compose modal ── */}
      {composeOpen && (
        <div className="osc-modal" onClick={() => setComposeOpen(false)}>
          <div className="osc-modal__card x-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="osc-modal__head">
              <button type="button" onClick={() => setComposeOpen(false)} className="rounded-full p-2 text-white/60 transition hover:bg-white/[0.07] hover:text-white">
                <XIcon className="h-5 w-5" />
              </button>
              <span className="text-[13px] font-bold text-[#60a5fa]">Drafts save automatically</span>
            </div>
            <div className="px-1 pb-2">
              <Composer refEl={modalRef} />
            </div>
          </div>
        </div>
      )}

      {/* ── Chart picker ── */}
      {chartPickerOpen && <TokenPicker onPick={attachChart} onClose={() => setChartPickerOpen(false)} />}

      {/* ── Holders-only token picker ── */}
      {gatePickerOpen && <TokenPicker title="Pick a token for holders-only" onPick={pickGateToken} onClose={() => setGatePickerOpen(false)} />}

      {/* ── Tweet-as-NFT mint modal ── */}
      {mintPost && (
        <NftMintModal
          p={mintPost}
          onClose={() => setMintPost(null)}
          onMinted={(mint, priceUsd) => {
            setPosts((prev) => prev.map((x) => (x.id === mintPost.id ? { ...x, nft_mint: mint, nft_price_usd: priceUsd } : x)));
            setDetailPost((prev) => (prev && prev.id === mintPost.id ? { ...prev, nft_mint: mint, nft_price_usd: priceUsd } : prev));
            setMintPost(null);
          }}
        />
      )}

      {/* ── Feed superpowers: trade / tip bottom sheets ── */}
      {tradeSheet && (
        <TradeSheet
          mint={tradeSheet.mint}
          symbol={tradeSheet.symbol}
          mode={tradeSheet.mode}
          post={tradeSheet.post}
          onClose={() => setTradeSheet(null)}
        />
      )}
      {tipSheet && (
        <TipSheet
          post={tipSheet}
          onClose={() => setTipSheet(null)}
          onTipped={(amt) => setTipped((prev) => ({ ...prev, [tipSheet.id]: amt }))}
        />
      )}

      {/* ── Onboarding ── */}
      {onboardOpen && (
        <OnboardingFlow
          suggestions={whoToFollow.slice(0, 8)}
          onFollow={follow}
          onDone={dismissOnboard}
          onConnectWallet={() => { dismissOnboard(); window.location.href = "/app?tab=wallet"; }}
          onFirstPost={() => setComposeOpen(true)}
        />
      )}
    </div>
  );
}
