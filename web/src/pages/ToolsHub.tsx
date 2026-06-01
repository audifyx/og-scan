/**
 * ToolsHub — Compact, theme-aware tool picker for OG Scan.
 * No hardcoded colors. Uses --primary / --secondary CSS vars.
 */
import React from "react";
import {
  Search, Target, Rss, Activity,
  Zap, Coins, Star, Shield, TrendingUp,
  Sparkles, Layers, ScanSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolItem {
  id: string;
  label: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "secondary";
}

const TOOLS: ToolItem[] = [
  { id: "scanner",      label: "Truth Scanner",   desc: "Rug score, dev wallet DNA, bundle detection",  Icon: Search,     accent: "primary" },
  { id: "snipe-feed",   label: "Launch Radar",     desc: "Fresh mints, migrations, snipe alerts",        Icon: Target,     accent: "secondary" },
  { id: "feed",         label: "Market Feed",      desc: "Trending tokens, whale moves, narratives",     Icon: Rss,        accent: "primary" },
  { id: "market-pulse", label: "Token Intel",      desc: "Vitals, whale watch, pairs, TX flow",          Icon: Activity,   accent: "secondary" },
  { id: "swap",         label: "Swap",             desc: "Jupiter-routed swaps with live quotes",        Icon: Zap,        accent: "primary" },
  { id: "listings",     label: "Token Listings",   desc: "List and promote tokens with AI analysis",     Icon: Star,       accent: "secondary" },
  { id: "our-coin",     label: "About OGScan",     desc: "Official token info, roadmap, infra",          Icon: Coins,      accent: "primary" },
];

interface ToolsHubProps {
  onNavigate: (tabId: string) => void;
}

const ToolsHub: React.FC<ToolsHubProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-6 pb-4">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          <Layers className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Tools</h1>
          <p className="text-[10px] text-white/35 font-semibold uppercase tracking-widest">OG Scan Suite</p>
        </div>
      </div>

      {/* ── Compact pill grid ── */}
      <div className="flex flex-wrap justify-center gap-2.5 px-1">
        {TOOLS.map((tool) => {
          const isPrimary = tool.accent === "primary";
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onNavigate(tool.id)}
              className={cn(
                "group inline-flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left transition-all duration-200 active:scale-95",
                isPrimary
                  ? "border-primary/25 bg-primary/[0.07] hover:border-primary/45 hover:bg-primary/[0.13] hover:shadow-[0_0_20px_-8px_hsl(var(--primary)/0.5)]"
                  : "border-secondary/25 bg-secondary/[0.07] hover:border-secondary/45 hover:bg-secondary/[0.13] hover:shadow-[0_0_20px_-8px_hsl(var(--secondary)/0.5)]",
              )}
            >
              <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                isPrimary ? "bg-primary/20" : "bg-secondary/20",
              )}>
                <tool.Icon className={cn(
                  "h-4 w-4",
                  isPrimary ? "text-primary" : "text-secondary",
                )} />
              </div>
              <div className="min-w-0">
                <p className={cn(
                  "text-[12px] font-black leading-tight",
                  isPrimary ? "text-primary" : "text-secondary",
                )}>{tool.label}</p>
                <p className="text-[10px] text-white/40 truncate max-w-[140px]">{tool.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
};

export default ToolsHub;
