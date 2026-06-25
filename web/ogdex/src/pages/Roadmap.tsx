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
    phase: "Phase 2", title: "Depth & Reliability — In Progress",
    items: [
      { t: "Deeper KOL/whale feed coverage and faster ingestion", s: "progress" },
      { t: "Richer charting (candles + volume) directly on the token page", s: "progress" },
      { t: "Bundle & sniper detection surfaced more prominently", s: "progress" },
      { t: "Pinpoint first-buy tx for mega-cap tokens via a dedicated indexer", s: "planned" },
      { t: "Uptime alerting + status page from the health endpoint", s: "planned" },
    ],
  },
  {
    phase: "Phase 3", title: "Pro & Automation — Planned",
    items: [
      { t: "Alerts v2: price, whale, migration and dev-sell alerts from any token page", s: "planned" },
      { t: "Wallet copy-tracking with real-time trade notifications", s: "planned" },
      { t: "Pro tier: advanced analytics + higher API limits gated by the OG token", s: "planned" },
      { t: "Saved filters, watchlist sync, and shareable scan cards for any token", s: "planned" },
      { t: "More chains and deeper EVM forensics parity with Solana", s: "planned" },
    ],
  },
  {
    phase: "Phase 4", title: "Ecosystem — Vision",
    items: [
      { t: "Public AI agent / MCP so any assistant can use OG DEX live", s: "planned" },
      { t: "Native mobile apps", s: "planned" },
      { t: "Community-curated KOL lists and reputation scoring", s: "planned" },
      { t: "Open analytics dashboards and embeddable widgets for projects", s: "planned" },
    ],
  },
];

export default function Roadmap() {
  return (
    <div className="max-w-3xl mx-auto py-6 px-1">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-4"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <PageBanner />
      <div className="flex items-center gap-2 mb-1"><Sparkles className="w-5 h-5 text-accent" /><h1 className="text-2xl font-black tracking-tight">OG DEX Roadmap</h1></div>
      <p className="text-xs text-muted mb-6">We ship every week, driven by what the community asks for. Follow <a href="https://t.me/ogupdates" target="_blank" rel="noreferrer" className="text-accent">@ogupdates</a> for releases.</p>

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
        <Link to="/whitepaper" className="btn bg-accent/15 text-accent inline-flex items-center gap-1.5"><FileText className="w-4 h-4" /> Read the Whitepaper</Link>
        <a href="https://ogscan.fun" className="btn bg-panel2 text-muted hover:text-white">Open the App</a>
      </div>
      <p className="text-[11px] text-muted/60 mt-4">Roadmap items are directional, not guarantees, and may change. Not financial advice.</p>
    </div>
  );
}
