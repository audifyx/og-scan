/**
 * ToolsHub — Consolidated tool directory for OG Scan.
 * 6 merged tools instead of 18 separate ones.
 */
import React from "react";
import {
  Search, Target, Rss, Activity,
  Zap, Coins, ArrowRight, Star,
  Sparkles, Shield, TrendingUp, Layers,
  Wrench,
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
    description: "Forensic chain analysis — verify any token's origin and detect clones",
    detail: "OG Finder, Scan History, Comparative Scan",
    Icon: Search,
    gradient: "from-emerald-500 to-green-400",
    glowColor: "rgba(16,185,129,0.3)",
    category: "forensics",
    badge: "Popular",
    contains: ["Scanner", "OG Finder", "Scan History", "Compare"],
  },
  {
    id: "snipe-feed",
    label: "Launch Radar",
    description: "New launches, migrations & early alerts from Pump.fun to DEX",
    detail: "Snipe Feed, Migrations, Launch Alerts",
    Icon: Target,
    gradient: "from-cyan-400 to-blue-500",
    glowColor: "rgba(34,211,238,0.3)",
    category: "forensics",
    badge: "Live",
    contains: ["Snipe Feed", "Migrations", "Launch Alerts"],
  },
  {
    id: "feed",
    label: "Market Feed",
    description: "Trending coins, narrative signals, pair discovery & live market tape",
    detail: "Live Feed, Trending, News Signal, Heatmap, Clusters",
    Icon: Rss,
    gradient: "from-orange-400 to-red-500",
    glowColor: "rgba(251,146,60,0.3)",
    category: "market",
    badge: "Hot",
    contains: ["Live Feed", "Trending", "News Signal", "Heatmap", "Clusters"],
  },
  {
    id: "market-pulse",
    label: "Token Intel",
    description: "Deep-dive any token — vitals, pairs, whale watch, TX feed & charts",
    detail: "Market Pulse, Pairs, Whales, TX Feed, Charts",
    Icon: Activity,
    gradient: "from-purple-400 to-violet-500",
    glowColor: "rgba(167,139,250,0.3)",
    category: "market",
    contains: ["Vitals", "Pairs", "Whales", "TX Feed", "Charts"],
  },
  {
    id: "swap",
    label: "Swap",
    description: "Jupiter-routed swaps with live quotes & token search",
    detail: "Best execution across all Solana DEXs",
    Icon: Zap,
    gradient: "from-yellow-400 to-amber-500",
    glowColor: "rgba(250,204,21,0.3)",
    category: "trading",
  },
  {
    id: "listings",
    label: "Token Listings",
    description: "List & promote tokens — paste a CA, blockchain pulls all data & analysis",
    detail: "List Tokens, Price Data, Dev Wallet, Holder Analysis, AI Verdict",
    Icon: Star,
    gradient: "from-amber-400 to-orange-500",
    glowColor: "rgba(251,146,60,0.3)",
    category: "trading",
    badge: "New",
    contains: ["List", "Promote", "Analyze", "Dev Wallet"],
  },
  {
    id: "our-coin",
    label: "About OGScan",
    description: "Official token, roadmap, tech stack & community links",
    detail: "OG Token, Roadmap, Tech Infrastructure",
    Icon: Coins,
    gradient: "from-amber-300 to-yellow-500",
    glowColor: "rgba(252,211,77,0.3)",
    category: "project",
    contains: ["Token", "Roadmap", "Tech Stack"],
  },
];

const CATEGORIES: { id: ToolCategory | "all"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "all",        label: "All",        icon: Layers },
  { id: "forensics",  label: "Forensics",  icon: Shield },
  { id: "market",     label: "Market",     icon: TrendingUp },
  { id: "trading",    label: "Trading",    icon: Zap },
  { id: "project",    label: "Project",    icon: Sparkles },
];

interface ToolsHubProps {
  onNavigate: (tabId: string) => void;
}

/* ─── Tool Card ─── */
const ToolCard: React.FC<{ tool: ToolItem; onNavigate: (id: string) => void }> = ({ tool, onNavigate }) => (
  <button
    onClick={() => onNavigate(tool.id)}
    className="group relative flex items-start gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-left transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.05] active:scale-[0.98]"
    style={{ boxShadow: "0 0 0 0 transparent" }}
    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 12px 40px -8px ${tool.glowColor}`; }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 0 0 0 transparent"; }}
  >
    <div
      className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-xl transition-transform duration-200 group-hover:scale-110 group-hover:rotate-[-2deg]",
        tool.gradient,
      )}
    >
      <tool.Icon className="h-6 w-6 text-white drop-shadow-md" strokeWidth={2.2} />
    </div>

    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-black text-white/90 group-hover:text-white transition-colors tracking-tight">
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
      <p className="mt-1 text-[11px] leading-relaxed text-white/40 group-hover:text-white/55 transition-colors">
        {tool.description}
      </p>
      {tool.contains && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tool.contains.map(item => (
            <span key={item} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-bold text-white/20 uppercase tracking-wider">
              {item}
            </span>
          ))}
        </div>
      )}
    </div>

    <ArrowRight className="h-4 w-4 shrink-0 text-white/[0.06] transition-all duration-200 group-hover:text-white/30 group-hover:translate-x-0.5 mt-2" />
  </button>
);

/* ─── Main ToolsHub ─── */
const ToolsHub: React.FC<ToolsHubProps> = ({ onNavigate }) => {
  const categories: ToolCategory[] = ["forensics", "market", "trading", "project"];

  const CATEGORY_HEADERS: Record<ToolCategory, string> = {
    forensics: "Forensics & Scanning",
    market:    "Market Intelligence",
    trading:   "Trading",
    project:   "Project",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-og-lime/20 to-og-cyan/20 border border-og-lime/20">
          <Wrench className="h-5 w-5 text-og-lime" />
        </div>
        <div>
          <h1 className="text-lg font-black text-white tracking-tight">Tools</h1>
          <p className="text-[10px] text-white/30 font-medium">{TOOLS.length} integrated tools · consolidated for speed</p>
        </div>
      </div>

      {/* Tools by category */}
      {categories.map(cat => {
        const catTools = TOOLS.filter(t => t.category === cat);
        if (catTools.length === 0) return null;
        return (
          <div key={cat}>
            <div className="mb-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/20">{CATEGORY_HEADERS[cat]}</span>
              <div className="h-px flex-1 bg-gradient-to-l from-white/[0.06] to-transparent" />
            </div>
            <div className="grid gap-2.5">
              {catTools.map(tool => (
                <ToolCard key={tool.id} tool={tool} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        );
      })}

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
