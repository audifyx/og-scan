/**
 * ToolsHub — Clean square icon grid layout for OG Scan tools.
 * Compact squares with large icons. Fully theme-aware.
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
  { bg: "hsl(var(--primary) / 0.2)", border: "hsl(var(--primary) / 0.4)", text: "hsl(var(--primary))", icon: "hsl(var(--primary))" },
  { bg: "hsl(var(--secondary) / 0.2)", border: "hsl(var(--secondary) / 0.4)", text: "hsl(var(--secondary))", icon: "hsl(var(--secondary))" },
  { bg: "hsl(var(--accent) / 0.2)", border: "hsl(var(--accent) / 0.4)", text: "hsl(var(--accent))", icon: "hsl(var(--accent))" },
  { bg: "hsl(var(--ring) / 0.15)", border: "hsl(var(--ring) / 0.3)", text: "hsl(var(--ring))", icon: "hsl(var(--ring))" },
];

interface ToolsHubProps {
  onNavigate: (tabId: string) => void;
}

const ToolCard: React.FC<{ tool: ToolItem; onNavigate: (id: string) => void }> = ({ tool, onNavigate }) => {
  const color = THEME_COLORS[tool.colorIndex];
  const [hovering, setHovering] = useState(false);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Square Icon Button */}
      <button
        type="button"
        onClick={() => onNavigate(tool.id)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className="group relative flex items-center justify-center transition-all duration-300 rounded-lg"
        style={{
          width: "60px",
          height: "60px",
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: "1.5px",
          transform: hovering ? "translateY(-3px) scale(1.08)" : "translateY(0) scale(1)",
          boxShadow: hovering ? `0 8px 20px ${color.text}30` : "0 2px 8px rgba(0,0,0,0.2)",
        }}
      >
        {/* Glow on hover */}
        {hovering && (
          <div
            className="pointer-events-none absolute inset-0 rounded-lg blur-xl opacity-30"
            style={{ backgroundColor: color.text }}
          />
        )}

        {/* Large Icon */}
        <div
          className="relative flex items-center justify-center transition-transform duration-300"
          style={{ color: color.icon, transform: hovering ? "scale(1.15)" : "scale(1)" }}
        >
          <tool.Icon className="h-8 w-8" strokeWidth={1.8} />
        </div>
      </button>

      {/* Label Below */}
      <span
        className="text-center text-[11px] font-bold leading-tight transition-colors duration-300"
        style={{ color: "hsl(var(--foreground))" }}
      >
        {tool.label.split(" ")[0]}
      </span>

      {/* Full Tooltip on Hover */}
      {hovering && (
        <div
          className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[9px] font-medium z-10 animate-fade-in"
          style={{ backgroundColor: "hsl(var(--card))", borderColor: color.border, color: "hsl(var(--foreground))" }}
        >
          {tool.tooltip}
        </div>
      )}
    </div>
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
    <div className="space-y-8 pb-8">
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
            <div className="flex flex-wrap gap-6 sm:gap-8">
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
