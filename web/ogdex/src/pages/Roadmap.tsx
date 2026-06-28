import { Link } from "react-router-dom";
import PageBanner from "../components/PageBanner";
import { ArrowLeft, CheckCircle2, Loader2, Circle, Sparkles, FileText } from "lucide-react";

type Status = "done" | "progress" | "planned";
const STATUS: Record<Status, { label: string; cls: string; Icon: any }> = {
  done: { label: "Shipped", cls: "text-up border-up/30 bg-up/10", Icon: CheckCircle2 },
  progress: { label: "In progress", cls: "text-accent border-accent/30 bg-accent/10", Icon: Loader2 },
  planned: { label: "Planned", cls: "text-muted border-line bg-panel2", Icon: Circle },
};

const PHASES: { phase: string; title: string; items: { t: string; s: Status }[] }[] = [
  {
    phase: "Phase 1", title: "Foundation — Live",
    items: [
      { t: "Multi-chain screener with curated, garbage-filtered discovery lists (16 chains)", s: "done" },
      { t: "Full Token Page: trust verdict, AI OG Read, metrics, labeled holders, live trades", s: "done" },
      { t: "Dev & Origin forensics: dev wallet, dev-sold, first buyer + tx, DexScreener-paid", s: "done" },
      { t: "Accurate data + real all-time-high (no Birdeye dependency)", s: "done" },
      { t: "Pulse: real-time on-chain signals (surges, momentum, graduating, migrated)", s: "done" },
      { t: "KOL & whale tracking, holder labeling (exchanges, AMMs, KOLs)", s: "done" },
      { t: "Portfolio + realized/unrealized PnL with one-tap X share cards", s: "done" },
      { t: "Per-coin AI chat grounded in on-chain data + live web search", s: "done" },
      { t: "Public API as a single OpenAPI link + rate limiting + health monitoring", s: "done" },
      { t: "Installable PWA, smart alerts, Store & boosts, token launcher", s: "done" },
      { t: "Legal/trust (disclaimer, Terms, Privacy) and admin dashboard", s: "done" },
    ],
  },
  {
    phase: "Phase 2", title: "Depth & Reliability — Shipped",
    items: [
      { t: "Deeper KOL/whale feed coverage and faster ingestion", s: "done" },
      { t: "Native candlestick + volume chart directly on the token page (no DexScreener dependency)", s: "done" },
      { t: "Bundle & sniper detection surfaced prominently on every token page", s: "done" },
      { t: "Pinpoint first-buy tx for mega-cap tokens via a dedicated indexer", s: "done" },
      { t: "Uptime alerting + live status page at /status", s: "done" },
    ],
  },
  {
    phase: "Phase 3", title: "Pro & Automation — Shipped",
    items: [
      { t: "Alerts v2: price, whale, migration and dev-sell alerts from any token page", s: "done" },
      { t: "Wallet copy-tracking with real-time trade notifications at /copy-trade", s: "done" },
      { t: "Pro tier: advanced analytics + higher API limits gated by the OG token", s: "done" },
      { t: "Saved filters, watchlist sync, and shareable scan cards for any token", s: "done" },
      { t: "More chains and deeper EVM forensics parity with Solana", s: "progress" },
    ],
  },
  {
    phase: "Phase 4", title: "Ecosystem — Shipped",
    items: [
      { t: "Public AI agent / MCP at /api/mcp — any AI assistant can query OG DEX live (token, screener, forensics, wallet, chart, KOLs, search)", s: "done" },
      { t: "Community-curated KOL lists with nominations, reputation scoring, and OG verification at /kol/community", s: "done" },
      { t: "Embeddable token widget — one script tag, live price + metrics, any site; configure at /embed", s: "done" },
      { t: "Native mobile apps", s: "planned" },
    ],
  },
];

export default function Roadmap() {
  return (
    <div className="max-w-3xl mx-auto py-6 px-1">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-4"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <PageBanner />
      <div className="flex items-center gap-2 mb-1"><Sparkles className="w-5 h-5 text-accent" /><h1 className="text-2xl font-black tracking-tight">OG DEX Roadmap</h1></div>
      <p className="text-xs text-muted mb-6">We ship every week, driven by what the community asks for. Follow <a href="https://t.me/OrbitXupdates" target="_blank" rel="noreferrer" className="text-accent">@ogupdates</a> for releases.</p>

      <div className="space-y-5">
        {PHASES.map((ph) => (
          <div key={ph.phase} className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="pill bg-accent/15 text-accent text-[11px] font-bold">{ph.phase}</span>
              <span className="font-semibold">{ph.title}</span>
            </div>
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
        <a href="https://ogscan.fun" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-panel2 text-muted border border-line hover:text-white transition-all">Open the App</a>
        <Link to="/status" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-panel2 text-muted border border-line hover:text-white transition-all">System Status</Link>
      </div>
      <p className="text-[11px] text-muted/60 mt-4">Roadmap items are directional, not guarantees, and may change. Not financial advice.</p>
    </div>
  );
}
