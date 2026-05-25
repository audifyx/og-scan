/**
 * ToolsHub — Icon grid of all OG Scan tools.
 * Clean square tiles with colored icon + label. No grey rectangles.
 */
import React, { useState } from "react";
import {
  Search, Target, Rss, Activity, Flame, Radar, Rocket,
  Wallet, Zap, Cpu, Radio, Coins, Map, Palette,
  Wrench, TrendingUp, LayoutGrid, BarChart3, LineChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ToolCategory = "forensics" | "market" | "trading" | "project";

interface ToolItem {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  gradient: string;        // tailwind gradient for the icon circle
  glowColor: string;       // shadow glow
  category: ToolCategory;
}

const TOOLS: ToolItem[] = [
  { id: "scanner", label: "Scanner", Icon: Search, gradient: "from-emerald-500 to-green-400", glowColor: "shadow-emerald-500/25", category: "forensics" },
  { id: "og-finder", label: "OG Finder", Icon: TrendingUp, gradient: "from-lime-400 to-emerald-400", glowColor: "shadow-lime-400/25", category: "forensics" },
  { id: "snipe-feed", label: "Launch Radar", Icon: Target, gradient: "from-cyan-400 to-blue-500", glowColor: "shadow-cyan-400/25", category: "forensics" },
  { id: "migrations", label: "Migrations", Icon: Rocket, gradient: "from-amber-400 to-orange-500", glowColor: "shadow-amber-400/25", category: "forensics" },
  { id: "feed", label: "Market Feed", Icon: Rss, gradient: "from-green-400 to-emerald-500", glowColor: "shadow-green-400/25", category: "market" },
  { id: "market-pulse", label: "Pulse", Icon: Activity, gradient: "from-cyan-400 to-teal-400", glowColor: "shadow-cyan-400/25", category: "market" },
  { id: "trending", label: "Trending", Icon: Flame, gradient: "from-orange-400 to-red-500", glowColor: "shadow-orange-400/25", category: "market" },
  { id: "pairs", label: "Pairs", Icon: Radar, gradient: "from-blue-400 to-indigo-500", glowColor: "shadow-blue-400/25", category: "market" },
  { id: "whales", label: "Whales", Icon: Wallet, gradient: "from-purple-400 to-violet-500", glowColor: "shadow-purple-400/25", category: "market" },
  { id: "tx-feed", label: "Tx Feed", Icon: BarChart3, gradient: "from-teal-400 to-cyan-500", glowColor: "shadow-teal-400/25", category: "market" },
  { id: "news-signal", label: "News", Icon: Radio, gradient: "from-lime-400 to-green-500", glowColor: "shadow-lime-400/25", category: "market" },
  { id: "charts", label: "Charts", Icon: LineChart, gradient: "from-indigo-400 to-violet-500", glowColor: "shadow-indigo-400/25", category: "trading" },
  { id: "swap", label: "Swap", Icon: Zap, gradient: "from-yellow-400 to-amber-500", glowColor: "shadow-yellow-400/25", category: "trading" },
  { id: "discover", label: "LaunchPad", Icon: Rocket, gradient: "from-pink-400 to-rose-500", glowColor: "shadow-pink-400/25", category: "trading" },
  { id: "memes", label: "Memes", Icon: Palette, gradient: "from-fuchsia-400 to-pink-500", glowColor: "shadow-fuchsia-400/25", category: "project" },
  { id: "our-coin", label: "OG Token", Icon: Coins, gradient: "from-amber-300 to-yellow-500", glowColor: "shadow-amber-300/25", category: "project" },
  { id: "roadmap", label: "Roadmap", Icon: Map, gradient: "from-sky-400 to-blue-500", glowColor: "shadow-sky-400/25", category: "project" },
  { id: "tech", label: "Tech Stack", Icon: Cpu, gradient: "from-slate-300 to-zinc-400", glowColor: "shadow-slate-300/15", category: "project" },
];

const CATEGORIES: { id: ToolCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "forensics", label: "🔍 Forensics" },
  { id: "market", label: "📊 Market" },
  { id: "trading", label: "⚡ Trading" },
  { id: "project", label: "🎯 Project" },
];

interface ToolsHubProps {
  onNavigate: (tabId: string) => void;
}

const ToolsHub: React.FC<ToolsHubProps> = ({ onNavigate }) => {
  const [filter, setFilter] = useState<ToolCategory | "all">("all");
  const filtered = filter === "all" ? TOOLS : TOOLS.filter((t) => t.category === filter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
          <Wrench className="h-5 w-5 text-background" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">Tools</h1>
          <p className="text-[11px] text-white/35 font-medium">Forensics · Market · Trading</p>
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={cn(
              "shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all",
              filter === c.id
                ? "bg-white/15 text-white shadow-[0_0_10px_rgba(255,255,255,0.05)]"
                : "bg-white/[0.04] text-white/40 hover:bg-white/[0.07] hover:text-white/60",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Tool grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {filtered.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onNavigate(tool.id)}
            className="group flex flex-col items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all hover:border-white/[0.12] hover:bg-white/[0.04] hover:scale-[1.03] active:scale-[0.97]"
          >
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg transition-transform group-hover:scale-110",
                tool.gradient,
                tool.glowColor,
              )}
            >
              <tool.Icon className="h-5 w-5 text-white drop-shadow" />
            </div>
            <span className="text-[11px] font-bold text-white/70 group-hover:text-white transition-colors text-center leading-tight">
              {tool.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ToolsHub;
