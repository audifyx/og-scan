/**
 * ToolsHub — Premium square icon grid layout for OG Scan tools.
 * Clean, no overlapping text. Each tool is a square card with icon.
 * Fully theme-aware with CSS variables.
 */
import React, { useMemo, useState } from "react";
import {
  Search, Target, Rss, Activity, Zap, Coins, Star,
  ShieldCheck, Compass, BarChart3, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";

type Category = "Forensics" | "Discovery" | "Analytics" | "Trade" | "Info";

interface ToolItem {
  id: string;
  label: string;
  tooltip: string;
  Icon: React.ComponentType<{ className?: string }>;
  colorIndex: number;
  category: Category;
}

const TOOLS: ToolItem[] = [
  { id: "scanner", label: "Truth Scanner", tooltip: "Scan any mint for OG verdict", Icon: ShieldCheck, colorIndex: 0, category: "Forensics" },
  { id: "snipe-feed", label: "Launch Radar", tooltip: "Fresh mints & migrations live", Icon: Target, colorIndex: 1, category: "Discovery" },
  { id: "feed", label: "Market Feed", tooltip: "Trending tokens & whale moves", Icon: Rss, colorIndex: 2, category: "Discovery" },
  { id: "market-pulse", label: "Token Intel", tooltip: "Open any token for vitals", Icon: Activity, colorIndex: 3, category: "Analytics" },
  { id: "swap", label: "Swap", tooltip: "Fast Jupiter-routed swaps", Icon: Zap, colorIndex: 0, category: "Trade" },
  { id: "listings", label: "Token Listings", tooltip: "List & promote tokens", Icon: Star, colorIndex: 2, category: "Discovery" },
  { id: "our-coin", label: "About OGScan", tooltip: "Official token & roadmap", Icon: Coins, colorIndex: 1, category: "Info" },
];

const CATEGORY_ORDER: Category[] = ["Forensics", "Discovery", "Analytics", "Trade", "Info"];
const CATEGORY_ICON: Record<Category, React.ComponentType<{ className?: string }>> = {
  Forensics: ShieldCheck, Discovery: Compass, Analytics: BarChart3, Trade: Zap, Info: Coins,
};

const THEME_COLORS = [
  { bg: "hsl(var(--primary) / 0.15)", border: "hsl(var(--primary) / 0.3)", text: "hsl(var(--primary))", icon: "hsl(var(--primary))" },
  { bg: "hsl(var(--secondary) / 0.15)", border: "hsl(var(--secondary) / 0.3)", text: "hsl(var(--secondary))", icon: "hsl(var(--secondary))" },
  { bg: "hsl(var(--accent) / 0.15)", border: "hsl(var(--accent) / 0.3)", text: "hsl(var(--accent))", icon: "hsl(var(--accent))" },
  { bg: "hsl(var(--ring) / 0.12)", border: "hsl(var(--ring) / 0.25)", text: "hsl(var(--ring))", icon: "hsl(var(--ring))" },
];

interface ToolsHubProps {
  onNavigate: (tabId: string) => void;
}

const ToolCard: React.FC<{ tool: ToolItem; onNavigate: (id: string) => void }> = ({ tool, onNavigate }) => {
  const color = THEME_COLORS[tool.colorIndex];
  const [hovering, setHovering] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onNavigate(tool.id)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="group relative flex flex-col items-center justify-center gap-2 rounded-2xl transition-all duration-300"
      style={{
        aspectRatio: "1 / 1",
        backgroundColor: color.bg,
        borderColor: color.border,
        borderWidth: "1.5px",
        transform: hovering ? "translateY(-4px) scale(1.02)" : "translateY(0) scale(1)",
        boxShadow: hovering ? `0 12px 24px ${color.text}20` : "0 4px 12px rgba(0,0,0,0.2)",
      }}
    >
      {/* Hover glow effect */}
      {hovering && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl blur-2xl opacity-20"
          style={{ backgroundColor: color.text }}
        />
      )}

      {/* Icon */}
      <div
        className="relative flex h-12 w-12 items-center justify-center transition-transform duration-300 group-hover:scale-110"
        style={{ color: color.icon }}
      >
        <tool.Icon className="h-7 w-7" strokeWidth={1.5} />
      </div>

      {/* Label */}
      <span
        className="relative text-center text-xs font-bold leading-tight transition-colors duration-300"
        style={{ color: "hsl(var(--foreground))" }}
      >
        {tool.label}
      </span>

      {/* Tooltip on hover */}
      {hovering && (
        <div className="pointer-events-none absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border px-3 py-2 text-[10px] font-medium animate-fade-in" style={{ backgroundColor: "hsl(var(--card))", borderColor: color.border, color: "hsl(var(--foreground))" }}>
          {tool.tooltip}
        </div>
      )}
    </button>
  );
};

const ToolsHub: React.FC<ToolsHubProps> = ({ onNavigate }) => {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOLS;
    return TOOLS.filter((t) =>
      t.label.toLowerCase().includes(q) ||
      t.tooltip.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  }, [query]);

  const grouped = CATEGORY_ORDER
    .map((cat) => ({ cat, items: filtered.filter((t) => t.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-10 pb-8">
      {/* Header */}
      <div>
        <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4em]">
          <div className="h-px w-10" style={{ backgroundColor: "hsl(var(--primary))" }} />
          <span style={{ color: "hsl(var(--primary))" }}>Tools & Scanners</span>
        </div>
        <h1 className="font-display text-4xl font-black tracking-tight text-foreground">
          Investigation Command Center
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-foreground/55">
          Forensic scanners, discovery feeds, token intelligence, and trading tools — all in one place.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools…"
          className="pl-12 py-2.5"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/60 transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-foreground/50">No tools match "{query}"</p>
        </div>
      )}

      {/* Tools Grid by Category */}
      {grouped.map(({ cat, items }) => {
        const CatIcon = CATEGORY_ICON[cat];
        return (
          <section key={cat} className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground/60">
              <CatIcon className="h-4 w-4" /> {cat}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((tool) => (
                <ToolCard key={tool.id} tool={tool} onNavigate={onNavigate} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default ToolsHub;
