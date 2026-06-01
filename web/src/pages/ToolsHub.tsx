/**
 * ToolsHub — Compact square card grid for OG Scan tools.
 * Same card layout as before but smaller and fully theme-aware.
 */
import React from "react";
import {
  Search, Target, Rss, Activity,
  Zap, Coins, Star, ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolItem {
  id: string;
  label: string;
  description: string;
  detail: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "secondary";
  badge?: string;
}

const TOOLS: ToolItem[] = [
  {
    id: "scanner",
    label: "Truth Scanner",
    description: "Rug score, dev wallet DNA, holder risk, bundle detection.",
    detail: "OG Finder · Scan History · Compare",
    Icon: Search,
    accent: "primary",
    badge: "Popular",
  },
  {
    id: "snipe-feed",
    label: "Launch Radar",
    description: "Fresh mints, migrations, repeat dev flags, snipe alerts.",
    detail: "Launches · Migrations · Alerts",
    Icon: Target,
    accent: "secondary",
    badge: "Live",
  },
  {
    id: "feed",
    label: "Market Feed",
    description: "Trending tokens, whale moves, narratives, news signals.",
    detail: "Trending · News · Heatmap",
    Icon: Rss,
    accent: "primary",
    badge: "Hot",
  },
  {
    id: "market-pulse",
    label: "Token Intel",
    description: "Open a token and get vitals, whale watch, pairs, TX flow.",
    detail: "Vitals · Whales · TX Feed",
    Icon: Activity,
    accent: "secondary",
  },
  {
    id: "swap",
    label: "Swap",
    description: "Fast Jupiter-routed swaps with live quotes and clean execution.",
    detail: "Route · Quote · Confirm",
    Icon: Zap,
    accent: "primary",
  },
  {
    id: "listings",
    label: "Token Listings",
    description: "List and promote tokens with pulled data and AI analysis.",
    detail: "List · Analyze · Publish",
    Icon: Star,
    accent: "secondary",
    badge: "New",
  },
  {
    id: "our-coin",
    label: "About OGScan",
    description: "Official token info, roadmap, infrastructure, and community.",
    detail: "Token · Roadmap · Infra",
    Icon: Coins,
    accent: "primary",
  },
];

interface ToolsHubProps {
  onNavigate: (tabId: string) => void;
}

const ToolCard: React.FC<{ tool: ToolItem; onNavigate: (id: string) => void }> = ({ tool, onNavigate }) => {
  const isPrimary = tool.accent === "primary";
  return (
    <button
      type="button"
      onClick={() => onNavigate(tool.id)}
      className={cn(
        "group relative overflow-hidden rounded-[22px] border text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97]",
        isPrimary
          ? "border-primary/20 bg-primary/[0.06] hover:border-primary/40 hover:bg-primary/[0.10]"
          : "border-secondary/20 bg-secondary/[0.06] hover:border-secondary/40 hover:bg-secondary/[0.10]",
      )}
    >
      {/* ambient glow blob */}
      <div className={cn(
        "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-20 transition-opacity duration-300 group-hover:opacity-35",
        isPrimary ? "bg-primary" : "bg-secondary",
      )} />

      <div className="relative p-4 flex flex-col gap-3">
        {/* icon + badge row */}
        <div className="flex items-start justify-between gap-2">
          <div className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl border",
            isPrimary
              ? "border-primary/30 bg-primary/15"
              : "border-secondary/30 bg-secondary/15",
          )}>
            <tool.Icon className={cn(
              "h-5 w-5",
              isPrimary ? "text-primary" : "text-secondary",
            )} />
          </div>
          {tool.badge ? (
            <span className={cn(
              "rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
              isPrimary
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-secondary/30 bg-secondary/10 text-secondary",
            )}>
              {tool.badge}
            </span>
          ) : (
            <ArrowUpRight className="h-3.5 w-3.5 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>

        {/* title + desc */}
        <div>
          <p className="text-[13px] font-black text-white leading-tight">{tool.label}</p>
          <p className="mt-1 text-[10px] text-white/45 leading-relaxed line-clamp-2">{tool.description}</p>
        </div>

        {/* detail tags */}
        <p className={cn(
          "text-[9px] font-bold uppercase tracking-wider",
          isPrimary ? "text-primary/60" : "text-secondary/60",
        )}>
          {tool.detail}
        </p>
      </div>
    </button>
  );
};

const ToolsHub: React.FC<ToolsHubProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-4 pb-4">
      <div className="grid grid-cols-2 gap-3">
        {TOOLS.map(tool => (
          <ToolCard key={tool.id} tool={tool} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
};

export default ToolsHub;
