import { Link } from "react-router-dom";
import PageBanner from "../components/PageBanner";
import { ArrowLeft, CheckCircle2, Loader2, Circle, Sparkles, FileText } from "lucide-react";

type Status = "done" | "progress" | "planned";
const STATUS: Record<Status, { label: string; cls: string; Icon: any }> = {
  done: { label: "Shipped", cls: "text-up border-up/30 bg-up/10", Icon: CheckCircle2 },
  progress: { label: "In progress", cls: "text-accent border-accent/30 bg-accent/10", Icon: Loader2 },
  planned: { label: "Planned", cls: "text-muted border-line bg-panel2", Icon: Circle },
};

const PHASES: { phase: string; title: string; desc?: string; items: { t: string; s: Status }[] }[] = [
  {
    phase: "Phase 1", title: "Foundation — DEX Intelligence",
    desc: "The forensic core: turn any contract address into a complete, trustworthy dossier.",
    items: [
      { t: "Multi-chain screener with curated, garbage-filtered discovery lists (16 chains)", s: "done" },
      { t: "Full Token Page: trust verdict, AI read, metrics, labeled holders, live trades", s: "done" },
      { t: "Dev & Origin forensics: dev wallet, dev-sold, first buyer + tx, DexScreener-paid", s: "done" },
      { t: "Accurate market data with real all-time-high history", s: "done" },
      { t: "Pulse: real-time on-chain signals (volume/buyer surges, momentum, graduating, migrated)", s: "done" },
      { t: "KOL & whale tracking with holder labeling (exchanges, AMMs, KOLs)", s: "done" },
      { t: "Portfolio with realized/unrealized PnL and one-tap share cards", s: "done" },
      { t: "Per-coin AI grounded in live on-chain data + web search", s: "done" },
      { t: "Public OpenAPI, rate limiting, health monitoring, installable PWA", s: "done" },
    ],
  },
  {
    phase: "Phase 2", title: "Depth & Reliability",
    desc: "Independent data, deeper forensics, and provable uptime.",
    items: [
      { t: "Native candlestick + volume chart on the token page (no external chart dependency)", s: "done" },
      { t: "Bundle & sniper detection surfaced on every token page", s: "done" },
      { t: "Pinpoint first-buy tx for mega-caps via a dedicated indexer", s: "done" },
      { t: "Source fallbacks + edge caching for resilience; live status page at /status", s: "done" },
    ],
  },
  {
    phase: "Phase 3", title: "Pro & Automation",
    desc: "Put the intelligence to work automatically.",
    items: [
      { t: "Smart Alerts v2: price, whale-buy, dev-sell and migration alerts to Telegram/webhooks", s: "done" },
      { t: "Wallet copy-tracking with a live trade feed at /copy-trade", s: "done" },
      { t: "Pro tier: advanced analytics + higher API limits, gated non-custodially by the OrbitX token", s: "done" },
      { t: "Saved filters, watchlist sync, shareable scan cards", s: "done" },
      { t: "Multi-source Token Sniper (newest, bonding, trending, gainers, migrated) with safety chips", s: "done" },
      { t: "Restored tool suite: Snipe Feed, Scanner, New Pairs, OG Finder, Migrations, Trending, Swap", s: "done" },
    ],
  },
  {
    phase: "Phase 4", title: "Open Ecosystem",
    desc: "Make OrbitX programmable and embeddable everywhere.",
    items: [
      { t: "Public AI agent / MCP — any AI assistant can query OrbitX live (token, screener, forensics, wallet, chart, KOLs, search)", s: "done" },
      { t: "Community-curated KOL lists with nominations + OG verification at /kol/community", s: "done" },
      { t: "Embeddable token widget — one script tag, live metrics on any site, configure at /embed", s: "done" },
    ],
  },
  {
    phase: "Phase 5", title: "Social Layer",
    desc: "The community side of the on-chain OS — your identity follows you across every tool.",
    items: [
      { t: "X-style home timeline: composer, realtime feed, likes, replies, cashtag + mint linking", s: "done" },
      { t: "Profiles with avatars, banners, bios, official/verified accounts, and on-chain context", s: "done" },
      { t: "Communities, group chat, and per-token rooms", s: "done" },
      { t: "Voice Spaces with live audio, lobbies and recordings", s: "done" },
      { t: "Live streaming: go live with camera or screen share, multi-broadcaster grid + live chat", s: "done" },
      { t: "KOL social feed with avatars and real-time buy/sell activity", s: "done" },
      { t: "Creator tools, reputation, and moderation/admin controls", s: "progress" },
    ],
  },
  {
    phase: "Phase 6", title: "Convergence",
    desc: "One identity, one platform — trading, social, live, predictions and gaming connected by design.",
    items: [
      { t: "Unified cross-product identity + on-chain reputation across DEX, Social, Live and Games", s: "progress" },
      { t: "Creator monetization: tips, paid Spaces/streams, premium communities", s: "planned" },
      { t: "Prediction markets + provably-fair 1v1 games wired into OrbitX token insights", s: "planned" },
      { t: "Copy-trading automation and strategy vaults (non-custodial)", s: "planned" },
      { t: "Deeper AI analyst: natural-language queries across all on-chain data, automated reports", s: "planned" },
      { t: "Native iOS & Android apps with push", s: "planned" },
    ],
  },
];

export default function Roadmap() {
  return (
    <div className="max-w-3xl mx-auto py-6 px-1">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-4"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <PageBanner />
      <div className="flex items-center gap-2 mb-1"><Sparkles className="w-5 h-5 text-accent" /><h1 className="text-2xl font-black tracking-tight">OrbitX Roadmap</h1></div>
      <p className="text-[13.5px] text-muted mb-2 max-w-2xl">OrbitX is building the on-chain operating system for Solana and beyond — trading intelligence, social, live streaming, prediction markets and gaming in a single destination. We ship every week, driven by what the community asks for.</p>
      <p className="text-xs text-muted mb-6">Follow <a href="https://t.me/OrbitXupdates" target="_blank" rel="noreferrer" className="text-accent">@ogupdates</a> for releases.</p>

      <div className="space-y-5">
        {PHASES.map((ph) => (
          <div key={ph.phase} className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="pill bg-accent/15 text-accent text-[11px] font-bold">{ph.phase}</span>
              <span className="font-semibold">{ph.title}</span>
            </div>
            {ph.desc && <p className="text-[12px] text-muted mb-3">{ph.desc}</p>}
            <div className="space-y-2">
              {ph.items.map((it, i) => {
                const st = STATUS[it.s];
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <st.Icon className={`w-4 h-4 mt-0.5 shrink-0 ${it.s === "done" ? "text-up" : it.s === "progress" ? "text-accent" : "text-muted"}`} />
                    <span className="text-[13.5px] text-white/85 flex-1">{it.t}</span>
                    <span className={`pill text-[9px] border ${st.cls} shrink-0`}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link to="/whitepaper" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-all">
          <FileText className="w-3.5 h-3.5" /> Read the Whitepaper
        </Link>
        <a href="https://orbitx.world" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-panel2 text-muted border border-line hover:text-white transition-all">Open the App</a>
        <Link to="/status" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-panel2 text-muted border border-line hover:text-white transition-all">System Status</Link>
      </div>
      <p className="text-[11px] text-muted/60 mt-4">Roadmap items are directional, not guarantees, and may change. Not financial advice.</p>
    </div>
  );
}
