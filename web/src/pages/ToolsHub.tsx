/**
 * ToolsHub — Grouped access to all OG Scan analysis & trading tools.
 * Organizes tools into categories with cards instead of a long list.
 */
import React, { useState } from "react";
import {
  Search, Target, Rss, Activity, Flame, Radar, Rocket,
  Wallet, Zap, Cpu, Radio, Coins, Map, Palette,
  ChevronRight, Wrench, TrendingUp, LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ToolCategory = "forensics" | "market" | "trading" | "project";

interface ToolItem {
  id: string;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
  category: ToolCategory;
}

const TOOLS: ToolItem[] = [
  { id: "scanner", label: "Truth Scanner", description: "Full forensic scan — rug score, dev wallet, holder analysis", Icon: Search, accent: "lime", category: "forensics" },
  { id: "og-finder", label: "OG Finder", description: "First-mint proof, lineage, and dominance context", Icon: TrendingUp, accent: "lime", category: "forensics" },
  { id: "snipe-feed", label: "Launch Radar", description: "New coins, repeat creators, migration timing", Icon: Target, accent: "cyan", category: "forensics" },
  { id: "migrations", label: "Migrations", description: "Pump.fun → DEX breakout tracking", Icon: Rocket, accent: "gold", category: "forensics" },
  { id: "feed", label: "Market Feed", description: "Trending, pairs, whales, bundles, CTO analytics", Icon: Rss, accent: "lime", category: "market" },
  { id: "market-pulse", label: "Market Pulse", description: "Price, liquidity, holders, and market cap", Icon: Activity, accent: "cyan", category: "market" },
  { id: "trending", label: "Trending", description: "Live token momentum and catalyst discovery", Icon: Flame, accent: "cyan", category: "market" },
  { id: "pairs", label: "Pairs", description: "New pools and routing across Solana DEXes", Icon: Radar, accent: "cyan", category: "market" },
  { id: "whales", label: "Whales", description: "Holder concentration and whale structure", Icon: Wallet, accent: "white", category: "market" },
  { id: "tx-feed", label: "Tx Feed", description: "Live buy/sell tape for any token", Icon: Activity, accent: "cyan", category: "market" },
  { id: "news-signal", label: "News Signal", description: "Influencer mentions — find coins before the market reacts", Icon: Radio, accent: "lime", category: "market" },
  { id: "swap", label: "Swap", description: "Jupiter route quoting with scanner context", Icon: Zap, accent: "blue", category: "trading" },
  { id: "memes", label: "Memes", description: "Live meme feed — art, vibes, and degen culture", Icon: Palette, accent: "lime", category: "project" },
  { id: "our-coin", label: "Our Token", description: "Official OGScan coin CA, dev wallet, and chart links", Icon: Coins, accent: "gold", category: "project" },
  { id: "roadmap", label: "Roadmap", description: "The path from OGScan to full crypto-native platform", Icon: Map, accent: "cyan", category: "project" },
  { id: "tech", label: "Tech Stack", description: "Data pipeline powering forensics and live feeds", Icon: Cpu, accent: "white", category: "project" },
];

const CATEGORIES: { id: ToolCategory; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "forensics", label: "Forensics", Icon: Search },
  { id: "market", label: "Market Intel", Icon: TrendingUp },
  { id: "trading", label: "Trading", Icon: Zap },
  { id: "project", label: "Project & More", Icon: LayoutGrid },
];

const accentColor: Record<string, string> = {
  lime: "border-og-lime/20 bg-og-lime/5 text-og-lime",
  cyan: "border-og-cyan/20 bg-og-cyan/5 text-og-cyan",
  gold: "border-og-gold/20 bg-og-gold/5 text-og-gold",
  blue: "border-blue-400/20 bg-blue-400/5 text-blue-400",
  white: "border-white/15 bg-white/5 text-white/80",
};

interface ToolsHubProps {
  onNavigate: (tabId: string) => void;
}

const ToolsHub: React.FC<ToolsHubProps> = ({ onNavigate }) => {
  const [filter, setFilter] = useState<ToolCategory | "all">("all");

  const filtered = filter === "all" ? TOOLS : TOOLS.filter((t) => t.category === filter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Wrench className="h-5 w-5 text-og-cyan" />
          <h1 className="text-2xl font-black text-white">Tools</h1>
        </div>
        <p className="text-sm text-white/40">All forensic, market, and trading tools in one place</p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border",
            filter === "all"
              ? "bg-white/10 text-white border-white/20"
              : "bg-white/[0.03] text-white/30 border-white/[0.06] hover:bg-white/[0.06]",
          )}
        >
          All Tools
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border",
              filter === c.id
                ? "bg-white/10 text-white border-white/20"
                : "bg-white/[0.03] text-white/30 border-white/[0.06] hover:bg-white/[0.06]",
            )}
          >
            <c.Icon className="h-3 w-3" />
            {c.label}
          </button>
        ))}
      </div>

      {/* Tool cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onNavigate(tool.id)}
            className="group flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-left transition-all hover:bg-white/[0.05] hover:border-white/[0.12]"
          >
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", accentColor[tool.accent])}>
              <tool.Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-white group-hover:text-og-lime transition-colors">{tool.label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-white/15 group-hover:text-white/40 transition-colors" />
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-white/35">{tool.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ToolsHub;
