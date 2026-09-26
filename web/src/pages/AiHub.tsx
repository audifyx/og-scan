/* OrbitX AI Hub — ChatGPT-style chat driving the full OrbitX MCP.
   /ai-hub — authed via the site's Supabase session (same account, all routes).
   Native OrbitX design language: og-cyan/og-lime/og-gold tokens, AlphaChat
   message patterns, AgentPlus header/section conventions. */
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
  Bot,
  User as UserIcon,
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
  hubConfirm,
  hubModels,
  hubExportTradesCsv,
  type HubThread,
  type HubMessage,
  type HubToolCall,
  type HubPending,
  type HubSafety,
  type HubQuote,
  type HubBundleAction,
  type HubChatPending,
  type HubMode,
} from "@/components/hub/api";

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

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
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
        {QUEST_ITEMS.map((item) => (
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
            {item.action.type === "link" ? (
              <Link
                to={item.action.to}
                className="shrink-0 rounded-lg border border-og-cyan/30 bg-og-cyan/10 px-3 py-1.5 text-xs font-bold text-og-cyan transition hover:bg-og-cyan/20"
              >
                {item.action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onFill(item.action.fill)}
                className="shrink-0 rounded-lg border border-og-cyan/30 bg-og-cyan/10 px-3 py-1.5 text-xs font-bold text-og-cyan transition hover:bg-og-cyan/20"
              >
                {item.action.label}
              </button>
            )}
          </div>
        ))}
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

function ToolCard({ call }: { call: HubToolCall }) {
  const [open, setOpen] = useState(false);
  const chartUrl = firstDexUrl(call.result_summary || "");
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Wrench className="h-3.5 w-3.5 shrink-0 text-og-cyan" />
        <span className="truncate font-mono text-xs text-white/85">{call.name}</span>
        <StatusPill call={call} />
        <ChevronDown className={cn("ml-auto h-3.5 w-3.5 shrink-0 text-white/30 transition-transform", open && "rotate-180")} />
      </button>
      {chartUrl && <div className="border-t border-white/[0.07] px-3 py-2.5"><ChartCard url={chartUrl} /></div>}
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
  // 1. mode picker — persisted per thread in localStorage `hub-mode:<threadId>`
  const [mode, setMode] = useState<HubMode>("analyst");
  const modeRef = useRef<HubMode>("analyst");
  // 7. language — localStorage `hub-lang`, sent on chat + confirm
  const [lang, setLang] = useState<string>(() => validLang(lsGet("hub-lang")));
  const langRef = useRef<string>(lang);
  // toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // command palette (Cmd+K / Ctrl+K)
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [cmdHi, setCmdHi] = useState(0);
  // thread search + pins
  const [threadQuery, setThreadQuery] = useState("");
  const [pinned, setPinned] = useState<string[]>(() => {
    try {
      const v = JSON.parse(lsGet("hub-pinned") || "[]");
      return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  });
  // slash menu highlight
  const [slashHi, setSlashHi] = useState(0);
  // exit presets
  const [presets, setPresets] = useState<ExitPreset[]>(loadExitPresets);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presetMint, setPresetMint] = useState("");
  const [presetName, setPresetName] = useState("");
  const [presetTargets, setPresetTargets] = useState("");
  // trades CSV export
  const [exporting, setExporting] = useState(false);
  // 3. voice mode
  const [micSupported] = useState(
    () => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  );
  const [speechSupported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);
  const [recording, setRecording] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const recRef = useRef<HubSpeechRecognition | null>(null);
  // 5. onboarding quest
  const [questDismissed, setQuestDismissed] = useState(() => !!lsGet("hub-quest-done"));
  const [questOpen, setQuestOpen] = useState(() => !lsGet("hub-quest-done"));
  const [quest, setQuest] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(lsGet("hub-quest") || "{}") || {};
    } catch {
      return {};
    }
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

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
    toastTimer.current = setTimeout(() => setToast(null), 4000);
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

  const selectThread = useCallback(async (id: string | null) => {
    setActiveId(id);
    setSidebarOpen(false);
    setFailedPrompt(null);
    if (!id) {
      setMessages([]);
      setPendings([]);
      return;
    }
    // Load this thread's stored mode; keep the current one if nothing stored.
    const stored = lsGet(`hub-mode:${id}`);
    setMode(stored === "analyst" || stored === "degen" ? stored : modeRef.current);
    setLoadingThread(true);
    try {
      const r = await hubGetThread(id);
      if (r?.ok) {
        setMessages((r.messages || []).filter((m: HubMessage) => m.role !== "tool"));
        setPendings(r.pending || []);
        scrollDown();
      }
    } finally {
      setLoadingThread(false);
    }
  }, [scrollDown]);

  useEffect(() => {
    loadThreads();
    hubModels().then((r) => r?.ok && setModel(shortModel(r.model)));
  }, [loadThreads]);

  useEffect(() => {
    if (sending) {
      const t0 = Date.now();
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
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

  // Abort an in-flight turn if the page unmounts mid-send.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Stop dictation/speech if the page unmounts.
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

  const pushAssistant = useCallback((content: string, tool_calls: HubToolCall[] | null, id?: number) => {
    setMessages((prev) => [
      ...prev,
      { id: id ?? Date.now(), role: "assistant", content, tool_calls, created_at: new Date().toISOString() },
    ]);
  }, []);

  const applyChatResponse = useCallback((r: any) => {
    if (r?.ok && r.thread_id) {
      setActiveId(r.thread_id);
      lsSet(`hub-mode:${r.thread_id}`, modeRef.current);
      loadThreads();
    }
    if (r?.reply !== undefined) {
      pushAssistant(r.reply || "", r.tool_calls?.length ? r.tool_calls : null);
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
  }, [loadThreads, pushAssistant]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending || !user) return;
    setSending(true);
    setInput("");
    setFailedPrompt(null);
    const userMsgId = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: msg, tool_calls: null, created_at: new Date().toISOString() },
    ]);
    scrollDown();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const r = await hubChat(activeId, msg, { signal: ctrl.signal, mode: modeRef.current, lang: langRef.current });
      if (!r?.ok && !r?.reply) {
        setFailedPrompt(msg);
        pushAssistant(
          `Something went wrong (${r?.error || "unknown error"}). Your message is saved — hit retry to try again.`,
          null,
        );
      } else {
        applyChatResponse(r);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        pushAssistant(
          "Stopped. The turn may still finish on the server — reopen this chat to see the result.",
          null,
        );
      } else {
        setFailedPrompt(msg);
        pushAssistant("Network error — your message is saved. Hit retry to try again.", null);
      }
    } finally {
      setSending(false);
      scrollDown();
    }
  }, [input, sending, user, activeId, scrollDown, applyChatResponse, pushAssistant]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    if (failedPrompt && !sending) {
      // Drop the failed error note, keep the original user message, resend.
      setMessages((prev) => prev.slice(0, -1));
      send(failedPrompt);
    }
  }, [failedPrompt, sending, send]);

  const doConfirm = useCallback(async (pendingId: string, approved: boolean) => {
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
  }, [applyChatResponse, pushAssistant, scrollDown]);

  const newChat = useCallback(async () => {
    if (!user) return;
    try {
      const r = await hubCreateThread("New chat");
      if (r?.ok) {
        setThreads((prev) => [r.thread, ...prev]);
        selectThread(r.thread.id);
      }
    } catch {
      /* keep local empty state */
      selectThread(null);
    }
  }, [selectThread, user]);

  const delThread = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const r = await hubDeleteThread(id);
      if (r?.ok) {
        setThreads((prev) => prev.filter((t) => t.id !== id));
        if (activeId === id) selectThread(null);
      }
    } catch { /* thread stays; user can retry */ }
  }, [activeId, selectThread]);

  // 1. mode picker
  const changeMode = useCallback((m: HubMode) => {
    setMode(m);
    modeRef.current = m;
    if (activeId) lsSet(`hub-mode:${activeId}`, m);
  }, [activeId]);

  // 3. voice dictation (Web Speech API, zero backend)
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

  // 3. per-message text-to-speech
  const toggleSpeak = useCallback((id: number, text: string) => {
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
  }, [speakingId]);

  // 4. share as X thread draft (goes through the normal send + confirm gate)
  const shareAsThread = useCallback(() => {
    send(
      "Turn your previous reply into an X thread draft: split it into numbered posts of 280 chars or less, show me the exact text of each, then prepare the first x_post tool call for my approval.",
    );
  }, [send]);

  // 6. post win card summary
  const postWinCard = useCallback((d: WinCardData) => {
    send(
      `Post this win summary to X as a text post (no image): ${fmtPnl(d.pnl_usd)} PnL ${d.period} — ${fmtRate(d.win_rate)} win rate over ${d.trades} trades, best trade ${d.best_trade}.`,
    );
  }, [send]);

  // 5. onboarding quest
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

  // slash menu: "/" + intent in the composer offers quick fills
  const slashMatch = /^\/(\w{0,20})$/.exec(input);
  const slashItems = slashMatch
    ? SLASH_INTENTS.filter((s) => s.cmd.startsWith(slashMatch[1].toLowerCase()))
    : [];
  const pickSlash = useCallback((s: { fill: string }) => {
    setInput(s.fill);
    setSlashHi(0);
    inputRef.current?.focus();
  }, []);

  // exit presets
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
        mode === m ? "bg-og-cyan/15 text-og-cyan ring-1 ring-og-cyan/30" : "text-white/40 hover:text-white/70",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  // threads: search filter, pinned sort first
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
    ...(micSupported
      ? [{ id: "voice", label: "Start voice dictation", hint: "speak your prompt", icon: Mic, run: () => toggleRecording() }]
      : []),
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

  return (
    <AppLayout>
      <div className="flex h-[calc(100dvh-4rem)] bg-[#04070f] text-white">
        {/* ── Thread sidebar ── */}
        <aside
          className={cn(
            "z-30 flex w-72 shrink-0 flex-col border-r border-white/[0.07] bg-[#060a14] transition-transform md:static md:translate-x-0",
            sidebarOpen ? "fixed inset-y-0 left-0 translate-x-0" : "fixed inset-y-0 left-0 -translate-x-full",
          )}
        >
          <div className="flex items-center gap-2.5 border-b border-white/[0.07] p-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-og-cyan/20 blur-md" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-og-cyan/40 bg-og-cyan/10">
                <Sparkles className="h-4.5 w-4.5 text-og-cyan" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-black uppercase tracking-wide">AI Hub</div>
              <div className="text-[11px] text-white/40">Chat · Trade · Launch</div>
            </div>
            <button
              type="button"
              onClick={newChat}
              disabled={!user}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-og-cyan px-3 py-1.5 text-xs font-bold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
          <div className="border-b border-white/[0.07] p-2">
            <input
              value={threadQuery}
              onChange={(e) => setThreadQuery(e.target.value)}
              placeholder="Search chats…  (⌘K jumps too)"
              aria-label="Search chats"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white outline-none transition placeholder:text-white/25 focus:border-og-cyan/40"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2">
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
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectThread(t.id)}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition",
                      activeId === t.id
                        ? "border border-white/[0.08] bg-white/[0.06] text-white"
                        : "border border-transparent text-white/60 hover:bg-white/[0.04] hover:text-white",
                    )}
                  >
                    {isPinned && <Pin className="h-3 w-3 shrink-0 fill-og-cyan text-og-cyan" />}
                    <span className="flex-1 truncate">{t.title || "New chat"}</span>
                    <Pin
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(t.id);
                      }}
                      aria-label={isPinned ? "Unpin chat" : "Pin chat"}
                      className={cn(
                        "h-4 w-4 shrink-0 transition hover:text-og-cyan",
                        isPinned ? "text-og-cyan opacity-100" : "text-white/30 opacity-0 group-hover:opacity-100",
                      )}
                    />
                    <Trash2
                      onClick={(e) => delThread(t.id, e)}
                      className="h-4 w-4 shrink-0 text-white/30 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                    />
                  </button>
                );
              })
            )}
            {!loadError && threads.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-white/30">No chats yet — start one below.</div>
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
          <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── Main column ── */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* header */}
          <header className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
            <button type="button" className="md:hidden" onClick={() => setSidebarOpen(true)} aria-label="Chats">
              <Menu className="h-5 w-5 text-white/60" />
            </button>
            <div className="relative hidden sm:block">
              <div className="absolute inset-0 rounded-xl bg-og-cyan/20 blur-lg" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-og-cyan/40 bg-og-cyan/10">
                <Sparkles className="h-5 w-5 text-og-cyan" />
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-black uppercase tracking-wide">OrbitX AI Hub</h1>
              <p className="flex items-center gap-1.5 text-[11px] text-white/40">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-og-lime opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-og-lime" />
                </span>
                {model ? `${model} · full MCP access` : "full MCP access"}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {!questDismissed && (
                <button
                  type="button"
                  onClick={() => setQuestOpen((o) => !o)}
                  title="Setup quest"
                  aria-pressed={questOpen}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition",
                    questOpen
                      ? "border-og-gold/40 bg-og-gold/10 text-og-gold"
                      : "border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/70",
                  )}
                >
                  <Target className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Quest</span>
                </button>
              )}
              <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1" role="group" aria-label="Chat mode">
                {modeButton("analyst", "Analyst", Brain)}
                {modeButton("degen", "Degen", Flame)}
              </div>
              <select
                value={lang}
                onChange={(e) => changeLang(e.target.value)}
                aria-label="Response language"
                title="Response language"
                className="cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-[11px] font-bold text-white/70 outline-none transition hover:text-white [&>option]:bg-[#0a101d]"
              >
                {LANGS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => exportCsv()}
                disabled={exporting || !user}
                title="Export trades CSV"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[11px] font-bold text-white/60 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </header>

          {/* messages */}
          <div className="flex-1 overflow-y-auto px-4 py-5 lg:px-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {loadingThread ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-og-cyan" />
                  <p className="text-sm text-white/40">Loading chat…</p>
                </div>
              ) : (
                <>
                  {messages.length === 0 && (
                    <div className="pt-6 text-center">
                      <div className="relative mx-auto mb-5 h-16 w-16">
                        <div className="absolute inset-0 rounded-2xl bg-og-cyan/20 blur-xl" />
                        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-og-cyan/40 bg-og-cyan/10">
                          <Sparkles className="h-8 w-8 text-og-cyan" />
                        </div>
                      </div>
                      <h2 className="text-xl font-black uppercase tracking-wide">What can I help with?</h2>
                      <p className="mx-auto mt-2 max-w-md text-sm text-white/40">
                        Scan tokens, check markets, trade, launch coins, run strategies — one account, everything in here.
                      </p>
                      <div className="mx-auto mt-6 grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                        {QUICK_PROMPTS.map((q) => (
                          <button
                            key={q.label}
                            type="button"
                            onClick={() => send(q.prompt)}
                            disabled={!user || sending}
                            className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left transition hover:border-og-cyan/30 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <div className="text-[13px] font-semibold text-white/85">{q.label}</div>
                            <div className="mt-0.5 truncate text-[11px] text-white/35">{q.prompt}</div>
                          </button>
                        ))}
                      </div>
                      {questOpen && (
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
                    const bubble = (
                      <div
                        className={cn(
                          "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                          m.role === "assistant"
                            ? "border border-white/[0.06] bg-white/[0.03] text-white/85"
                            : "bg-og-lime/15 text-white",
                        )}
                      >
                        {m.role === "assistant" ? (
                          <div className="prose prose-invert prose-sm max-w-none [&_a]:text-og-cyan [&_code]:rounded [&_code]:bg-black/40 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-og-cyan [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-black/40 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:my-2">
                            <ReactMarkdown>{body || ""}</ReactMarkdown>
                          </div>
                        ) : (
                          m.content
                        )}
                      </div>
                    );
                    return (
                      <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                            m.role === "assistant"
                              ? "border-og-cyan/30 bg-og-cyan/10 text-og-cyan"
                              : "border-og-lime/30 bg-og-lime/10 text-og-lime",
                          )}
                        >
                          {m.role === "assistant" ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 max-w-[85%] flex-1">
                          {dexUrl && <ChartCard url={dexUrl} className="mb-3" />}
                          {wc ? (body && body.trim() ? bubble : null) : bubble}
                          {pie && <AllocPie entries={pie.entries} />}
                          {wc && <WinCard data={wc.data} onPost={postWinCard} />}
                          {m.role === "assistant" && (m.tool_calls?.length ? (
                            <div className="mt-2 space-y-2">
                              {m.tool_calls.map((c, i) => (
                                <ToolCard key={i} call={c} />
                              ))}
                            </div>
                          ) : null)}
                          {m.role === "assistant" && (
                            <div className="mt-1.5 flex items-center gap-1">
                              {speechSupported && (
                                <button
                                  type="button"
                                  onClick={() => toggleSpeak(m.id, m.content || "")}
                                  title={speakingId === m.id ? "Stop reading" : "Read aloud"}
                                  className={cn(
                                    "rounded-lg p-1.5 text-white/35 transition hover:bg-white/10 hover:text-white/80",
                                    speakingId === m.id && "text-og-cyan",
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
                    <PendingCard key={p.id} p={p} onConfirm={doConfirm} busy={confirmBusy} />
                  ))}

                  {sending && (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-og-cyan/30 bg-og-cyan/10 text-og-cyan">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm text-white/50">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Thinking{elapsed > 2 ? <span className="font-mono text-xs"> · {elapsed}s</span> : "…"}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* composer */}
          <div className="border-t border-white/[0.07] px-4 py-3 lg:px-6">
            {!user ? (
              <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-xl border border-og-gold/20 bg-og-gold/5 px-4 py-2.5 text-[12px] text-og-gold/90">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Sign in to chat with the AI Hub.
              </div>
            ) : (
              <>
                <div className="relative mx-auto flex max-w-3xl items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPresetsOpen((o) => !o)}
                    disabled={sending}
                    title="Exit presets — save & apply take-profit plans"
                    aria-pressed={presetsOpen}
                    className={cn(
                      "flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40",
                      presetsOpen
                        ? "border-og-cyan/50 bg-og-cyan/15 text-og-cyan"
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
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
                        "flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40",
                        recording
                          ? "animate-pulse border-red-400/50 bg-red-400/15 text-red-300"
                          : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
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
                      className="max-h-40 min-h-[44px] w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-og-cyan/40 disabled:opacity-60"
                    />
                    {slashItems.length > 0 && (
                      <div className="absolute bottom-full left-0 z-40 mb-2 w-72 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a101d] shadow-2xl">
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
                              i === slashHi ? "bg-og-cyan/10" : "",
                            )}
                          >
                            <span className="rounded-md bg-og-cyan/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-og-cyan">
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
                  {sending ? (
                    <button
                      type="button"
                      onClick={stop}
                      title="Stop"
                      className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl border border-red-400/40 bg-red-400/10 text-red-300 transition hover:bg-red-400/20"
                    >
                      <Square className="h-5 w-5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => send()}
                      disabled={!input.trim()}
                      className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-og-cyan text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  )}
                  {presetsOpen && (
                    <div className="absolute bottom-full left-0 z-40 mb-2 w-80 rounded-xl border border-white/[0.1] bg-[#0a101d] p-3 shadow-2xl">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                        Exit presets
                      </div>
                      {presets.length === 0 && (
                        <p className="mb-2 text-xs text-white/35">
                          No presets yet. Save your take-profit ladder — one tap fills the composer.
                        </p>
                      )}
                      <div className="max-h-48 space-y-1.5 overflow-y-auto">
                        {presets.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-bold text-white/85">{p.name}</div>
                              <div className="truncate font-mono text-[10px] text-white/35">
                                {truncate(p.mint, 20)} · {p.targets}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => applyPreset(p)}
                              className="shrink-0 rounded-lg bg-og-cyan/15 px-2.5 py-1 text-[11px] font-bold text-og-cyan transition hover:bg-og-cyan/25"
                            >
                              Apply
                            </button>
                            <button
                              type="button"
                              onClick={() => delPreset(i)}
                              aria-label="Delete preset"
                              className="shrink-0 rounded-lg p-1 text-white/30 transition hover:bg-white/10 hover:text-red-400"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 space-y-1.5 border-t border-white/[0.07] pt-2">
                        <input
                          value={presetMint}
                          onChange={(e) => setPresetMint(e.target.value)}
                          placeholder="Token mint"
                          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 font-mono text-xs text-white outline-none placeholder:text-white/25 focus:border-og-cyan/40"
                        />
                        <div className="flex gap-1.5">
                          <input
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            placeholder="Name (e.g. SOL ladder)"
                            className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-white/25 focus:border-og-cyan/40"
                          />
                          <input
                            value={presetTargets}
                            onChange={(e) => setPresetTargets(e.target.value)}
                            placeholder="2x, 5x, 10x"
                            className="w-24 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-white/25 focus:border-og-cyan/40"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={savePreset}
                          disabled={!presetMint.trim()}
                          className="w-full rounded-lg bg-og-cyan py-1.5 text-xs font-bold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Save preset
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-white/20">
                  OrbitX AI can make mistakes. Verify on-chain before trading. Trades &amp; posts always ask first.
                </p>
              </>
            )}
          </div>
        </main>
      </div>

      {/* command palette */}
      {cmdOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
          onClick={() => setCmdOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a101d] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={cmdQuery}
              onChange={(e) => {
                setCmdQuery(e.target.value);
                setCmdHi(0);
              }}
              onKeyDown={cmdInputKeyDown}
              placeholder="Type a command or search chats…"
              aria-label="Command palette"
              className="w-full border-b border-white/[0.07] bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
            />
            <div className="max-h-80 overflow-y-auto p-2">
              {cmdResults.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  onMouseEnter={() => setCmdHi(i)}
                  onClick={() => cmdPick(a)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                    i === cmdHi ? "bg-og-cyan/10 text-white" : "text-white/70",
                  )}
                >
                  <a.icon className="h-4 w-4 shrink-0 text-og-cyan" />
                  <span className="flex-1 truncate">{a.label}</span>
                  <span className="shrink-0 text-[11px] text-white/30">{a.hint}</span>
                </button>
              ))}
              {cmdResults.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-white/30">No matches.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/10 bg-[#0a101d] px-4 py-2.5 text-sm text-white shadow-2xl">
          {toast}
        </div>
      )}
    </AppLayout>
  );
}
