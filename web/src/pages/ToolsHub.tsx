/**
 * ToolsHub — Consolidated tool directory for OG Scan.
 * Reframed as a cleaner iOS App Store-style grid.
 */
import React from "react";
import {
  Search, Target, Rss, Activity,
  Zap, Coins, ArrowUpRight, Star,
  Sparkles, Shield, TrendingUp, Layers,
  Wrench, Flame, Radio, ScanSearch
} from "lucide-react";
import { cn } from "@/lib/utils";

type ToolCategory = "forensics" | "market" | "trading" | "project";

interface ToolItem {
  id: string;
  label: string;
  description: string;
  detail: string;
  Icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  glowColor: string;
  category: ToolCategory;
  badge?: string;
  contains?: string[];
}

const TOOLS: ToolItem[] = [
  {
    id: "scanner",
    label: "Truth Scanner",
    description: "Forensic chain analysis for origin checks, clone detection, and wallet trails.",
    detail: "OG Finder, Scan History, Compare",
    Icon: Search,
    gradient: "from-emerald-400 via-green-400 to-lime-300",
    glowColor: "rgba(16,185,129,0.35)",
    category: "forensics",
    badge: "Popular",
    contains: ["Scanner", "OG Finder", "Compare"],
  },
  {
    id: "snipe-feed",
    label: "Launch Radar",
    description: "Track new launches, migrations, and early movement before the crowd does.",
    detail: "Snipe Feed, Migrations, Alerts",
    Icon: Target,
    gradient: "from-cyan-300 via-sky-400 to-blue-500",
    glowColor: "rgba(56,189,248,0.35)",
    category: "forensics",
    badge: "Live",
    contains: ["Launches", "Migrations", "Alerts"],
  },
  {
    id: "feed",
    label: "Market Feed",
    description: "Narratives, trending coins, breaking movement, and live market discovery.",
    detail: "Trending, News Signal, Heatmap",
    Icon: Rss,
    gradient: "from-orange-300 via-orange-400 to-red-500",
    glowColor: "rgba(251,146,60,0.35)",
    category: "market",
    badge: "Hot",
    contains: ["Trending", "News", "Heatmap"],
  },
  {
    id: "market-pulse",
    label: "Token Intel",
    description: "Open a token and get vitals, whale watch, pairs, TX flow, and chart context.",
    detail: "Vitals, Pairs, Whales, TX Feed",
    Icon: Activity,
    gradient: "from-fuchsia-400 via-violet-400 to-purple-500",
    glowColor: "rgba(168,85,247,0.35)",
    category: "market",
    contains: ["Vitals", "Whales", "TX Feed"],
  },
  {
    id: "swap",
    label: "Swap",
    description: "Fast Jupiter-routed swaps with live quotes and clean execution.",
    detail: "Route, quote, confirm",
    Icon: Zap,
    gradient: "from-yellow-300 via-amber-400 to-orange-400",
    glowColor: "rgba(250,204,21,0.35)",
    category: "trading",
    contains: ["Quotes", "Routing", "Execution"],
  },
  {
    id: "listings",
    label: "Token Listings",
    description: "List and promote tokens with pulled data, holder checks, and AI analysis.",
    detail: "List, analyze, publish",
    Icon: Star,
    gradient: "from-amber-300 via-yellow-400 to-orange-500",
    glowColor: "rgba(245,158,11,0.35)",
    category: "trading",
    badge: "New",
    contains: ["List", "Analyze", "Promote"],
  },
  {
    id: "our-coin",
    label: "About OGScan",
    description: "Official token info, roadmap, infrastructure, and community surface area.",
    detail: "Token, roadmap, stack",
    Icon: Coins,
    gradient: "from-yellow-200 via-amber-300 to-yellow-500",
    glowColor: "rgba(252,211,77,0.35)",
    category: "project",
    contains: ["Token", "Roadmap", "Infra"],
  },
];

const CATEGORY_META: Record<ToolCategory, { label: string; Icon: React.ComponentType<{ className?: string }>; blurb: string }> = {
  forensics: { label: "Forensics", Icon: Shield, blurb: "Trace launches, wallets, and origins." },
  market: { label: "Market", Icon: TrendingUp, blurb: "Read live momentum and signals." },
  trading: { label: "Trading", Icon: Zap, blurb: "Execute, list, and move fast." },
  project: { label: "Project", Icon: Sparkles, blurb: "Official OG Scan surfaces." },
};

const badgeTone = (badge?: string) => {
  if (badge === "Live") return "border-red-400/25 bg-red-400/12 text-red-200";
  if (badge === "Hot") return "border-orange-400/25 bg-orange-400/12 text-orange-200";
  if (badge === "Popular") return "border-emerald-400/25 bg-emerald-400/12 text-emerald-200";
  return "border-og-gold/25 bg-og-gold/12 text-og-gold";
};

interface ToolsHubProps {
  onNavigate: (tabId: string) => void;
}

const ToolSquare: React.FC<{ tool: ToolItem; onNavigate: (id: string) => void }> = ({ tool, onNavigate }) => (
  <button
    type="button"
    onClick={() => onNavigate(tool.id)}
    className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-transparent p-3 text-left transition-all duration-300 hover:-translate-y-1 hover:border-white/20 active:scale-[0.985]"
    style={{ boxShadow: `0 18px 60px -28px ${tool.glowColor}` }}
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_45%)] opacity-70" />
    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01)_35%,transparent_100%)]" />
    <div className={cn("absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-transform duration-300 group-hover:scale-110", tool.gradient)} />

    <div className="relative flex h-full min-h-[196px] flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br shadow-[0_16px_30px_-18px_rgba(0,0,0,0.85)] transition-transform duration-300 group-hover:scale-105", tool.gradient)}>
          <tool.Icon className="h-7 w-7 text-white" strokeWidth={2.2} />
        </div>
        {tool.badge ? (
          <span className={cn("rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.22em]", badgeTone(tool.badge))}>
            {tool.badge}
          </span>
        ) : (
          <ArrowUpRight className="mt-1 h-4 w-4 text-white/25 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white/60" />
        )}
      </div>

      <div className="mt-5 space-y-2">
        <div>
          <h3 className="text-[15px] font-black tracking-tight text-white">{tool.label}</h3>
          <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-white/55">{tool.description}</p>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {(tool.contains || []).slice(0, 3).map(item => (
            <span
              key={item}
              className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/40"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-end justify-between pt-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/25">Includes</p>
          <p className="mt-1 text-[10px] text-white/45">{tool.detail}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/50 transition-colors duration-300 group-hover:border-white/20 group-hover:text-white">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  </button>
);

const ToolsHub: React.FC<ToolsHubProps> = ({ onNavigate }) => {
  const categories: ToolCategory[] = ["forensics", "market", "trading", "project"];

  return (
    <div className="space-y-8 pb-4">
      <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-transparent px-5 py-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(41,255,163,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_70%)]" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white/45">
              <Layers className="h-3.5 w-3.5 text-og-cyan" />
              Tools Directory
            </div>
            <h1 className="mt-3 text-[28px] font-black tracking-[-0.04em] text-white">Tools</h1>
            <p className="mt-2 max-w-md text-[12px] leading-relaxed text-white/55">
              A cleaner OG Scan tools home — square app-style entries, faster scanning, and no muddy gray slabs fighting the background.
            </p>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03] backdrop-blur-xl">
            <Wrench className="h-6 w-6 text-og-lime" />
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: `${TOOLS.length} tools`, Icon: Wrench },
            { label: "Live market", Icon: Radio },
            { label: "Deep scans", Icon: ScanSearch },
            { label: "Fast actions", Icon: Flame },
          ].map(item => (
            <div key={item.label} className="rounded-[22px] border border-white/10 px-3 py-3 backdrop-blur-sm">
              <item.Icon className="h-4 w-4 text-white/60" />
              <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {categories.map(category => {
        const meta = CATEGORY_META[category];
        const categoryTools = TOOLS.filter(tool => tool.category === category);
        if (!categoryTools.length) return null;

        return (
          <section key={category} className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                    <meta.Icon className="h-4 w-4 text-white/70" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black tracking-tight text-white">{meta.label}</h2>
                    <p className="text-[10px] text-white/35">{meta.blurb}</p>
                  </div>
                </div>
              </div>
              <div className="hidden h-px flex-1 bg-gradient-to-l from-white/10 to-transparent md:block" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {categoryTools.map(tool => (
                <ToolSquare key={tool.id} tool={tool} onNavigate={onNavigate} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default ToolsHub;
