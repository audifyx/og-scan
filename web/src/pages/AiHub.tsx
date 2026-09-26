/* OrbitX AI Hub — command deck (v2 redesign).
   Layout: mission sidebar (threads) + stage (chat) + live rail (portfolio/alerts).
   Visual language: deep-space base, iris/cyan aurora accents, glass cards,
   uppercase micro-labels, tabular numerals, hub-rise/hub-fade motion.
   Features: threads CRUD + search (titles + message bodies), pins, mode/lang,
   voice dictation, per-message TTS, slash menu, Cmd+K, quick prompts, thread
   templates, exit presets, win cards, chart/safety/quote/bundle/alloc cards,
   pending confirmations, token mention chips (DexScreener live prices),
   copy-address chips, mirror-trade fill, markdown export, away digest,
   alert-fill toasts, live portfolio + alert management rail. */

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import {
  Plus,
  Send,
  Square,
  Trash2,
  Loader2,
  ChevronDown,
  Check,
  X,
  Menu,
  Sparkles,
  Wrench,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Zap,
  Mic,
  Volume2,
  VolumeX,
  Share2,
  Download,
  Target,
  Brain,
  Flame,
  Pin,
  Globe,
  MessageSquare,
  Sunrise,
  NotebookPen,
  Search,
  Bell,
  BellRing,
  BellOff,
  PanelRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity,
  Clock,
  History,
  FileDown,
  Layers,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  hubListThreads,
  hubCreateThread,
  hubGetThread,
  hubDeleteThread,
  hubChat,
  hubChatStream,
  reduceHubThinking,
  hubConfirm,
  hubModels,
  hubExportTradesCsv,  hubStats,
  hubAlertsList,
  hubAlertDelete,
  hubAlertMute,
  hubPendingList,
  hubSearchMessages,
  type HubThread,
  type HubMessage,
  type HubToolCall,
  type HubThinking,
  type HubStreamEvent,
  type HubChatResponse,
  type HubPending,
  type HubSafety,
  type HubQuote,
  type HubBundleAction,
  type HubChatPending,
  type HubMode,
  type HubStats,
  type HubAlertItem,
  type HubSearchHit,
} from "@/components/hub/api";
import {
  TokenChip,
  CopyAddr,
  findTokenMentions,
  MINT_RE,
  fmtUsd,
} from "@/components/hub/tokens";

/* ── thread templates ──────────────────────────────────────────── */

interface ThreadTemplate {
  id: string;
  icon: typeof Sunrise;
  title: string;
  desc: string;
  prompt: string;
}

const THREAD_TEMPLATES: ThreadTemplate[] = [
  {
    id: "brief",
    icon: Sunrise,
    title: "Morning brief",
    desc: "PnL, watchlist movers, what's hot",
    prompt:
      "Give me my morning brief: portfolio PnL, watchlist movers, and what's trending right now.",
  },
  {
    id: "dive",
    icon: Search,
    title: "Token deep dive",
    desc: "Safety, liquidity, whales, sentiment",
    prompt:
      "I want a deep dive on a token. First ask me which token (or paste the mint), then cover safety, liquidity, whales, and X sentiment.",
  },
  {
    id: "journal",
    icon: NotebookPen,
    title: "Trade journal",
    desc: "Log and review your trades",
    prompt:
      "Let's start a trade journal thread. Ask me about my open positions and recent trades, then summarize my exposure and the plan for each.",
  },
];

/* ── markdown with copy-address chips ──────────────────────────── */

/** Turn bare base58 addresses in prose into [addr](copy:…) links (skips code fences). */
function linkifyAddresses(text: string): string {
  return text
    .split(/(```[\s\S]*?```)/g)
    .map((seg, i) => {
      if (i % 2 === 1) return seg; // code fence — leave alone
      return seg.replace(MINT_RE, (m) => `[${m}](copy:${m})`);
    })
    .join("");
}

function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        a: ({ href, children }: any) => {
          if (href && href.startsWith("copy:")) {
            return <CopyAddr address={href.slice(5)} />;
          }
          return (
            <a href={href} target="_blank" rel="noreferrer" className="text-iris underline decoration-iris/40 underline-offset-2 hover:decoration-iris">
              {children}
            </a>
          );
        },
        code: ({ children }: any) => (
          <code className="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[12px] text-iris">{children}</code>
        ),
        pre: ({ children }: any) => (
          <pre className="overflow-x-auto rounded-xl border border-white/[0.08] bg-black/40 p-3 text-[12px]">{children}</pre>
        ),
      }}
    >
      {linkifyAddresses(text || "")}
    </ReactMarkdown>
  );
}

/** Live token chips for $SYMBOL / mint mentions in a message. */
function MentionChips({ text, limit = 6 }: { text: string; limit?: number }) {
  const mentions = findTokenMentions(text).slice(0, limit);
  if (mentions.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {mentions.map((m, i) => (
        <TokenChip key={`${m.kind}:${m.value}:${i}`} mint={m.kind === "mint" ? m.value : undefined} symbol={m.kind === "symbol" ? m.value : undefined} />
      ))}
    </div>
  );
}

/* ── insight cards (top of stage on thread open) ───────────────── */

export interface Insight {
  id: string;
  kind: "alerts" | "pending" | "pnl" | "strategies";
  title: string;
  body: string;
  accent: string;
}

function InsightCards({ insights, onDismiss }: { insights: Insight[]; onDismiss: (id: string) => void }) {
  if (insights.length === 0) return null;
  return (
    <div className="hub-stagger grid gap-2 px-4 pt-3 sm:grid-cols-2 xl:grid-cols-4">
      {insights.map((ins) => (
        <div
          key={ins.id}
          className="hub-rise relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 backdrop-blur"
        >
          <div className={cn("absolute inset-x-0 top-0 h-px", ins.accent)} />
          <div className="flex items-start justify-between gap-2">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{ins.title}</div>
            <button
              type="button"
              onClick={() => onDismiss(ins.id)}
              aria-label="Dismiss"
              className="text-white/25 transition hover:text-white/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-1 text-[13px] leading-snug text-white/85">{ins.body}</div>
        </div>
      ))}
    </div>
  );
}

/* ── skeleton loading ──────────────────────────────────────────── */

function ThreadSkeleton() {
  return (
    <div className="space-y-3 px-4 py-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
          <div className="w-3/4 max-w-md space-y-2">
            <div className="h-3.5 w-11/12 animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="h-3.5 w-2/3 animate-pulse rounded-lg bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}
const QUICK_PROMPTS = [
  { label: "📄 Dossier a token", prompt: "Give me a full dossier on this token (safety, liquidity, whales, X sentiment): " },
  { label: "⚡ Automate a trade", prompt: "I want to automate a trade. My portfolio PnL and open strategies first, then ask me what to set up." },
  { label: "🚀 Launch a coin", prompt: "Walk me through launching a coin on OrbitX — what do you need from me?" },
  { label: "✖️ Draft posts", prompt: "Help me draft posts for X about OrbitX. Show me the exact text before anything goes out." },
  { label: "🌅 Morning brief", prompt: "Give me my morning brief: portfolio PnL, watchlist movers, and what's trending." },
  { label: "📝 Paper trade", prompt: "Let's paper trade — check my paper portfolio, then ask me what to buy." },
  { label: "🤖 Delegate to an agent", prompt: "I have a long-running task. Spawn an agent for it and explain how you'll report back." },
  { label: "📈 Robinhood Chain", prompt: "Show me what's happening on Robinhood Chain: desk snapshot, stock token premiums, and new launches." },
  { label: "🏆 Win card", prompt: "Generate my PnL win card for this week." },
  { label: "⚖️ Compare tokens", prompt: "Compare BONK vs WIF side by side: " },
  { label: "🧹 Sweep dust", prompt: "Find my dust balances under $1 and propose sweeping them into SOL." },
  { label: "📊 Chart SOL 15m", prompt: "Show me SOL's 15m chart with price action and key levels." },
  { label: "🔥 What's hot today?", prompt: "What's hot today? Show me trending tokens with volume and momentum." },
  { label: "🆕 Fresh pairs", prompt: "Show me fresh pairs launched in the last 24h with real liquidity." },
  { label: "🐕 Top BONK traders", prompt: "Who are the top BONK traders right now? Show wallet stats and PnL." },
  { label: "📋 My open orders", prompt: "Show my open orders and strategies — limits, copy trades, trailing stops, snipers." },
  { label: "📣 KOL coins", prompt: "Which coins are KOLs talking about on X right now?" },
  { label: "📈 Volume spikes", prompt: "Find tokens with unusual volume spikes in the last hour." },
  { label: "𝕏 My X analytics", prompt: "Show my X analytics: follower growth, post performance, and engagement." },
  { label: "💸 Stock token discounts", prompt: "Show me stock token discounts and premiums on Robinhood Chain." },
  { label: "👁 Watch SOL", prompt: "Add SOL to my watchlist and show me current price, liquidity, and trend." },
  { label: "🧼 Clean my dust", prompt: "Clean my dust: consolidate all dust balances under $1 into USDC and show me the plan." },
  { label: "🛡 Risk score my portfolio", prompt: "Risk score my portfolio: concentration, drawdown exposure, and suggested hedges." },
];

/* ── small helpers ─────────────────────────────────────────────── */

function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
}

function fmtPnl(n: number): string {
  const sign = n < 0 ? "-" : "+";
  return `${sign}$${Math.abs(Number(n)).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtRate(r: number): string {
  const pct = r <= 1 ? r * 100 : r;
  return `${Number(pct.toFixed(pct % 1 === 0 ? 0 : 1))}%`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** Strip markdown so speech synthesis reads plain sentences. */
function stripMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/^\|.*\|$/gm, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ── languages ─────────────────────────────────────────────────── */

const LANGS = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "zh", label: "ZH" },
  { code: "pt", label: "PT" },
  { code: "fr", label: "FR" },
];

function langLabel(code: string): string {
  return LANGS.find((l) => l.code === code)?.label || code.toUpperCase();
}

function validLang(code: string | null): string {
  return LANGS.some((l) => l.code === code) ? (code as string) : "en";
}

/* ── DexScreener chart links ───────────────────────────────────── */

const DEX_URL_RE = /https?:\/\/dexscreener\.com\/[a-z0-9-]+\/[a-z0-9-]+\/?[^\s)"']*/i;
const DEX_EMBED_RE = /^https?:\/\/dexscreener\.com\/([a-z0-9-]+)\/([a-z0-9-]+)/i;

/** First DexScreener token/pair URL in a block of text, or null. */
function firstDexUrl(text: string): string | null {
  const m = DEX_URL_RE.exec(text || "");
  if (!m) return null;
  return m[0].replace(/[.,;:!?]+$/, "");
}

/** DexScreener iframe embed URL derived from a pasted chart URL, or null. */
function dexEmbedUrl(url: string): string | null {
  const m = DEX_EMBED_RE.exec(url);
  if (!m) return null;
  return `https://dexscreener.com/${m[1]}/${m[2]}?embed=1&theme=dark`;
}

/* ── allocation pie ────────────────────────────────────────────── */

const ALLOCPIE_FENCE = /```allocpie[ \t]*\r?\n([\s\S]*?)```/;

function parseAllocPie(content: string): { entries: [string, number][]; rest: string } | null {
  const m = ALLOCPIE_FENCE.exec(content);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1].trim());
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const entries = (Object.entries(obj) as [string, unknown][])
      .map(([k, v]) => [String(k), Number(v)] as [string, number])
      .filter(([, v]) => Number.isFinite(v) && v > 0);
    if (!entries.length) return null;
    return {
      entries,
      rest: (content.slice(0, m.index) + content.slice(m.index + m[0].length)).trim(),
    };
  } catch {
    return null;
  }
}

/* ── exit presets ──────────────────────────────────────────────── */

interface ExitPreset {
  mint: string;
  name: string;
  targets: string;
}

function loadExitPresets(): ExitPreset[] {
  try {
    const v = JSON.parse(lsGet("hub-exit-presets") || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function presetApplyText(p: ExitPreset): string {
  return `Set take-profit exits for ${p.name} (${p.mint}): scale out at ${p.targets}. Show me the limit orders before placing them.`;
}

/* ── slash intents ─────────────────────────────────────────────── */

const SLASH_INTENTS = [
  { cmd: "chart", label: "Chart", desc: "15m chart for a token", fill: "Show me the 15m chart for " },
  { cmd: "scan", label: "Scan", desc: "Full safety dossier on a token", fill: "Give me a full dossier on this token (safety, liquidity, whales, X sentiment): " },
  { cmd: "alert", label: "Alert", desc: "Set a price alert", fill: "Set a price alert for " },
  { cmd: "brief", label: "Brief", desc: "Morning brief: PnL, movers, trending", fill: "Give me my morning brief: portfolio PnL, watchlist movers, and what's trending." },
  { cmd: "paper", label: "Paper trade", desc: "Risk-free practice trade", fill: "Let's paper trade — check my paper portfolio, then ask me what to buy." },
  { cmd: "launch", label: "Launch", desc: "Coin launch walkthrough", fill: "Walk me through launching a coin on OrbitX — what do you need from me?" },
];

/* ── Web Speech API typings (not in TS DOM lib) ────────────────── */

interface HubSpeechAlternative {
  transcript: string;
}
interface HubSpeechResultList {
  length: number;
  [index: number]: HubSpeechAlternative[];
}
interface HubSpeechRecognitionEvent {
  results: HubSpeechResultList;
}
interface HubSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: HubSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => HubSpeechRecognition;
    webkitSpeechRecognition?: new () => HubSpeechRecognition;
  }
}

/* ── win card ──────────────────────────────────────────────────── */

interface WinCardData {
  pnl_usd: number;
  win_rate: number;
  trades: number;
  best_trade: string;
  period: string;
}

const WINCARD_FENCE = /```wincard[ \t]*\r?\n([\s\S]*?)```/;

function parseWinCard(content: string): { data: WinCardData; rest: string } | null {
  const m = WINCARD_FENCE.exec(content);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1].trim());
    if (typeof data?.pnl_usd !== "number") return null;
    return {
      data: {
        pnl_usd: data.pnl_usd,
        win_rate: Number(data.win_rate ?? 0),
        trades: Number(data.trades ?? 0),
        best_trade: String(data.best_trade ?? "—"),
        period: String(data.period ?? ""),
      },
      rest: (content.slice(0, m.index) + content.slice(m.index + m[0].length)).trim(),
    };
  } catch {
    return null;
  }
}

/** Resolve an og-* CSS var (e.g. --og-cyan) to an hsl() color for canvas. */
function themeColor(varName: string, fallback: string): string {
  try {
    const cs = getComputedStyle(document.documentElement);
    let v = cs.getPropertyValue(varName).trim();
    const inner = /^var\((--[\w-]+)\)$/.exec(v);
    if (inner) v = cs.getPropertyValue(inner[1]).trim();
    return v ? `hsl(${v})` : fallback;
  } catch {
    return fallback;
  }
}

function alpha(hsl: string, a: number): string {
  const t = hsl.trim();
  if (t.startsWith("hsl(") && t.endsWith(")")) return t.slice(0, -1) + ` / ${a})`;
  return t;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawWinCard(canvas: HTMLCanvasElement, d: WinCardData) {
  const W = 720;
  const H = 400;
  const S = 2;
  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(S, S);
  const cyan = themeColor("--og-cyan", "hsl(190 95% 55%)");
  const lime = themeColor("--og-lime", "hsl(84 85% 55%)");

  // background
  ctx.fillStyle = "#04070f";
  ctx.fillRect(0, 0, W, H);
  const g1 = ctx.createRadialGradient(90, 20, 10, 90, 20, 320);
  g1.addColorStop(0, alpha(cyan, 0.22));
  g1.addColorStop(1, alpha(cyan, 0));
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(W - 80, H, 10, W - 80, H, 340);
  g2.addColorStop(0, alpha(lime, 0.16));
  g2.addColorStop(1, alpha(lime, 0));
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  const FONT = "Inter, system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "alphabetic";

  // wordmark
  ctx.font = `900 34px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("OrbitX", 44, 78);
  const wmW = ctx.measureText("OrbitX").width;
  ctx.fillStyle = cyan;
  ctx.beginPath();
  ctx.arc(44 + wmW + 14, 66, 5, 0, Math.PI * 2);
  ctx.fill();

  // WIN CARD pill, top right
  ctx.font = `700 14px ${FONT}`;
  const pill = "WIN CARD";
  const pillW = ctx.measureText(pill).width + 40;
  const px = W - 44 - pillW;
  const py = 48;
  ctx.fillStyle = alpha(lime, 0.14);
  ctx.strokeStyle = alpha(lime, 0.55);
  ctx.lineWidth = 1.5;
  rr(ctx, px, py, pillW, 32, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = lime;
  ctx.textAlign = "center";
  ctx.fillText(pill, px + pillW / 2, py + 21);
  ctx.textAlign = "left";

  // divider
  const div = ctx.createLinearGradient(44, 0, W - 44, 0);
  div.addColorStop(0, cyan);
  div.addColorStop(1, lime);
  ctx.fillStyle = div;
  ctx.fillRect(44, 104, W - 88, 2);

  // PnL
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText("TOTAL PnL", 44, 152);
  ctx.fillStyle = d.pnl_usd >= 0 ? lime : "#f87171";
  ctx.font = `900 78px ${FONT}`;
  ctx.fillText(fmtPnl(d.pnl_usd), 40, 234);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = `500 16px ${FONT}`;
  ctx.fillText(d.period || "", 44, 264);

  // stats row
  const stats = [
    { label: "WIN RATE", value: fmtRate(d.win_rate) },
    { label: "TRADES", value: String(d.trades) },
    { label: "BEST TRADE", value: truncate(d.best_trade, 24) },
  ];
  stats.forEach((s, i) => {
    const x = 44 + i * 236;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(s.label, x, 310);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(s.value, x, 340);
  });

  // footer
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.font = `500 13px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("orbitx.world", W - 44, H - 22);
  ctx.textAlign = "left";

  // bottom accent bar
  const bar = ctx.createLinearGradient(0, 0, W, 0);
  bar.addColorStop(0, cyan);
  bar.addColorStop(1, lime);
  ctx.fillStyle = bar;
  ctx.fillRect(0, H - 4, W, 4);
}

function WinCard({ data, onPost }: { data: WinCardData; onPost: (d: WinCardData) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) drawWinCard(canvasRef.current, data);
  }, [data]);

  const download = () => {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "orbitx-wincard.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="mt-3">
      <canvas ref={canvasRef} className="w-full rounded-xl border border-white/[0.08]" style={{ aspectRatio: "720 / 400" }} />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
        >
          <Download className="h-3.5 w-3.5" /> Download PNG
        </button>
        <button
          type="button"
          onClick={() => onPost(data)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-og-cyan/30 bg-og-cyan/10 px-3 py-1.5 text-xs font-bold text-og-cyan transition hover:bg-og-cyan/20"
        >
          <Share2 className="h-3.5 w-3.5" /> Post it
        </button>
      </div>
    </div>
  );
}

/* ── onboarding quest ──────────────────────────────────────────── */

type QuestAction = { type: "link"; label: string; to: string } | { type: "fill"; label: string; fill: string };
interface QuestItem {
  id: string;
  label: string;
  desc: string;
  action: QuestAction;
}

const QUEST_ITEMS: QuestItem[] = [
  {
    id: "paper",
    label: "Make your first paper trade",
    desc: "Risk-free practice with $1,000 in fake money.",
    action: { type: "fill", label: "Try it", fill: "I want to make a paper trade with $1000 fake money" },
  },
  {
    id: "scan",
    label: "Scan a token for rugs",
    desc: "Safety check any coin before you touch it.",
    action: { type: "fill", label: "Try it", fill: "Scan SOL and tell me if it's safe to buy" },
  },
  {
    id: "alert",
    label: "Set your first price alert",
    desc: "The hub watches the chart so you don't have to.",
    action: { type: "fill", label: "Try it", fill: "Alert me when SOL crosses $250" },
  },
];

function QuestCard({
  quest,
  onToggle,
  onSkip,
  onFill,
}: {
  quest: Record<string, boolean>;
  onToggle: (id: string) => void;
  onSkip: () => void;
  onFill: (text: string) => void;
}) {
  const done = QUEST_ITEMS.every((i) => quest[i.id]);
  if (done) {
    return (
      <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-og-lime/25 bg-og-lime/5 p-6 text-center">
        <div className="text-4xl">🎉</div>
        <div className="mt-2 text-lg font-black uppercase tracking-wide">You're set up 🎉</div>
        <p className="mt-1 text-xs text-white/50">
          Paper trading, token scans, and price alerts are off your list — go make the hub work for you.
        </p>
        <button
          type="button"
          onClick={onSkip}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-og-lime px-5 py-2 text-sm font-bold text-background transition hover:opacity-90"
        >
          Let's go
        </button>
      </div>
    );
  }
  return (
    <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-og-cyan/20 bg-white/[0.02] p-5 text-left backdrop-blur">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-og-cyan" />
        <div className="text-sm font-black uppercase tracking-wide">Setup quest</div>
        <div className="ml-auto text-[11px] text-white/35">
          {QUEST_ITEMS.filter((i) => quest[i.id]).length}/{QUEST_ITEMS.length}
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="text-[11px] font-semibold text-white/40 transition hover:text-white/70"
        >
          Skip for now
        </button>
      </div>
      <p className="mt-1 text-xs text-white/40">Three quick steps and you're trading like a pro.</p>
      <div className="mt-3 space-y-2">
        {QUEST_ITEMS.map((item) => {
          const act = item.action;
          return (
          <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <button
              type="button"
              onClick={() => onToggle(item.id)}
              aria-pressed={!!quest[item.id]}
              aria-label={item.label}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
                quest[item.id]
                  ? "border-og-lime/50 bg-og-lime/20 text-og-lime"
                  : "border-white/20 text-transparent hover:border-white/40",
              )}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className={cn("text-sm font-bold", quest[item.id] ? "text-white/40 line-through" : "text-white/90")}>
                {item.label}
              </div>
              <div className="text-[11px] text-white/40">{item.desc}</div>
            </div>
            {act.type === "link" ? (
              <Link
                to={act.to}
                className="shrink-0 rounded-lg border border-og-cyan/30 bg-og-cyan/10 px-3 py-1.5 text-xs font-bold text-og-cyan transition hover:bg-og-cyan/20"
              >
                {act.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => act.type === "fill" && onFill(act.fill)}
                className="shrink-0 rounded-lg border border-og-cyan/30 bg-og-cyan/10 px-3 py-1.5 text-xs font-bold text-og-cyan transition hover:bg-og-cyan/20"
              >
                {act.label}
              </button>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── existing building blocks ──────────────────────────────────── */

function shortModel(m?: string) {
  if (!m) return "AI Hub";
  const parts = String(m).split("/");
  return parts[parts.length - 1];
}

function StatusPill({ call }: { call: HubToolCall }) {
  if (call.gated)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-og-gold/10 px-2 py-0.5 text-[10px] font-semibold text-og-gold ring-1 ring-og-gold/30">
        awaiting approval
      </span>
    );
  if (call.declined)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/40 ring-1 ring-white/10">
        declined
      </span>
    );
  if (call.ok)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-og-lime/10 px-2 py-0.5 text-[10px] font-semibold text-og-lime ring-1 ring-og-lime/30">
        <Check className="h-3 w-3" /> ok
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold text-red-300 ring-1 ring-red-400/30">
      failed
    </span>
  );
}

function ToolCard({ call, onMirror }: { call: HubToolCall; onMirror?: (call: HubToolCall) => void }) {
  const [open, setOpen] = useState(false);
  const chartUrl = firstDexUrl(call.result_summary || "");
  const isTrade = /buy|sell|swap|trade|long|short/i.test(call.name);
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Wrench className="h-3.5 w-3.5 shrink-0 text-iris" />
        <span className="truncate font-mono text-xs text-white/85">{call.name}</span>
        <StatusPill call={call} />
        <ChevronDown className={cn("ml-auto h-3.5 w-3.5 shrink-0 text-white/30 transition-transform", open && "rotate-180")} />
      </button>
      {chartUrl && <div className="border-t border-white/[0.07] px-3 py-2.5"><ChartCard url={chartUrl} /></div>}
      {isTrade && onMirror && (
        <div className="border-t border-white/[0.07] px-3 py-2">
          <button
            type="button"
            onClick={() => onMirror(call)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-iris/40 bg-iris/10 px-2.5 py-1.5 text-[11px] font-bold text-iris transition hover:bg-iris/20"
          >
            <RotateCcw className="h-3 w-3" /> Mirror this trade
          </button>
        </div>
      )}
      {open && (
        <div className="space-y-2 border-t border-white/[0.07] px-3 py-2.5">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">arguments</div>
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed text-white/70">
              {call.args_summary || "{}"}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">result</div>
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed text-white/70">
              {call.result_summary || "—"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

const VERDICT_STYLE: Record<HubSafety["verdict"], string> = {
  safe: "bg-og-lime/10 text-og-lime ring-og-lime/30",
  caution: "bg-og-gold/10 text-og-gold ring-og-gold/30",
  danger: "bg-red-400/10 text-red-300 ring-red-400/30",
  unknown: "bg-white/5 text-white/40 ring-white/10",
};

/* ── Thinking trace: a tiny collapsible under the bubble showing what the
   assistant did — tools called (with timing) and its one-line plan.
   Collapsed by default so it stays out of the way. ── */
function ThinkingTrace({ thinking, streaming }: { thinking: HubThinking | null; streaming?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!thinking) return null;
  const tools = thinking.tools || [];
  const thoughts = thinking.thoughts || [];
  if (!tools.length && !thoughts.length) return null;
  const doneCount = tools.filter((t) => !t.running).length;
  const anyRunning = tools.some((t) => t.running);
  const ms = thinking.ms;
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-1 text-[11px] text-white/35 transition hover:text-white/65"
      >
        <Wrench className="h-3 w-3" />
        <span>
          {anyRunning || streaming ? "working" : "thought"}
          {tools.length > 0 && (
            <>
              {" "}· {doneCount}/{tools.length} {tools.length === 1 ? "tool" : "tools"}
            </>
          )}
          {ms != null && ms > 0 ? ` · ${(ms / 1000).toFixed(1)}s` : ""}
        </span>
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="mt-1 max-w-full space-y-1 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          {thoughts.map((t, i) => (
            <div key={`th-${i}`} className="flex items-start gap-1.5 text-[11px] italic leading-relaxed text-white/45">
              <Brain className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="min-w-0">{t}</span>
            </div>
          ))}
          {tools.map((t, i) => (
            <div
              key={`tl-${i}`}
              className="flex items-center gap-1.5 text-[11px]"
              title={t.args_summary || undefined}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  t.running ? "animate-pulse bg-iris" : t.ok === false ? "bg-red-400" : "bg-og-lime",
                )}
              />
              <span className="min-w-0 truncate font-mono text-white/55">{t.name}</span>
              {t.ms != null && <span className="shrink-0 text-white/25">{(t.ms / 1000).toFixed(1)}s</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Thinking trace for a message: live data for streamed turns, stored
 *  tool_calls for history. */
function thinkingFor(m: HubMessage): HubThinking | null {
  const t = m.thinking;
  if (t && (t.tools.length || t.thoughts.length)) return t;
  if (m.role === "assistant" && m.tool_calls?.length) {
    return {
      tools: m.tool_calls.map((c) => ({ name: c.name, args_summary: c.args_summary, ok: c.ok })),
      thoughts: [],
    };
  }
  return null;
}

function SafetyPanel({ s }: { s: HubSafety }) {
  return (
    <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/30 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1",
            VERDICT_STYLE[s.verdict] || VERDICT_STYLE.unknown,
          )}
        >
          <ShieldAlert className="h-3 w-3" />
          {String(s.verdict || "unknown").toUpperCase()}
        </span>
        {(s.flags || []).map((f) => (
          <span
            key={f}
            className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-white/55 ring-1 ring-white/10"
          >
            {f}
          </span>
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
          <div className="text-white/35">Liquidity</div>
          <div className="font-mono font-semibold text-white/85">{fmtUsd(s.liquidity_usd)}</div>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
          <div className="text-white/35">Top holder</div>
          <div className="font-mono font-semibold text-white/85">
            {s.top_holder_pct == null ? "—" : `${s.top_holder_pct}%`}
          </div>
        </div>
      </div>
      {s.summary && <p className="mt-2 text-[11px] leading-relaxed text-white/50">{s.summary}</p>}
    </div>
  );
}

/** Embedded DexScreener chart card (link-out fallback when the URL won't embed). */
function ChartCard({ url, className }: { url: string; className?: string }) {
  const embed = dexEmbedUrl(url);
  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/[0.07] bg-black/40", className)}>
      {embed ? (
        <iframe src={embed} title="DexScreener chart" className="h-[320px] w-full" loading="lazy" />
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block p-3 text-xs font-semibold text-og-cyan underline"
        >
          Open chart on DexScreener ↗
        </a>
      )}
    </div>
  );
}

/** Price quote attached to a gated buy: what you pay vs. what you get. */
function QuotePanel({ q }: { q: HubQuote }) {
  const out = q.out_amount == null ? "—" : Number(q.out_amount).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return (
    <div className="mt-3 rounded-xl border border-og-cyan/20 bg-og-cyan/5 p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-og-cyan/80">Quote</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="text-xs text-white/50">You pay</span>
        <span className="font-mono font-bold text-white">{q.amount_sol ?? "—"} SOL</span>
        <span className="text-white/35">→</span>
        <span className="text-xs text-white/50">≈</span>
        <span className="font-mono font-bold text-og-lime">{out}</span>
        <span className="text-xs text-white/50">tokens</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
          <div className="text-white/35">Price impact</div>
          <div className="font-mono font-semibold text-white/85">
            {q.price_impact_pct == null ? "—" : `${Number(q.price_impact_pct).toFixed(2)}%`}
          </div>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
          <div className="text-white/35">Fee</div>
          <div className="font-mono font-semibold text-white/85">{q.fee == null ? "—" : String(q.fee)}</div>
        </div>
      </div>
    </div>
  );
}

/** Numbered action list for a hub_bundle gated confirmation. */
function BundleList({ bundle }: { bundle: HubBundleAction[] }) {
  const oneLine = (a: unknown) => {
    if (!a || typeof a !== "object") return String(a ?? "—");
    return (Object.entries(a) as [string, unknown][])
      .map(([k, v]) => `${k}=${v !== null && typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join(", ");
  };
  return (
    <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/30 p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
        Bundle · {bundle.length} action{bundle.length === 1 ? "" : "s"}
      </div>
      <ol className="mt-2 space-y-1.5">
        {bundle.map((b, i) => (
          <li key={i} className="flex gap-2.5 text-[11px]">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-og-cyan/10 font-mono text-[10px] font-bold text-og-cyan">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="font-mono text-white/85">{b.tool_name}</div>
              <div className="truncate text-white/40" title={oneLine(b.args)}>
                {oneLine(b.args)}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const PIE_COLORS = ["#22d3ee", "#a3e635", "#fbbf24", "#a78bfa", "#f472b6", "#60a5fa", "#f87171", "#2dd4bf"];

/** Inline SVG donut chart from a ```allocpie {"LABEL": value}``` fence. */
function AllocPie({ entries }: { entries: [string, number][] }) {
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const R = 54;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="mt-3 flex items-center gap-4 rounded-xl border border-white/[0.07] bg-black/30 p-4">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90" role="img" aria-label="Allocation pie">
        {entries.map(([label, v], i) => {
          const frac = v / total;
          const len = Math.max(frac * C - 2, 0.5);
          const dashoffset = -acc * C;
          acc += frac;
          return (
            <circle
              key={label}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={PIE_COLORS[i % PIE_COLORS.length]}
              strokeWidth="18"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={dashoffset}
            />
          );
        })}
        <circle cx="70" cy="70" r={R - 15} fill="#04070f" />
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {entries.map(([label, v], i) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
            />
            <span className="truncate font-semibold text-white/85">{label}</span>
            <span className="ml-auto shrink-0 font-mono text-white/50">{((v / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingCard({ p, onConfirm, busy }: { p: HubPending; onConfirm: (id: string, ok: boolean) => void; busy: boolean }) {
  const args = p.args_summary || JSON.stringify(p.args || {}, null, 2);
  // Bundles arrive live on hub/chat; persisted hub_bundle rows store them under args.bundle.
  const bundle: HubBundleAction[] | null =
    p.bundle && p.bundle.length
      ? p.bundle
      : p.tool_name === "hub_bundle" &&
          p.args !== null &&
          typeof p.args === "object" &&
          Array.isArray((p.args as Record<string, unknown>).bundle)
        ? ((p.args as Record<string, unknown>).bundle as HubBundleAction[])
        : null;
  return (
    <div className="rounded-xl border border-og-gold/20 bg-og-gold/5 p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-og-gold">
        <ShieldAlert className="h-4 w-4" />
        Confirmation needed
      </div>
      <p className="mt-1 text-xs text-og-gold/70">
        This action moves money or publishes something. Nothing happens until you approve.
      </p>
      <div className="mt-2.5 rounded-lg bg-black/40 p-2.5">
        <div className="font-mono text-xs text-white/90">{p.tool_name}</div>
        <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] text-white/50">
          {args}
        </pre>
      </div>
      {p.safety && <SafetyPanel s={p.safety} />}
      {p.quote && <QuotePanel q={p.quote} />}
      {bundle && <BundleList bundle={bundle} />}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(p.id, true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-og-lime px-5 py-2 text-sm font-bold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(p.id, false)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-4 w-4" />
          Deny
        </button>
      </div>
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────── */


/* ════════════════════════════════════════════════════════════════
   AI Hub command deck
   ════════════════════════════════════════════════════════════════ */

export default function AiHub() {
  const { user } = useAuth();

  const [threads, setThreads] = useState<HubThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [pendings, setPendings] = useState<HubPending[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [model, setModel] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);
  const [mode, setMode] = useState<HubMode>(() =>
    lsGet("hub-mode:default") === "degen" ? "degen" : "analyst",
  );
  const [lang, setLang] = useState<string>(() => validLang(lsGet("hub-lang")));
  const [toast, setToast] = useState<string | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [cmdHi, setCmdHi] = useState(0);
  const [threadQuery, setThreadQuery] = useState("");
  const [pinned, setPinned] = useState<string[]>(() => {
    try {
      return JSON.parse(lsGet("hub-pinned") || "[]");
    } catch {
      return [];
    }
  });
  const [slashHi, setSlashHi] = useState(0);
  const [presets, setPresets] = useState<ExitPreset[]>(() => loadExitPresets());
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presetMint, setPresetMint] = useState("");
  const [presetName, setPresetName] = useState("");
  const [presetTargets, setPresetTargets] = useState("");
  const [exporting, setExporting] = useState(false);
  const [micSupported] = useState(
    () => typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  );
  const [speechSupported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);
  const [recording, setRecording] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [questDismissed, setQuestDismissed] = useState(() => lsGet("hub-quest-done") === "1");
  const [questOpen, setQuestOpen] = useState(() => lsGet("hub-quest-done") !== "1");
  const [quest, setQuest] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(lsGet("hub-quest") || "{}");
    } catch {
      return {};
    }
  });
  // ── hub v2 state ──
  const [stats, setStats] = useState<HubStats | null>(null);
  const [alerts, setAlerts] = useState<HubAlertItem[]>([]);
  const [alertsBusy, setAlertsBusy] = useState<string | null>(null);
  const [searchHits, setSearchHits] = useState<HubSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [awayInfo, setAwayInfo] = useState<{ threads: number; pendings: number } | null>(null);
  const [exportingMd, setExportingMd] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Why the in-flight stream was aborted: "stop" via the stop button vs
  // "switch" when changing threads (the old turn must not bleed over).
  const abortReasonRef = useRef<"stop" | "switch" | null>(null);
  // Assistant message id backing the current retry prompt — retry removes
  // exactly this message instead of blindly slicing the last one.
  const failedMsgIdRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const recRef = useRef<HubSpeechRecognition | null>(null);
  const modeRef = useRef<HubMode>(mode);
  const langRef = useRef<string>(lang);
  const activeIdRef = useRef<string | null>(null);
  const searchTimer = useRef<number | null>(null);
  const lastSeenMsg = useRef<number>(0);
  const insightsBuiltFor = useRef<string | null>(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const changeLang = useCallback((l: string) => {
    const v = validLang(l);
    setLang(v);
    langRef.current = v;
    lsSet("hub-lang", v);
  }, []);

  const cycleLang = useCallback(() => {
    const i = LANGS.findIndex((l) => l.code === langRef.current);
    changeLang(LANGS[(i + 1) % LANGS.length].code);
  }, [changeLang]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const togglePin = useCallback((id: string) => {
    setPinned((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      lsSet("hub-pinned", JSON.stringify(next));
      return next;
    });
  }, []);

  const exportCsv = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const csv = await hubExportTradesCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orbitx-trades-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showToast("Trades CSV downloaded");
    } catch (e: any) {
      showToast(e?.message || "Export failed — please try again");
    } finally {
      setExporting(false);
    }
  }, [exporting, showToast]);

  const exportMarkdown = useCallback(async () => {
    if (exportingMd || messages.length === 0) return;
    setExportingMd(true);
    try {
      const title = threads.find((t) => t.id === activeId)?.title || "OrbitX AI Hub thread";
      const lines = [`# ${title}`, `> Exported ${new Date().toLocaleString()} from OrbitX AI Hub`, ""];
      for (const m of messages) {
        lines.push(m.role === "user" ? "## You" : "## OrbitX");
        lines.push(m.content || "");
        if (m.tool_calls?.length) {
          lines.push("");
          for (const c of m.tool_calls) {
            lines.push(`- \`${c.name}\` ${c.ok ? "✓" : "✗"} — ${(c.result_summary || c.args_summary || "").slice(0, 300)}`);
          }
        }
        lines.push("");
      }
      const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orbitx-hub-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showToast("Thread exported as Markdown");
    } finally {
      setExportingMd(false);
    }
  }, [exportingMd, messages, threads, activeId, showToast]);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      const r = await hubListThreads();
      if (r?.ok) {
        setThreads(r.threads || []);
        setLoadError(null);
      } else if (r?.error) {
        setLoadError(r.error === "unauthorized" ? "Sign in to use the AI Hub." : `Couldn't load chats: ${r.error}`);
      }
    } catch {
      setLoadError("Couldn't reach the server. Check your connection and retry.");
    }
  }, []);

  /** Live deck data: portfolio stats + alert list. Best-effort, never blocks chat. */
  const refreshDeck = useCallback(async () => {
    try {
      const s = await hubStats().catch(() => null);
      if (s?.ok) setStats(s);
    } catch {
      /* offline — keep last */
    }
    try {
      const a = await hubAlertsList().catch(() => null);
      if (a?.ok) setAlerts(a.alerts || []);
    } catch {
      /* offline — keep last */
    }
  }, []);

  const buildInsights = useCallback(
    async (threadId: string) => {
      if (insightsBuiltFor.current === threadId) return;
      insightsBuiltFor.current = threadId;
      const list: Insight[] = [];
      try {
        const [s, a, p] = await Promise.all([
          hubStats().catch(() => null),
          hubAlertsList().catch(() => null),
          hubPendingList().catch(() => null),
        ]);
        const open = (a?.alerts || []).filter((x: HubAlertItem) => x.status === "open");
        if (open.length > 0) {
          list.push({
            id: "alerts",
            kind: "alerts",
            title: "Live alerts",
            body: `${open.length} alert${open.length > 1 ? "s" : ""} watching — ${open
              .slice(0, 2)
              .map((x: HubAlertItem) => x.symbol || `${x.mint.slice(0, 4)}…`)
              .join(", ")}${open.length > 2 ? "…" : ""}`,
            accent: "bg-gradient-to-r from-iris to-og-cyan",
          });
        }
        const pend = p?.pendings || [];
        if (pend.length > 0) {
          list.push({
            id: "pending",
            kind: "pending",
            title: "Needs your call",
            body: `${pend.length} confirmation${pend.length > 1 ? "s" : ""} waiting — ${truncate(
              pend[0].args_summary || pend[0].tool_name,
              64,
            )}`,
            accent: "bg-gradient-to-r from-og-gold to-og-lime",
          });
        }
        if (s?.ok && s.pnlUsd != null && s.pnlUsd !== 0) {
          const v = Number(s.pnlUsd);
          list.push({
            id: "pnl",
            kind: "pnl",
            title: "Strategy PnL",
            body: `${v >= 0 ? "+" : "−"}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })} all-time across your strategies`,
            accent: "bg-gradient-to-r from-og-lime to-og-cyan",
          });
        }
        const strat: Record<string, number> | null | undefined = s?.activeStrategies;
        const n = strat ? Object.values(strat).reduce<number>((t, v) => t + (Number(v) || 0), 0) : 0;
        if (n > 0) {
          list.push({
            id: "strategies",
            kind: "strategies",
            title: "Autopilot",
            body: `${n} live ${n === 1 ? "strategy" : "strategies"} running on the 5-minute tick`,
            accent: "bg-gradient-to-r from-og-cyan to-iris",
          });
        }
      } catch {
        /* best effort */
      }
      setInsights(list);
    },
    [],
  );

  const selectThread = useCallback(
    async (id: string | null) => {
      if (abortRef.current) {
        // Don't let the old thread's turn bleed into the new one — its pending
        // approvals would land in the wrong thread's list.
        abortReasonRef.current = "switch";
        abortRef.current.abort();
      }
      setActiveId(id);
      setSidebarOpen(false);
      setFailedPrompt(null);
      failedMsgIdRef.current = null;
      setInsights([]);
      if (!id) {
        setMessages([]);
        setPendings([]);
        return;
      }
      const stored = lsGet(`hub-mode:${id}`);
      setMode(stored === "analyst" || stored === "degen" ? stored : modeRef.current);
      setLoadingThread(true);
      try {
        const r = await hubGetThread(id);
        if (r?.ok) {
          const msgs = (r.messages || []).filter((m: HubMessage) => m.role !== "tool");
          setMessages(msgs);
          setPendings(r.pending || []);
          if (msgs.length > 0) lastSeenMsg.current = Math.max(...msgs.map((m: HubMessage) => m.id));
          scrollDown();
          void buildInsights(id);
        }
      } finally {
        setLoadingThread(false);
      }
    },
    [scrollDown, buildInsights],
  );

  useEffect(() => {
    loadThreads();
    hubModels().then((r) => r?.ok && setModel(shortModel(r.model)));
    void refreshDeck();
  }, [loadThreads, refreshDeck]);

  // Live deck refresh every 60s.
  useEffect(() => {
    const iv = setInterval(() => void refreshDeck(), 60000);
    return () => clearInterval(iv);
  }, [refreshDeck]);

  // While-you-were-away digest (once per mount).
  useEffect(() => {
    const last = lsGet("hub-last-visit");
    lsSet("hub-last-visit", new Date().toISOString());
    if (!last) return;
    (async () => {
      try {
        const [t, p] = await Promise.all([hubListThreads().catch(() => null), hubPendingList().catch(() => null)]);
        const updated = (t?.threads || []).filter(
          (th: HubThread) => th.updated_at > last && th.id !== activeIdRef.current,
        ).length;
        const pendN = (p?.pendings || []).length;
        if (updated > 0 || pendN > 0) setAwayInfo({ threads: updated, pendings: pendN });
      } catch {
        /* best effort */
      }
    })();
  }, []);

  // Alert-fill toast poll: every 25s, only when visible + idle.
  useEffect(() => {
    const iv = setInterval(async () => {
      if (document.hidden || sending) return;
      const id = activeIdRef.current;
      if (!id) return;
      try {
        const r = await hubGetThread(id);
        const msgs: HubMessage[] = (r?.messages || []).filter((m: HubMessage) => m.role === "assistant");
        if (msgs.length === 0) return;
        const fired = msgs.filter(
          (m) => m.id > lastSeenMsg.current && /🔔 Alert fired:/.test(m.content || ""),
        );
        lastSeenMsg.current = Math.max(lastSeenMsg.current, ...msgs.map((m) => m.id));
        if (fired.length > 0) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const extra = msgs.filter((m) => !ids.has(m.id));
            return extra.length > 0 ? [...prev, ...extra].sort((a, b) => a.id - b.id) : prev;
          });
          scrollDown();
          showToast(`🔔 ${fired.length} alert${fired.length > 1 ? "s" : ""} just fired — scroll up for details`);
          void refreshDeck();
        }
      } catch {
        /* silent poll */
      }
    }, 25000);
    return () => clearInterval(iv);
  }, [sending, showToast, scrollDown, refreshDeck]);

  useEffect(() => {
    if (sending) {
      const t0 = Date.now();
      timerRef.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setElapsed(0);
      abortRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sending]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(
    () => () => {
      try {
        recRef.current?.stop();
      } catch {
        /* already stopped */
      }
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* unsupported */
      }
    },
    [],
  );

  // Sidebar search also sweeps message bodies (debounced).
  useEffect(() => {
    const q = threadQuery.trim();
    if (q.length < 2) {
      setSearchHits(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(async () => {
      try {
        const r = await hubSearchMessages(q);
        if (r?.ok) setSearchHits(r.results || []);
      } catch {
        setSearchHits([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [threadQuery]);

  const pushAssistant = useCallback(
    (content: string, tool_calls: HubToolCall[] | null, id?: number, thinking?: HubThinking) => {
      setMessages((prev) => [
        ...prev,
        {
          id: id ?? Date.now(),
          role: "assistant",
          content,
          tool_calls,
          thinking,
          created_at: new Date().toISOString(),
        },
      ]);
    },
    [],
  );

  const applyChatResponse = useCallback(
    (r: any) => {
      if (r?.ok && r.thread_id) {
        setActiveId(r.thread_id);
        lsSet(`hub-mode:${r.thread_id}`, modeRef.current);
        loadThreads();
      }
      if (r?.reply !== undefined) {
        // Buffered turns carry the model's one-line plans too — keep them in the trace.
        const thoughts = Array.isArray(r.thoughts) ? r.thoughts.slice(-4) : [];
        pushAssistant(
          r.reply || "",
          r.tool_calls?.length ? r.tool_calls : null,
          undefined,
          thoughts.length || typeof r.ms === "number" ? { tools: [], thoughts, ms: r.ms } : undefined,
        );
      }
      if (r?.pending?.length) {
        setPendings((prev) => [
          ...prev.filter((p) => !r.pending.some((np: HubChatPending) => np.pending_id === p.id)),
          ...r.pending.map((p: HubChatPending) => ({
            id: p.pending_id,
            tool_name: p.tool,
            args: null,
            args_summary: p.args_summary,
            safety: p.safety ?? null,
            quote: p.quote ?? null,
            bundle: p.bundle ?? null,
            status: "pending",
            created_at: new Date().toISOString(),
          })),
        ]);
      }
    },
    [loadThreads, pushAssistant],
  );

  const send = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || sending || !user) return;
      setSending(true);
      setInput("");
      setFailedPrompt(null);
      failedMsgIdRef.current = null;
      abortReasonRef.current = null;
      setInsights([]);
      const userMsgId = Date.now();
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content: msg, tool_calls: null, created_at: new Date().toISOString() },
      ]);
      scrollDown();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      // Live placeholder: fills in as the stream arrives.
      const streamId = Date.now() + 1;
      const freshThinking = (): HubThinking => ({ tools: [], thoughts: [] });
      setMessages((prev) => [
        ...prev,
        {
          id: streamId,
          role: "assistant",
          content: "",
          tool_calls: null,
          created_at: new Date().toISOString(),
          streaming: true,
          thinking: freshThinking(),
        },
      ]);
      scrollDown();
      const dropPlaceholder = () => setMessages((prev) => prev.filter((m) => m.id !== streamId));
      const patchStream = (fn: (m: HubMessage) => HubMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === streamId ? fn(m) : m)));
      const patchThinking = (fn: (t: HubThinking) => HubThinking) =>
        patchStream((m) => ({ ...m, thinking: fn(m.thinking || freshThinking()) }));
      // Token batching: flush accumulated tokens ~8x/sec so markdown re-renders stay cheap.
      let tokenAcc = "";
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      const flushTokens = () => {
        flushTimer = null;
        const chunk = tokenAcc;
        tokenAcc = "";
        if (chunk) {
          patchStream((m) => ({ ...m, content: (m.content || "") + chunk }));
          scrollDown();
        }
      };
      const queueToken = (t: string) => {
        if (!t) return;
        tokenAcc += t;
        if (!flushTimer) flushTimer = setTimeout(flushTokens, 120);
      };
      const clearTokenQueue = () => {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        tokenAcc = "";
      };
      const applyPendings = (r: HubChatResponse) => {
        if (r?.pending?.length) {
          setPendings((prev) => [
            ...prev.filter((p) => !r.pending!.some((np: HubChatPending) => np.pending_id === p.id)),
            ...r.pending!.map((p: HubChatPending) => ({
              id: p.pending_id,
              tool_name: p.tool,
              args: null,
              args_summary: p.args_summary,
              safety: p.safety ?? null,
              quote: p.quote ?? null,
              bundle: p.bundle ?? null,
              status: "pending",
              created_at: new Date().toISOString(),
            })),
          ]);
        }
      };
      const finalizeStream = (r: HubChatResponse) => {
        // Flush first: tokens still sitting in the batch window belong to this turn.
        flushTokens();
        clearTokenQueue();
        patchStream((m) => ({
          ...m,
          content: r.reply !== undefined ? r.reply : m.content,
          streaming: false,
          tool_calls: r.tool_calls?.length ? r.tool_calls : null,
          thinking: {
            ...(m.thinking || freshThinking()),
            thoughts: [...(m.thinking?.thoughts || []), ...(r.thoughts || [])].slice(-4),
            ms: r.ms,
          },
        }));
        if (!r.ok) {
          setFailedPrompt(msg);
          failedMsgIdRef.current = streamId;
        }
        applyPendings(r);
      };
      // Classic buffered send (fallback when SSE is unavailable).
      const bufferedSend = async () => {
        try {
          const r = await hubChat(activeId, msg, { signal: ctrl.signal, mode: modeRef.current, lang: langRef.current });
          if (!r?.ok && !r?.reply) {
            const errId = Date.now() + 3;
            setFailedPrompt(msg);
            failedMsgIdRef.current = errId;
            pushAssistant(
              `Something went wrong (${r?.error || "unknown error"}). Your message is saved — hit retry to try again.`,
              null,
              errId,
            );
          } else {
            applyChatResponse(r);
          }
        } catch (e: any) {
          if (e?.name === "AbortError") {
            // Thread switch aborts quietly; the stop button explains itself.
            if (abortReasonRef.current !== "switch") {
              pushAssistant(
                "Stopped. The turn may still finish on the server — reopen this chat to see the result.",
                null,
              );
            }
          } else {
            const errId = Date.now() + 3;
            setFailedPrompt(msg);
            failedMsgIdRef.current = errId;
            pushAssistant("Network error — your message is saved. Hit retry to try again.", null, errId);
          }
        }
      };
      // True once the user has seen anything worth keeping (tokens, thoughts,
      // tool activity, status). Decides keep-partial vs buffered-retry on death.
      let hadVisible = false;
      // Backend-reported failure for this turn (the `error` SSE event). When set,
      // the turn already failed server-side — re-running it via the buffered
      // fallback would just burn a second turn, so we surface it honestly.
      let streamError: string | null = null;
      // Tools left "running" when a stream dies never get their result event —
      // mark them failed so the trace doesn't pulse forever on a dead turn.
      const markInterruptedTools = (m: HubMessage): HubMessage => ({
        ...m,
        streaming: false,
        thinking: {
          ...(m.thinking || freshThinking()),
          tools: (m.thinking?.tools || []).map((t) => (t.running ? { ...t, running: false, ok: false } : t)),
        },
      });
      try {
        const doneResult = await hubChatStream(
          activeId,
          msg,
          { signal: ctrl.signal, mode: modeRef.current, lang: langRef.current },
          (e: HubStreamEvent) => {
            switch (e.event) {
              case "token":
                hadVisible = true;
                queueToken(e.text || "");
                break;
              case "token_reset":
                clearTokenQueue();
                patchStream((m) => ({ ...m, content: "" }));
                break;
              case "error":
                // hubChat threw server-side; the stream ends here with no `done`.
                streamError = e.error || "hub_stream_failed";
                break;
              case "start":
              case "done":
                break;
              default:
                // status / thought / tool_call / tool_result / future events.
                // reduceHubThinking tolerates unknown shapes (no-op).
                hadVisible = true;
                patchThinking((t) => reduceHubThinking(t, e));
                break;
            }
          },
        );
        if (doneResult) {
          finalizeStream(doneResult);
        } else {
          // Stream ended with no result.
          throw new Error("stream_empty");
        }
      } catch (e: any) {
        clearTokenQueue();
        const switched = e?.name === "AbortError" && abortReasonRef.current === "switch";
        abortReasonRef.current = null;
        if (switched) {
          // Moved to another thread mid-turn — the placeholder left with the old thread.
          dropPlaceholder();
        } else if (e?.name === "AbortError") {
          dropPlaceholder();
          pushAssistant(
            "Stopped. The turn may still finish on the server — reopen this chat to see the result.",
            null,
          );
        } else if (streamError) {
          // Backend already failed this turn — keep any partial output, don't re-run it.
          flushTokens();
          patchStream(markInterruptedTools);
          const errId = Date.now() + 2;
          pushAssistant(
            `Something went wrong (${streamError}). Your message is saved — hit retry to try again.`,
            null,
            errId,
          );
          setFailedPrompt(msg);
          failedMsgIdRef.current = errId;
        } else if (!hadVisible) {
          // SSE unavailable — fall back to the classic buffered call.
          dropPlaceholder();
          await bufferedSend();
        } else {
          // Stream died mid-turn after showing content — keep what arrived.
          flushTokens();
          patchStream(markInterruptedTools);
          setFailedPrompt(msg);
          failedMsgIdRef.current = streamId;
        }
      } finally {
        setSending(false);
        scrollDown();
      }
    },
    [input, sending, user, activeId, scrollDown, applyChatResponse, pushAssistant],
  );

  const stop = useCallback(() => {
    abortReasonRef.current = "stop";
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    if (failedPrompt && !sending) {
      // Remove exactly the failed assistant message — alert polls may have
      // appended messages after it, so slice(0, -1) could eat the wrong one.
      const failedId = failedMsgIdRef.current;
      if (failedId != null) setMessages((prev) => prev.filter((m) => m.id !== failedId));
      send(failedPrompt);
    }
  }, [failedPrompt, sending, send]);

  const doConfirm = useCallback(
    async (pendingId: string, approved: boolean) => {
      setConfirmBusy(true);
      try {
        const r = await hubConfirm(pendingId, approved, { mode: modeRef.current, lang: langRef.current });
        setPendings((prev) => prev.filter((p) => p.id !== pendingId));
        if (r?.ok || r?.reply) applyChatResponse(r);
        else pushAssistant(`Confirmation ${r?.error || "failed"} — ${r?.message || "please try again."}`, null);
      } finally {
        setConfirmBusy(false);
        scrollDown();
      }
    },
    [applyChatResponse, pushAssistant, scrollDown],
  );

  const newChat = useCallback(async () => {
    if (!user) return;
    try {
      const r = await hubCreateThread("New chat");
      if (r?.ok) {
        setThreads((prev) => [r.thread, ...prev]);
        selectThread(r.thread.id);
      }
    } catch {
      selectThread(null);
    }
  }, [selectThread, user]);

  const delThread = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const r = await hubDeleteThread(id);
        if (r?.ok) {
          setThreads((prev) => prev.filter((t) => t.id !== id));
          if (activeId === id) selectThread(null);
        }
      } catch {
        /* thread stays; user can retry */
      }
    },
    [activeId, selectThread],
  );

  const changeMode = useCallback(
    (m: HubMode) => {
      setMode(m);
      modeRef.current = m;
      lsSet("hub-mode:default", m);
      if (activeId) lsSet(`hub-mode:${activeId}`, m);
    },
    [activeId],
  );

  const toggleRecording = useCallback(() => {
    if (recording) {
      try {
        recRef.current?.stop();
      } catch {
        /* already stopped */
      }
      setRecording(false);
      return;
    }
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    try {
      const rec = new Ctor();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        setInput(text);
      };
      rec.onerror = () => setRecording(false);
      rec.onend = () => setRecording(false);
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      /* mic unavailable */
    }
  }, [recording]);

  const toggleSpeak = useCallback(
    (id: number, text: string) => {
      if (!("speechSynthesis" in window)) return;
      if (speakingId === id) {
        window.speechSynthesis.cancel();
        setSpeakingId(null);
        return;
      }
      window.speechSynthesis.cancel();
      const plain = stripMarkdown(text).slice(0, 2000);
      if (!plain) return;
      try {
        const u = new SpeechSynthesisUtterance(plain);
        u.onend = () => setSpeakingId((cur) => (cur === id ? null : cur));
        u.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur));
        window.speechSynthesis.speak(u);
        setSpeakingId(id);
      } catch {
        /* speech unavailable */
      }
    },
    [speakingId],
  );

  const shareAsThread = useCallback(() => {
    send(
      "Turn your previous reply into an X thread draft: split it into numbered posts of 280 chars or less, show me the exact text of each, then prepare the first x_post tool call for my approval.",
    );
  }, [send]);

  const postWinCard = useCallback(
    (d: WinCardData) => {
      send(
        `Post this win summary to X as a text post (no image): ${fmtPnl(d.pnl_usd)} PnL ${d.period} — ${fmtRate(d.win_rate)} win rate over ${d.trades} trades, best trade ${d.best_trade}.`,
      );
    },
    [send],
  );

  const toggleQuestItem = useCallback((id: string) => {
    setQuest((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      lsSet("hub-quest", JSON.stringify(next));
      if (QUEST_ITEMS.every((i) => next[i.id])) {
        lsSet("hub-quest-done", "1");
        setQuestDismissed(true);
      }
      return next;
    });
  }, []);

  const skipQuest = useCallback(() => {
    lsSet("hub-quest-done", "1");
    setQuestDismissed(true);
    setQuestOpen(false);
  }, []);

  const fillQuestInput = useCallback((text: string) => {
    setInput(text);
    inputRef.current?.focus();
  }, []);

  const slashMatch = /^\/(\w{0,20})$/.exec(input);
  const slashItems = slashMatch
    ? SLASH_INTENTS.filter((s) => s.cmd.startsWith(slashMatch[1].toLowerCase()))
    : [];
  const pickSlash = useCallback((s: { fill: string }) => {
    setInput(s.fill);
    setSlashHi(0);
    inputRef.current?.focus();
  }, []);

  const savePreset = useCallback(() => {
    const mint = presetMint.trim();
    if (!mint) return;
    setPresets((prev) => {
      const next = [...prev, { mint, name: presetName.trim() || "Exit plan", targets: presetTargets.trim() || "2x, 5x, 10x" }];
      lsSet("hub-exit-presets", JSON.stringify(next));
      return next;
    });
    setPresetMint("");
    setPresetName("");
    setPresetTargets("");
  }, [presetMint, presetName, presetTargets]);

  const delPreset = useCallback((idx: number) => {
    setPresets((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      lsSet("hub-exit-presets", JSON.stringify(next));
      return next;
    });
  }, []);

  const applyPreset = useCallback((p: ExitPreset) => {
    setInput(presetApplyText(p));
    setPresetsOpen(false);
    inputRef.current?.focus();
  }, []);

  // ── hub v2 actions ──

  const muteAlert = useCallback(async (a: HubAlertItem) => {
    const toMuted = a.status !== "muted";
    setAlertsBusy(a.id);
    try {
      const r = await hubAlertMute(a.id, toMuted);
      if (r?.ok) {
        setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: toMuted ? "muted" : "open" } : x)));
        showToast(toMuted ? "Alert muted — the tick will skip it" : "Alert unmuted");
      }
    } finally {
      setAlertsBusy(null);
    }
  }, [showToast]);

  const deleteAlert = useCallback(
    async (id: string) => {
      setAlertsBusy(id);
      try {
        const r = await hubAlertDelete(id);
        if (r?.ok) {
          setAlerts((prev) => prev.filter((x) => x.id !== id));
          showToast("Alert deleted");
        }
      } finally {
        setAlertsBusy(null);
      }
    },
    [showToast],
  );

  const dismissInsight = useCallback((id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const startTemplate = useCallback(
    async (t: ThreadTemplate) => {
      if (!user || sending) return;
      try {
        const r = await hubCreateThread(t.title);
        if (!r?.ok) return;
        const id = r.thread.id as string;
        setThreads((prev) => [r.thread, ...prev]);
        setActiveId(id);
        setMessages([]);
        setPendings([]);
        setInsights([]);
        setFailedPrompt(null);
        setSidebarOpen(false);
        setSending(true);
        const userMsgId = Date.now();
        setMessages([
          { id: userMsgId, role: "user", content: t.prompt, tool_calls: null, created_at: new Date().toISOString() },
        ]);
        scrollDown();
        try {
          const cr = await hubChat(id, t.prompt, { mode: modeRef.current, lang: langRef.current });
          if (cr?.ok || cr?.reply) applyChatResponse(cr);
          else pushAssistant("Couldn't start that template — try sending a message.", null);
        } catch {
          pushAssistant("Network error starting the template.", null);
        } finally {
          setSending(false);
          scrollDown();
        }
      } catch {
        /* ignore */
      }
    },
    [user, sending, scrollDown, applyChatResponse, pushAssistant],
  );

  const mirrorTrade = useCallback(
    (call: HubToolCall) => {
      setInput(
        "Mirror the trade you just described above — same token and same size. Show me the full plan before anything is placed.",
      );
      inputRef.current?.focus();
      showToast("Composer filled — review and send to mirror the trade");
    },
    [showToast],
  );

  // Cmd+K / Ctrl+K command palette
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdQuery("");
        setCmdHi(0);
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (slashItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashHi((h) => (h + 1) % slashItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashHi((h) => (h - 1 + slashItems.length) % slashItems.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickSlash(slashItems[Math.min(slashHi, slashItems.length - 1)]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setInput("");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const modeButton = (m: HubMode, label: string, Icon: typeof Brain) => (
    <button
      key={m}
      type="button"
      onClick={() => changeMode(m)}
      aria-pressed={mode === m}
      title={m === "analyst" ? "Analyst: measured, data-driven answers" : "Degen: full-send energy"}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition",
        mode === m ? "bg-iris/15 text-iris ring-1 ring-iris/40" : "text-white/40 hover:text-white/70",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  // threads: title search filter, pinned sort first
  const tq = threadQuery.trim().toLowerCase();
  const sortedThreads = [...threads]
    .filter((t) => !tq || (t.title || "New chat").toLowerCase().includes(tq))
    .sort((a, b) => Number(pinned.includes(b.id)) - Number(pinned.includes(a.id)));

  // command palette actions
  const cq = cmdQuery.trim().toLowerCase();
  const paletteActions: { id: string; label: string; hint: string; icon: typeof Plus; run: () => void }[] = [
    { id: "new", label: "New thread", hint: "start a fresh chat", icon: Plus, run: () => newChat() },
    {
      id: "mode",
      label: `Toggle mode — currently ${mode}`,
      hint: "analyst / degen",
      icon: mode === "analyst" ? Brain : Flame,
      run: () => changeMode(mode === "analyst" ? "degen" : "analyst"),
    },
    {
      id: "lang",
      label: `Switch language — currently ${langLabel(lang)}`,
      hint: "cycle EN / ES / ZH / PT / FR",
      icon: Globe,
      run: () => cycleLang(),
    },
    { id: "export", label: "Export trades CSV", hint: "download history", icon: Download, run: () => exportCsv() },
    { id: "export-md", label: "Export thread as Markdown", hint: "current chat", icon: FileDown, run: () => exportMarkdown() },
    { id: "rail", label: "Toggle live rail", hint: "portfolio + alerts", icon: PanelRight, run: () => setRailOpen((o) => !o) },
    ...(micSupported
      ? [{ id: "voice", label: "Start voice dictation", hint: "speak your prompt", icon: Mic, run: () => toggleRecording() }]
      : []),
    ...THREAD_TEMPLATES.map((t) => ({
      id: `template:${t.id}`,
      label: `Template: ${t.title}`,
      hint: t.desc,
      icon: t.icon,
      run: () => startTemplate(t),
    })),
    ...threads.map((t) => ({
      id: `thread:${t.id}`,
      label: `Go to: ${t.title || "New chat"}`,
      hint: pinned.includes(t.id) ? "pinned thread" : "thread",
      icon: MessageSquare,
      run: () => selectThread(t.id),
    })),
  ];
  const cmdResults = paletteActions.filter((a) => !cq || a.label.toLowerCase().includes(cq));
  const cmdPick = (a: { run: () => void }) => {
    setCmdOpen(false);
    setCmdQuery("");
    a.run();
  };
  const cmdInputKeyDown = (e: React.KeyboardEvent) => {
    const n = Math.max(cmdResults.length, 1);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCmdHi((h) => (h + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCmdHi((h) => (h - 1 + n) % n);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const a = cmdResults[Math.min(cmdHi, cmdResults.length - 1)];
      if (a) cmdPick(a);
    } else if (e.key === "Escape") {
      setCmdOpen(false);
    }
  };

  const activeThread = threads.find((t) => t.id === activeId);
  const openAlerts = alerts.filter((a) => a.status === "open");
  const inputMentions = findTokenMentions(input).slice(0, 4);

  /* ── derived rail numbers ── */
  const stratTotal = stats?.activeStrategies
    ? Object.values(stats.activeStrategies).reduce((t, v) => t + (Number(v) || 0), 0)
    : 0;

  return (
    <AppLayout>
      <div className="relative flex h-[calc(100dvh-4rem)] overflow-hidden bg-[#05070e] text-white">
        {/* aurora wash */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-48 left-1/4 h-[28rem] w-[28rem] rounded-full bg-iris/[0.08] blur-[130px]" />
          <div className="absolute bottom-0 right-1/5 h-[22rem] w-[22rem] rounded-full bg-og-cyan/[0.06] blur-[130px]" />
          <div className="absolute left-1/2 top-1/3 h-[18rem] w-[30rem] -translate-x-1/2 rounded-full bg-iris/[0.04] blur-[110px]" />
        </div>

        {/* ═══ Mission sidebar ═══ */}
        <aside
          className={cn(
            "relative z-30 flex w-[19rem] shrink-0 flex-col border-r border-white/[0.07] bg-[#070b16]/90 backdrop-blur-xl transition-transform duration-300 md:static md:translate-x-0",
            sidebarOpen ? "fixed inset-y-0 left-0 translate-x-0" : "fixed inset-y-0 left-0 -translate-x-full",
          )}
        >
          <div className="flex items-center gap-3 border-b border-white/[0.07] p-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-iris/40 blur-lg" style={{ animation: "hub-glow-pulse 3s ease-in-out infinite" }} />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-iris/50 bg-gradient-to-br from-iris/30 to-og-cyan/20">
                <Sparkles className="h-5 w-5 text-iris" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black uppercase tracking-[0.22em]">AI Hub</div>
              <div className="text-[11px] text-white/40">Command deck</div>
            </div>
          </div>

          <div className="border-b border-white/[0.07] p-3">
            <button
              type="button"
              onClick={newChat}
              disabled={!user}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-iris to-og-cyan px-4 py-2.5 text-sm font-black uppercase tracking-[0.14em] text-[#0a0618] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> New thread
            </button>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
              <input
                value={threadQuery}
                onChange={(e) => setThreadQuery(e.target.value)}
                placeholder="Search chats & messages…"
                aria-label="Search chats and messages"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-white/25 focus:border-iris/50"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-iris" />}
            </div>
          </div>

          {/* templates */}
          <div className="border-b border-white/[0.07] p-3">
            <div className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/35">Launch from template</div>
            <div className="grid grid-cols-3 gap-1.5">
              {THREAD_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => startTemplate(t)}
                  disabled={!user || sending}
                  title={`${t.title} — ${t.desc}`}
                  className="group flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-1 py-2.5 transition hover:border-iris/40 hover:bg-iris/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <t.icon className="h-4 w-4 text-iris transition group-hover:scale-110" />
                  <span className="text-[10px] font-bold leading-tight text-white/70">{t.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* thread list */}
          <div className="flex-1 overflow-y-auto p-2">
            {searchHits && searchHits.length > 0 && (
              <div className="mb-2">
                <div className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.22em] text-iris/80">
                  In messages
                </div>
                {searchHits.slice(0, 5).map((h, i) => (
                  <button
                    key={`${h.thread_id}:${i}`}
                    type="button"
                    onClick={() => selectThread(h.thread_id)}
                    className="hub-rise block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/[0.04]"
                  >
                    <div className="truncate text-xs font-semibold text-white/85">{h.thread_title || "New chat"}</div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/40">{h.snippet}</div>
                  </button>
                ))}
              </div>
            )}
            {loadError && threads.length === 0 ? (
              <div className="px-2 py-6 text-center">
                <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-og-gold" />
                <p className="text-xs text-white/50">{loadError}</p>
                <button
                  type="button"
                  onClick={loadThreads}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            ) : (
              sortedThreads.map((t) => {
                const isPinned = pinned.includes(t.id);
                const isActive = activeId === t.id;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "group relative mb-1 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                      isActive
                        ? "border-iris/30 bg-gradient-to-r from-iris/[0.12] to-transparent text-white"
                        : "border-transparent text-white/60 hover:bg-white/[0.04] hover:text-white",
                    )}
                  >
                    {isActive && <div className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-gradient-to-b from-iris to-og-cyan" />}
                    {isPinned && <Pin className="h-3 w-3 shrink-0 fill-iris text-iris" />}
                    <button type="button" onClick={() => selectThread(t.id)} className="min-w-0 flex-1 truncate text-left">
                      {t.title || "New chat"}
                    </button>
                    <Pin
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(t.id);
                      }}
                      aria-label={isPinned ? "Unpin chat" : "Pin chat"}
                      className={cn(
                        "h-4 w-4 shrink-0 cursor-pointer transition hover:text-iris",
                        isPinned ? "text-iris opacity-100" : "text-white/30 opacity-0 group-hover:opacity-100",
                      )}
                    />
                    <Trash2
                      onClick={(e) => delThread(t.id, e)}
                      aria-label="Delete chat"
                      className="h-4 w-4 shrink-0 cursor-pointer text-white/30 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                    />
                  </div>
                );
              })
            )}
            {!loadError && threads.length === 0 && !searchHits && (
              <div className="px-3 py-6 text-center text-xs text-white/30">No chats yet — start one above.</div>
            )}
          </div>

          {model && (
            <div className="border-t border-white/[0.07] px-4 py-2.5 text-[11px] text-white/40">
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-og-lime" />
                <span className="font-mono text-white/60">{model}</span>
              </span>
            </div>
          )}
        </aside>
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ═══ Stage ═══ */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          {/* header */}
          <header className="flex items-center gap-2 border-b border-white/[0.07] bg-[#05070e]/60 px-3 py-2.5 backdrop-blur-xl sm:gap-3 sm:px-4">
            <button type="button" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 md:hidden" onClick={() => setSidebarOpen(true)} aria-label="Chats">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black uppercase tracking-[0.18em]">
                {activeThread?.title || "New thread"}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-white/35">
                <span className={cn("h-1.5 w-1.5 rounded-full", sending ? "animate-pulse bg-iris" : "bg-og-lime")} />
                {sending ? `Working${elapsed > 2 ? ` · ${elapsed}s` : "…"}` : stats ? `${stratTotal} strategies live` : "Ready"}
              </div>
            </div>
            {modeButton("analyst", "Analyst", Brain)}
            {modeButton("degen", "Degen", Flame)}
            <button
              type="button"
              onClick={cycleLang}
              title="Switch language"
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-white/40 transition hover:text-white/70"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{langLabel(lang)}</span>
            </button>
            <button
              type="button"
              onClick={() => setQuestOpen((o) => !o)}
              title="Setup quest"
              aria-pressed={questOpen}
              className={cn(
                "rounded-lg p-2 transition",
                questOpen ? "text-og-gold" : "text-white/35 hover:text-white/70",
              )}
            >
              <Target className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setRailOpen((o) => !o)}
              title="Live rail — portfolio & alerts"
              aria-pressed={railOpen}
              className={cn(
                "relative rounded-lg p-2 transition",
                railOpen ? "bg-iris/15 text-iris" : "text-white/35 hover:text-white/70",
              )}
            >
              {openAlerts.length > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              {openAlerts.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-iris px-1 text-[9px] font-black text-[#0a0618]">
                  {openAlerts.length}
                </span>
              )}
            </button>
            <div className="hidden items-center gap-1 sm:flex">
              <button
                type="button"
                onClick={exportMarkdown}
                disabled={exportingMd || messages.length === 0}
                title="Export thread as Markdown"
                className="rounded-lg p-2 text-white/35 transition hover:text-white/70 disabled:opacity-30"
              >
                {exportingMd ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={exporting}
                title="Export trades CSV"
                className="rounded-lg p-2 text-white/35 transition hover:text-white/70 disabled:opacity-30"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </button>
            </div>
          </header>

          {/* away digest banner */}
          {awayInfo && (
            <div className="hub-rise mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-iris/25 bg-iris/[0.07] px-4 py-2.5 backdrop-blur">
              <History className="h-4 w-4 shrink-0 text-iris" />
              <p className="flex-1 text-xs text-white/75">
                <span className="font-bold text-white">While you were away</span>
                {awayInfo.threads > 0 && ` — ${awayInfo.threads} thread${awayInfo.threads > 1 ? "s" : ""} updated`}
                {awayInfo.pendings > 0 && ` · ${awayInfo.pendings} confirmation${awayInfo.pendings > 1 ? "s" : ""} waiting`}
              </p>
              <button type="button" onClick={() => setAwayInfo(null)} aria-label="Dismiss" className="text-white/30 transition hover:text-white/70">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <InsightCards insights={insights} onDismiss={dismissInsight} />

          {/* messages */}
          <div className="flex-1 overflow-y-auto px-4 py-5 lg:px-6">
            <div key={activeId ?? "none"} className="hub-fade mx-auto flex max-w-3xl flex-col gap-4">
              {loadingThread ? (
                <ThreadSkeleton />
              ) : (
                <>
                  {messages.length === 0 && (
                    <div className="pt-4 text-center sm:pt-8">
                      <div className="relative mx-auto mb-6 h-20 w-20">
                        <div className="absolute inset-0 rounded-[1.75rem] bg-iris/30 blur-2xl" style={{ animation: "hub-glow-pulse 3s ease-in-out infinite" }} />
                        <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-iris/40 bg-gradient-to-br from-iris/25 to-og-cyan/15">
                          <Sparkles className="h-9 w-9 text-iris" />
                        </div>
                      </div>
                      <h2 className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-2xl font-black uppercase tracking-[0.12em] text-transparent sm:text-3xl">
                        Command deck online
                      </h2>
                      <p className="mx-auto mt-2 max-w-md text-sm text-white/40">
                        Scan tokens, run strategies, trade, launch coins — your whole operation in one chat.
                      </p>
                      <div className="mx-auto mt-6 grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-3">
                        {THREAD_TEMPLATES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => startTemplate(t)}
                            disabled={!user || sending}
                            className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-left backdrop-blur transition hover:border-iris/40 hover:bg-iris/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <t.icon className="h-5 w-5 text-iris transition group-hover:scale-110" />
                            <div className="mt-2 text-sm font-bold text-white/90">{t.title}</div>
                            <div className="mt-0.5 text-[11px] leading-snug text-white/40">{t.desc}</div>
                          </button>
                        ))}
                      </div>
                      <div className="mx-auto mt-4 grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                        {QUICK_PROMPTS.slice(0, 6).map((q) => (
                          <button
                            key={q.label}
                            type="button"
                            onClick={() => send(q.prompt)}
                            disabled={!user || sending}
                            className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-left transition hover:border-og-cyan/30 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <div className="text-[13px] font-semibold text-white/85">{q.label}</div>
                            <div className="mt-0.5 truncate text-[11px] text-white/35">{q.prompt}</div>
                          </button>
                        ))}
                      </div>
                      <p className="mt-5 text-[11px] text-white/25">
                        Press <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono">⌘K</kbd> for commands
                        {micSupported && " · tap the mic to dictate"}
                      </p>
                      {questOpen && !questDismissed && (
                        <QuestCard
                          quest={quest}
                          onToggle={toggleQuestItem}
                          onSkip={skipQuest}
                          onFill={fillQuestInput}
                        />
                      )}
                    </div>
                  )}

                  {messages.map((m) => {
                    const wc = m.role === "assistant" ? parseWinCard(m.content || "") : null;
                    const pie = m.role === "assistant" ? parseAllocPie(wc ? wc.rest : m.content || "") : null;
                    const body = pie ? pie.rest : wc ? wc.rest : m.content;
                    const dexUrl = m.role === "assistant" ? firstDexUrl(body || "") : null;
                    const isAlert = m.role === "assistant" && /🔔 Alert fired:/.test(m.content || "");
                    const bubble = (
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                          m.role === "assistant"
                            ? cn(
                                "border bg-white/[0.03] text-white/85 backdrop-blur",
                                isAlert ? "border-iris/40 shadow-[0_0_24px_-8px_rgba(167,139,250,0.4)]" : "border-white/[0.06]",
                              )
                            : "border border-iris/25 bg-gradient-to-br from-iris/[0.16] to-iris/[0.06] text-white",
                        )}
                      >
                        {m.role === "assistant" ? (
                          <div className="prose prose-invert prose-sm max-w-none [&_p]:my-2 [&_ul]:my-2">
                            {m.streaming && !body?.trim() ? (
                              <span className="inline-flex items-center gap-2 text-white/40">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-iris" />
                                {m.thinking?.status || "Thinking…"}
                              </span>
                            ) : (
                              <>
                                <Markdown text={body || ""} />
                                {m.streaming && <span className="ml-0.5 inline-block h-4 w-[7px] animate-pulse rounded-[2px] bg-iris/80 align-[-2px]" />}
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap">{m.content}</div>
                        )}
                      </div>
                    );
                    return (
                      <div key={m.id} className={cn("hub-rise flex gap-3", m.role === "user" && "flex-row-reverse")}>
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
                            m.role === "assistant"
                              ? "border-iris/30 bg-iris/10 text-iris"
                              : "border-white/15 bg-white/[0.06] text-white/70",
                          )}
                        >
                          {m.role === "assistant" ? <Sparkles className="h-4 w-4" /> : <span className="text-[11px] font-black">YOU</span>}
                        </div>
                        <div className="min-w-0 max-w-[88%] flex-1 sm:max-w-[85%]">
                          {m.role === "assistant" && <MentionChips text={m.content || ""} />}
                          {dexUrl && <ChartCard url={dexUrl} className="mb-3" />}
                          {wc ? (body && body.trim() ? bubble : null) : bubble}
                          {pie && <AllocPie entries={pie.entries} />}
                          {wc && <WinCard data={wc.data} onPost={postWinCard} />}
                          {m.role === "assistant" && (m.tool_calls?.length ? (
                            <div className="mt-2 space-y-2">
                              {m.tool_calls.map((c, i) => (
                                <ToolCard key={i} call={c} onMirror={mirrorTrade} />
                              ))}
                            </div>
                          ) : null)}
                          {m.role === "assistant" && (
                            <ThinkingTrace thinking={thinkingFor(m)} streaming={m.streaming} />
                          )}
                          {m.role === "assistant" && (
                            <div className="mt-1.5 flex items-center gap-1">
                              {speechSupported && (
                                <button
                                  type="button"
                                  onClick={() => toggleSpeak(m.id, m.content || "")}
                                  title={speakingId === m.id ? "Stop reading" : "Read aloud"}
                                  className={cn(
                                    "rounded-lg p-1.5 text-white/35 transition hover:bg-white/10 hover:text-white/80",
                                    speakingId === m.id && "text-iris",
                                  )}
                                >
                                  {speakingId === m.id ? (
                                    <VolumeX className="h-3.5 w-3.5" />
                                  ) : (
                                    <Volume2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={shareAsThread}
                                title="Draft as X thread"
                                className="rounded-lg p-1.5 text-white/35 transition hover:bg-white/10 hover:text-white/80"
                              >
                                <Share2 className="h-3.5 w-3.5" />
                              </button>
                              {failedPrompt && m.id === messages[messages.length - 1]?.id && (
                                <button
                                  type="button"
                                  onClick={retry}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {pendings.map((p) => (
                    <div key={p.id} className="hub-rise">
                      <PendingCard p={p} onConfirm={doConfirm} busy={confirmBusy} />
                    </div>
                  ))}

                  {sending && (
                    <div className="hub-rise flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-iris/30 bg-iris/10 text-iris">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm text-white/50">
                        Thinking{elapsed > 2 ? <span className="font-mono text-xs"> · {elapsed}s</span> : "…"}
                        <button type="button" onClick={stop} title="Stop" className="ml-1 rounded-lg p-1 text-white/40 transition hover:bg-white/10 hover:text-white">
                          <Square className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* composer */}
          <div className="relative border-t border-white/[0.07] bg-[#05070e]/60 px-4 py-3 backdrop-blur-xl lg:px-6">
            {!user ? (
              <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-og-gold/20 bg-og-gold/5 px-4 py-2.5 text-[12px] text-og-gold/90">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Sign in to chat with the AI Hub.
              </div>
            ) : (
              <div className="mx-auto max-w-3xl">
                {inputMentions.length > 0 && (
                  <div className="hub-rise mb-2 flex flex-wrap gap-1.5">
                    {inputMentions.map((m, i) => (
                      <TokenChip key={`${m.kind}:${m.value}:${i}`} mint={m.kind === "mint" ? m.value : undefined} symbol={m.kind === "symbol" ? m.value : undefined} />
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPresetsOpen((o) => !o)}
                    disabled={sending}
                    title="Exit presets — save & apply take-profit plans"
                    aria-pressed={presetsOpen}
                    className={cn(
                      "flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border transition disabled:cursor-not-allowed disabled:opacity-40",
                      presetsOpen
                        ? "border-iris/50 bg-iris/15 text-iris"
                        : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]",
                    )}
                  >
                    <Target className="h-5 w-5" />
                  </button>
                  {micSupported && (
                    <button
                      type="button"
                      onClick={toggleRecording}
                      disabled={sending}
                      title={recording ? "Stop dictation" : "Voice input"}
                      className={cn(
                        "flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border transition disabled:cursor-not-allowed disabled:opacity-40",
                        recording
                          ? "animate-pulse border-red-400/50 bg-red-400/15 text-red-300"
                          : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]",
                      )}
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                  )}
                  <div className="relative min-w-0 flex-1">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        setSlashHi(0);
                      }}
                      onKeyDown={onKeyDown}
                      rows={1}
                      placeholder={recording ? "Listening…" : "Ask about a token, wallet, or strategy…  ( / for quick intents )"}
                      disabled={sending}
                      className="max-h-40 min-h-[46px] w-full resize-none rounded-2xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-iris/50 focus:shadow-[0_0_24px_-8px_rgba(167,139,250,0.5)] disabled:opacity-60"
                    />
                    {slashItems.length > 0 && (
                      <div className="absolute bottom-full left-0 z-40 mb-2 w-72 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a101d] shadow-2xl">
                        {slashItems.map((s, i) => (
                          <button
                            key={s.cmd}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              pickSlash(s);
                            }}
                            onMouseEnter={() => setSlashHi(i)}
                            className={cn(
                              "flex w-full items-center gap-2.5 px-3 py-2 text-left",
                              i === slashHi ? "bg-iris/10" : "",
                            )}
                          >
                            <span className="rounded-md bg-iris/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-iris">
                              /{s.cmd}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold text-white/85">{s.label}</span>
                              <span className="block truncate text-[11px] text-white/35">{s.desc}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => (sending ? stop() : send())}
                    disabled={!sending && (!input.trim() || !user)}
                    title={sending ? "Stop" : "Send"}
                    className={cn(
                      "flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
                      sending
                        ? "border border-red-400/40 bg-red-400/15 text-red-300"
                        : "bg-gradient-to-br from-iris to-og-cyan text-[#0a0618] shadow-[0_0_20px_-6px_rgba(167,139,250,0.7)] hover:brightness-110",
                    )}
                  >
                    {sending ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                {/* presets drawer */}
                {presetsOpen && (
                  <div className="hub-rise mt-2 rounded-2xl border border-white/[0.08] bg-[#0a101d]/95 p-3 backdrop-blur">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Exit presets</div>
                      <button type="button" onClick={() => setPresetsOpen(false)} className="text-white/30 hover:text-white/70">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {presets.length > 0 && (
                      <div className="mb-2 space-y-1.5">
                        {presets.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-bold text-white/85">{p.name}</div>
                              <div className="truncate font-mono text-[10px] text-white/35">{p.targets}</div>
                            </div>
                            <button type="button" onClick={() => applyPreset(p)} className="rounded-lg bg-iris/15 px-2.5 py-1 text-[11px] font-bold text-iris transition hover:bg-iris/25">
                              Apply
                            </button>
                            <button type="button" onClick={() => delPreset(i)} aria-label="Delete preset" className="text-white/30 hover:text-red-400">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      <input value={presetMint} onChange={(e) => setPresetMint(e.target.value)} placeholder="Mint" className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] outline-none placeholder:text-white/25 focus:border-iris/50" />
                      <input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Name" className="w-24 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] outline-none placeholder:text-white/25 focus:border-iris/50" />
                      <input value={presetTargets} onChange={(e) => setPresetTargets(e.target.value)} placeholder="2x, 5x, 10x" className="w-28 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] outline-none placeholder:text-white/25 focus:border-iris/50" />
                      <button type="button" onClick={savePreset} disabled={!presetMint.trim()} className="rounded-lg bg-iris px-3 py-1.5 text-[11px] font-black text-[#0a0618] transition hover:brightness-110 disabled:opacity-40">
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* ═══ Live rail ═══ */}
        <aside
          className={cn(
            "z-30 flex w-[20rem] shrink-0 flex-col gap-3 overflow-y-auto border-l border-white/[0.07] bg-[#070b16]/90 p-3 backdrop-blur-xl transition-transform duration-300",
            "fixed inset-y-0 right-0 xl:static",
            railOpen ? "translate-x-0" : "translate-x-full xl:translate-x-0",
          )}
        >
          {/* portfolio */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                <Wallet className="h-3.5 w-3.5 text-iris" /> Portfolio
              </div>
              <button type="button" onClick={() => void refreshDeck()} title="Refresh" className="rounded-lg p-1 text-white/30 transition hover:text-white/70">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
            {stats ? (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">Total value</div>
                  <div className="font-mono text-2xl font-black tabular-nums">
                    {stats.portfolioUsd != null ? fmtUsd(stats.portfolioUsd) : <span className="text-white/30">—</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">Total PnL</div>
                    <div className={cn("flex items-center gap-1 font-mono text-lg font-black tabular-nums", (stats.pnlUsd ?? 0) >= 0 ? "text-og-lime" : "text-red-400")}>
                      {(stats.pnlUsd ?? 0) >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {stats.pnlUsd != null ? `${stats.pnlUsd >= 0 ? "+" : "−"}$${Math.abs(stats.pnlUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">Strategies</div>
                    <div className="font-mono text-lg font-black tabular-nums text-iris">{stratTotal}</div>
                  </div>
                </div>
                {!stats.wallet && (
                  <p className="rounded-xl border border-og-gold/20 bg-og-gold/5 px-3 py-2 text-[11px] text-og-gold/90">
                    No app wallet yet — ask the agent to create one.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-2" aria-hidden>
                <div className="h-7 w-2/3 animate-pulse rounded-lg bg-white/[0.06]" />
                <div className="h-5 w-1/2 animate-pulse rounded-lg bg-white/[0.04]" />
              </div>
            )}
          </section>

          {/* alerts */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                <BellRing className="h-3.5 w-3.5 text-iris" /> Price alerts
              </div>
              <span className="rounded-full bg-iris/15 px-2 py-0.5 font-mono text-[10px] font-bold text-iris">{openAlerts.length} live</span>
            </div>
            <div className="mt-3 space-y-2">
              {alerts.length === 0 && (
                <p className="text-[11px] leading-relaxed text-white/35">
                  No alerts yet. Ask the agent — <span className="text-white/60">“alert me when SOL breaks $200”</span> — and they fire right into your chat.
                </p>
              )}
              {alerts.map((a) => {
                const muted = a.status === "muted";
                const busy = alertsBusy === a.id;
                return (
                  <div key={a.id} className={cn("hub-rise rounded-xl border p-2.5", muted ? "border-white/[0.05] bg-white/[0.01] opacity-60" : "border-iris/20 bg-iris/[0.05]")}>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-white/90">
                          {a.symbol || `${a.mint.slice(0, 4)}…${a.mint.slice(-4)}`}
                          <span className="ml-1.5 font-mono font-normal text-white/40">{a.condition || a.type}</span>
                        </div>
                        {a.actionDesc && <div className="truncate text-[10px] text-white/40">{a.actionDesc}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => muteAlert(a)}
                        disabled={busy}
                        title={muted ? "Unmute" : "Mute"}
                        className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : muted ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAlert(a.id)}
                        disabled={busy}
                        title="Delete alert"
                        className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-red-400 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* activity */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
              <Activity className="h-3.5 w-3.5 text-og-cyan" /> Activity
            </div>
            <div className="mt-3 space-y-2 text-[11px]">
              <div className="flex items-center justify-between rounded-xl bg-white/[0.02] px-3 py-2">
                <span className="flex items-center gap-1.5 text-white/55"><Clock className="h-3 w-3" /> Confirmations waiting</span>
                <span className="font-mono font-bold text-white/85">{pendings.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/[0.02] px-3 py-2">
                <span className="flex items-center gap-1.5 text-white/55"><Layers className="h-3 w-3" /> Open threads</span>
                <span className="font-mono font-bold text-white/85">{threads.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/[0.02] px-3 py-2">
                <span className="flex items-center gap-1.5 text-white/55"><Zap className="h-3 w-3" /> Mind model</span>
                <span className="truncate pl-2 font-mono text-white/85">{model || "—"}</span>
              </div>
            </div>
          </section>
        </aside>
        {railOpen && (
          <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm xl:hidden" onClick={() => setRailOpen(false)} />
        )}

        {/* ═══ overlays ═══ */}
        {cmdOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setCmdOpen(false)}>
            <div className="hub-rise w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a101d] shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
                <Search className="h-4 w-4 text-iris" />
                <input
                  autoFocus
                  value={cmdQuery}
                  onChange={(e) => {
                    setCmdQuery(e.target.value);
                    setCmdHi(0);
                  }}
                  onKeyDown={cmdInputKeyDown}
                  placeholder="Type a command or search threads…"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                />
                <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/40">esc</kbd>
              </div>
              <div className="max-h-[50vh] overflow-y-auto p-2">
                {cmdResults.slice(0, 14).map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      cmdPick(a);
                    }}
                    onMouseEnter={() => setCmdHi(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                      i === cmdHi ? "bg-iris/10" : "",
                    )}
                  >
                    <a.icon className="h-4 w-4 shrink-0 text-iris" />
                    <span className="min-w-0 flex-1 truncate text-sm text-white/85">{a.label}</span>
                    <span className="text-[11px] text-white/30">{a.hint}</span>
                  </button>
                ))}
                {cmdResults.length === 0 && (
                  <div className="px-3 py-6 text-center text-xs text-white/30">No matches.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="hub-rise fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-2xl border border-iris/30 bg-[#0d1424]/95 px-4 py-2.5 text-sm text-white/90 shadow-2xl backdrop-blur">
              <Sparkles className="h-4 w-4 shrink-0 text-iris" />
              {toast}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
