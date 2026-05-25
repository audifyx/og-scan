/**
 * ToolsHub — Premium tool directory for OG Scan.
 * Rich cards with gradients, descriptions, and category sections.
 */
import React, { useState } from "react";
import {
  Search, Target, Rss, Activity, Flame, Radar, Rocket,
  Wallet, Zap, Cpu, Radio, Coins, Map, Palette,
  Wrench, TrendingUp, BarChart3, LineChart, ArrowRight,
  Sparkles, Shield, Eye, Layers, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ToolCategory = "forensics" | "market" | "trading" | "project";

interface ToolItem {
  id: string;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  glowColor: string;
  category: ToolCategory;
  badge?: string;
}

const TOOLS: ToolItem[] = [
  // Forensics
  { id: "scanner",    label: "Truth Scanner",  description: "Mint forensics, rug score, LP risk, holder analysis",           Icon: Search,     gradient: "from-emerald-500 to-green-400", glowColor: "rgba(16,185,129,0.3)",  category: "forensics", badge: "Popular" },
  { id: "og-finder",  label: "OG Finder",      description: "First-mint proof, lineage & dominance context",                Icon: Eye,        gradient: "from-lime-400 to-emerald-400",  glowColor: "rgba(163,230,53,0.3)",  category: "forensics" },
  { id: "snipe-feed", label: "Launch Radar",    description: "New launches, creator patterns & migration timing",            Icon: Target,     gradient: "from-cyan-400 to-blue-500",     glowColor: "rgba(34,211,238,0.3)",  category: "forensics", badge: "Live" },
  { id: "migrations", label: "Migrations",      description: "Pump.fun → DEX breakout tracking & timing",                   Icon: Rocket,     gradient: "from-amber-400 to-orange-500",  glowColor: "rgba(251,191,36,0.3)",  category: "forensics" },

  // Market
  { id: "feed",         label: "Market Feed",   description: "Live trending, whale context, CTO analytics & boosts",        Icon: Rss,        gradient: "from-green-400 to-emerald-500", glowColor: "rgba(52,211,153,0.3)",  category: "market" },
  { id: "market-pulse", label: "Market Pulse",  description: "Real-time price, liquidity, holders & market cap",            Icon: Activity,   gradient: "from-cyan-400 to-teal-400",     glowColor: "rgba(34,211,238,0.3)",  category: "market" },
  { id: "trending",     label: "Trending",      description: "Live momentum, heat scores & catalyst discovery",             Icon: Flame,      gradient: "from-orange-400 to-red-500",    glowColor: "rgba(251,146,60,0.3)",  category: "market", badge: "Hot" },
  { id: "pairs",        label: "Pairs",         description: "New pools, liquidity routing & DEX intelligence",             Icon: Radar,      gradient: "from-blue-400 to-indigo-500",   glowColor: "rgba(96,165,250,0.3)",  category: "market" },
  { id: "whales",       label: "Whales",        description: "Holder concentration, whale tracking & copy trading",         Icon: Wallet,     gradient: "from-purple-400 to-violet-500", glowColor: "rgba(167,139,250,0.3)", category: "market" },
  { id: "tx-feed",      label: "Tx Feed",       description: "Live buy/sell tape for any token",                            Icon: BarChart3,  gradient: "from-teal-400 to-cyan-500",     glowColor: "rgba(45,212,191,0.3)",  category: "market" },
  { id: "news-signal",  label: "News Signal",   description: "Influencer intel — find coins before the market reacts",      Icon: Radio,      gradient: "from-lime-400 to-green-500",    glowColor: "rgba(163,230,53,0.3)",  category: "market" },
  { id: "charts",       label: "Charts",        description: "Real-time DEX charts with favorites & history",               Icon: LineChart,   gradient: "from-indigo-400 to-violet-500", glowColor: "rgba(129,140,248,0.3)", category: "market" },

  // Trading
  { id: "swap",     label: "Swap",       description: "Jupiter-routed swaps with scanner context",               Icon: Zap,     gradient: "from-yellow-400 to-amber-500", glowColor: "rgba(250,204,21,0.3)",  category: "trading" },
  { id: "discover", label: "LaunchPad",  description: "Token explorer, viral feed & launchpad discovery",        Icon: Globe,   gradient: "from-pink-400 to-rose-500",    glowColor: "rgba(251,113,133,0.3)", category: "trading" },

  // Project
  { id: "memes",    label: "Memes",      description: "Live meme feed — fresh degen art & vibes",               Icon: Palette, gradient: "from-fuchsia-400 to-pink-500", glowColor: "rgba(232,121,249,0.3)", category: "project" },
  { id: "our-coin", label: "OG Token",   description: "Official OGScan coin — CA, chart & dev wallet",          Icon: Coins,   gradient: "from-amber-300 to-yellow-500", glowColor: "rgba(252,211,77,0.3)",  category: "project" },
  { id: "roadmap",  label: "Roadmap",    description: "Vision & milestones for the OGScan ecosystem",           Icon: Map,     gradient: "from-sky-400 to-blue-500",     glowColor: "rgba(56,189,248,0.3)",  category: "project" },
  { id: "tech",     label: "Tech Stack", description: "Systems powering OG attribution & token forensics",      Icon: Cpu,     gradient: "from-slate-300 to-zinc-400",   glowColor: "rgba(148,163,184,0.2)", category: "project" },
];

const CATEGORIES: { id: ToolCategory | "all"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "all",        label: "All Tools",  icon: Layers },
  { id: "forensics",  label: "Forensics",  icon: Shield },
  { id: "market",     label: "Market",     icon: TrendingUp },
  { id: "trading",    label: "Trading",    icon: Zap },
  { id: "project",    label: "Project",    icon: Sparkles },
];

const CATEGORY_HEADERS: Record<ToolCategory, { title: string; subtitle: string }> = {
  forensics: { title: "Forensics", subtitle: "Deep-scan any token before you ape" },
  market:    { title: "Market Intelligence", subtitle: "Real-time data, feeds & analytics" },
  trading:   { title: "Trading", subtitle: "Execute & discover opportunities" },
  project:   { title: "OGScan Project", subtitle: "Token, roadmap & community" },
};

interface ToolsHubProps {
  onNavigate: (tabId: string) => void;
}

/* ─── Tool Card ─── */
const ToolCard: React.FC<{ tool: ToolItem; onNavigate: (id: string) => void }> = ({ tool, onNavigate }) => (
  <button
    onClick={() => onNavigate(tool.id)}
    className="group relative flex items-start gap-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.05] active:scale-[0.98]"
    style={{
      boxShadow: "0 0 0 0 transparent",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = `0 8px 32px -8px ${tool.glowColor}`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = "0 0 0 0 transparent";
    }}
  >
    {/* Icon */}
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg transition-transform duration-200 group-hover:scale-110 group-hover:rotate-[-2deg]",
        tool.gradient,
      )}
    >
      <tool.Icon className="h-5.5 w-5.5 text-white drop-shadow-md" strokeWidth={2.2} />
    </div>

    {/* Text */}
    <div className="min-w-0 flex-1 pt-0.5">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold text-white/85 group-hover:text-white transition-colors">
          {tool.label}
        </span>
        {tool.badge && (
          <span className={cn(
            "rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider",
            tool.badge === "Live" ? "bg-red-500/15 text-red-400" :
            tool.badge === "Hot"  ? "bg-orange-500/15 text-orange-400" :
                                    "bg-og-lime/15 text-og-lime",
          )}>
            {tool.badge}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[10px] leading-relaxed text-white/30 group-hover:text-white/45 transition-colors line-clamp-2">
        {tool.description}
      </p>
    </div>

    {/* Arrow */}
    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/[0.08] transition-all duration-200 group-hover:text-white/30 group-hover:translate-x-0.5 mt-1" />
  </button>
);

/* ─── Featured Card (larger, for top tools) ─── */
const FeaturedCard: React.FC<{ tool: ToolItem; onNavigate: (id: string) => void }> = ({ tool, onNavigate }) => (
  <button
    onClick={() => onNavigate(tool.id)}
    className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 text-center transition-all duration-200 hover:border-white/[0.16] hover:from-white/[0.06] hover:to-white/[0.02] active:scale-[0.97]"
    style={{ boxShadow: "0 0 0 0 transparent" }}
    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 12px 40px -8px ${tool.glowColor}`; }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 0 0 0 transparent"; }}
  >
    {tool.badge && (
      <span className={cn(
        "absolute top-2.5 right-2.5 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider",
        tool.badge === "Live" ? "bg-red-500/15 text-red-400" :
        tool.badge === "Hot"  ? "bg-orange-500/15 text-orange-400" :
                                "bg-og-lime/15 text-og-lime",
      )}>
        {tool.badge}
      </span>
    )}
    <div
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-xl transition-all duration-200 group-hover:scale-110 group-hover:shadow-2xl",
        tool.gradient,
      )}
    >
      <tool.Icon className="h-6 w-6 text-white drop-shadow-md" strokeWidth={2.2} />
    </div>
    <div>
      <span className="text-[13px] font-bold text-white/85 group-hover:text-white transition-colors">
        {tool.label}
      </span>
      <p className="mt-0.5 text-[9px] leading-relaxed text-white/25 group-hover:text-white/40 transition-colors">
        {tool.description}
      </p>
    </div>
  </button>
);

/* ─── Main ToolsHub ─── */
const ToolsHub: React.FC<ToolsHubProps> = ({ onNavigate }) => {
  const [filter, setFilter] = useState<ToolCategory | "all">("all");

  const featured = TOOLS.filter(t => ["scanner", "snipe-feed", "trending", "swap"].includes(t.id));
  const showCategorized = filter === "all";
  const filteredTools = filter === "all" ? TOOLS : TOOLS.filter(t => t.category === filter);
  const categories: ToolCategory[] = ["forensics", "market", "trading", "project"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-og-lime/20 to-og-cyan/20 border border-og-lime/20">
            <Wrench className="h-5 w-5 text-og-lime" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">Tools</h1>
            <p className="text-[10px] text-white/30 font-medium tracking-wide">{TOOLS.length} tools available</p>
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
        {CATEGORIES.map((c) => {
          const isActive = filter === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={cn(
                "group flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-bold transition-all duration-200",
                isActive
                  ? "bg-white/10 text-white shadow-[0_0_12px_rgba(255,255,255,0.04)]"
                  : "bg-white/[0.03] text-white/35 hover:bg-white/[0.06] hover:text-white/55",
              )}
            >
              <c.icon className={cn("h-3.5 w-3.5 transition-colors", isActive ? "text-og-lime" : "text-white/20 group-hover:text-white/40")} />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Featured row — only show in "All" view */}
      {showCategorized && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-og-gold/60" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">Quick Access</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {featured.map(tool => (
              <FeaturedCard key={tool.id} tool={tool} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      )}

      {/* Category sections or filtered list */}
      {showCategorized ? (
        categories.map(cat => {
          const catTools = TOOLS.filter(t => t.category === cat);
          const header = CATEGORY_HEADERS[cat];
          return (
            <div key={cat}>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
                <div className="text-center">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/20">{header.title}</span>
                  <p className="text-[9px] text-white/10">{header.subtitle}</p>
                </div>
                <div className="h-px flex-1 bg-gradient-to-l from-white/[0.06] to-transparent" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {catTools.map(tool => (
                  <ToolCard key={tool.id} tool={tool} onNavigate={onNavigate} />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredTools.map(tool => (
            <ToolCard key={tool.id} tool={tool} onNavigate={onNavigate} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-3 text-center">
        <p className="text-[9px] text-white/15 font-medium">
          All tools connect to live on-chain data · Powered by OGScan infrastructure
        </p>
      </div>
    </div>
  );
};

export default ToolsHub;
