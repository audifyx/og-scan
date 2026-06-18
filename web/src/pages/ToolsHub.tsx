/**
 * ToolsHub — Theme-aware tools discovery page.
 * Fully respects user's theme settings. Glass-morphism cards with dynamic colors.
 * Featured hero tool, search filter, and category-grouped cards with progressive disclosure.
 */
import React, { useMemo, useState } from "react";
import {
  Search, Target, Rss, Activity, Zap, Coins, Star, ArrowUpRight,
  ShieldCheck, Compass, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type Category = "Forensics" | "Discovery" | "Analytics" | "Trade" | "Info";

interface ToolItem {
  id: string;
  label: string;
  description: string;
  detail: string;
  Icon: React.ComponentType<{ className?: string }>;
  colorIndex: number; // 0-4 for different accent colors
  category: Category;
  badge?: string;
  featured?: boolean;
}

const TOOLS: ToolItem[] = [
  {
    id: "scanner", label: "Truth Scanner", category: "Forensics", featured: true,
    description: "Scan any mint for its OG verdict — a 4-tier explainable classification (OG / SAFE / RISKY / DANGEROUS) with confidence, rug score, clone lineage, dev wallet DNA, holder risk and bundle detection.",
    detail: "OG Verdict · Lifecycle · Share · History", Icon: ShieldCheck, colorIndex: 0, badge: "Core",
  },
  {
    id: "snipe-feed", label: "Launch Radar", category: "Discovery",
    description: "Fresh mints, migrations, repeat-dev flags, and snipe alerts in real time.",
    detail: "Launches · Migrations · Alerts", Icon: Target, colorIndex: 1, badge: "Live",
  },
  {
    id: "feed", label: "Market Feed", category: "Discovery",
    description: "Trending tokens, whale moves, narrative clusters and news signals.",
    detail: "Trending · News · Heatmap", Icon: Rss, colorIndex: 2, badge: "Hot",
  },
  {
    id: "market-pulse", label: "Token Intel", category: "Analytics",
    description: "Open any token for vitals, whale watch, pairs and live TX flow.",
    detail: "Vitals · Whales · TX Feed", Icon: Activity, colorIndex: 3,
  },
  {
    id: "swap", label: "Swap", category: "Trade",
    description: "Fast Jupiter-routed swaps with live quotes and clean execution.",
    detail: "Route · Quote · Confirm", Icon: Zap, colorIndex: 0,
  },
  {
    id: "listings", label: "Token Listings", category: "Discovery",
    description: "List and promote tokens with pulled data and AI analysis.",
    detail: "List · Analyze · Publish", Icon: Star, colorIndex: 2, badge: "New",
  },
  {
    id: "our-coin", label: "About OGScan", category: "Info",
    description: "Official token info, roadmap, infrastructure and community.",
    detail: "Token · Roadmap · Infra", Icon: Coins, colorIndex: 1,
  },
];

const CATEGORY_ORDER: Category[] = ["Forensics", "Discovery", "Analytics", "Trade", "Info"];
const CATEGORY_ICON: Record<Category, React.ComponentType<{ className?: string }>> = {
  Forensics: ShieldCheck, Discovery: Compass, Analytics: BarChart3, Trade: Zap, Info: Coins,
};

// Theme color accent slots that cycle through - uses CSS variables for full theme support
const THEME_ACCENTS = [
  { bg: "hsl(var(--primary) / 0.12)", border: "hsl(var(--primary) / 0.25)", text: "hsl(var(--primary))", icon: "hsl(var(--primary) / 0.8)" },
  { bg: "hsl(var(--secondary) / 0.12)", border: "hsl(var(--secondary) / 0.25)", text: "hsl(var(--secondary))", icon: "hsl(var(--secondary) / 0.8)" },
  { bg: "hsl(var(--accent) / 0.12)", border: "hsl(var(--accent) / 0.25)", text: "hsl(var(--accent))", icon: "hsl(var(--accent) / 0.8)" },
  { bg: "hsl(var(--ring) / 0.1)", border: "hsl(var(--ring) / 0.2)", text: "hsl(var(--ring))", icon: "hsl(var(--ring) / 0.7)" },
  { bg: "hsl(var(--foreground) / 0.08)", border: "hsl(var(--foreground) / 0.15)", text: "hsl(var(--foreground))", icon: "hsl(var(--foreground) / 0.7)" },
];

interface ToolsHubProps {
  onNavigate: (tabId: string) => void;
}

const FeaturedCard: React.FC<{ tool: ToolItem; onNavigate: (id: string) => void }> = ({ tool, onNavigate }) => {
  const accent = THEME_ACCENTS[tool.colorIndex];
  return (
    <button
      type="button"
      onClick={() => onNavigate(tool.id)}
      className="glass-card group relative w-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      style={{
        borderColor: accent.border,
        borderWidth: "1px",
      }}
    >
      <div 
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl opacity-15 transition-opacity group-hover:opacity-25"
        style={{ backgroundColor: accent.text }}
      />
      <div className="relative flex items-start gap-4 p-6">
        <div 
          className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl border transition-transform group-hover:scale-110"
          style={{
            backgroundColor: accent.bg,
            borderColor: accent.border,
          }}
        >
          <tool.Icon className="h-8 w-8" style={{ color: accent.icon }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-lg font-black text-foreground">{tool.label}</p>
            {tool.badge && (
              <span 
                className="rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                style={{
                  backgroundColor: accent.bg,
                  borderColor: accent.border,
                  color: accent.text,
                }}
              >
                {tool.badge}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/60">{tool.description}</p>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wider opacity-70" style={{ color: accent.text }}>{tool.detail}</p>
        </div>
        <ArrowUpRight className="h-5 w-5 flex-none text-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </button>
  );
};

const ToolCard: React.FC<{ tool: ToolItem; onNavigate: (id: string) => void }> = ({ tool, onNavigate }) => {
  const accent = THEME_ACCENTS[tool.colorIndex];
  
  return (
    <button
      type="button"
      onClick={() => onNavigate(tool.id)}
      className="glass-card group relative overflow-hidden text-left transition-all duration-300 hover:-translate-y-1 active:scale-[0.97]"
      style={{
        borderColor: accent.border,
        borderWidth: "1px",
      }}
    >
      <div 
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-12 transition-opacity duration-300 group-hover:opacity-20"
        style={{ backgroundColor: accent.text }}
      />
      <div className="relative flex flex-col gap-3.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <div 
            className="flex h-12 w-12 items-center justify-center rounded-xl border transition-transform group-hover:scale-105"
            style={{
              backgroundColor: accent.bg,
              borderColor: accent.border,
            }}
          >
            <tool.Icon className="h-5 w-5" style={{ color: accent.icon }} />
          </div>
          {tool.badge ? (
            <span 
              className="rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider whitespace-nowrap"
              style={{
                backgroundColor: accent.bg,
                borderColor: accent.border,
                color: accent.text,
              }}
            >
              {tool.badge}
            </span>
          ) : (
            <ArrowUpRight className="h-3.5 w-3.5 text-foreground/20 opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </div>
        <div>
          <p className="text-sm font-black leading-tight text-foreground">{tool.label}</p>
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-foreground/50">{tool.description}</p>
        </div>
        <p className="text-[9px] font-bold uppercase tracking-wider opacity-60" style={{ color: accent.text }}>{tool.detail}</p>
      </div>
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
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q));
  }, [query]);

  const featured = filtered.find((t) => t.featured);
  const grouped = CATEGORY_ORDER
    .map((cat) => ({ cat, items: filtered.filter((t) => t.category === cat && !t.featured) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div>
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4em]">
          <div className="h-px w-10" style={{ backgroundColor: "hsl(var(--primary))" }} />
          <span style={{ color: "hsl(var(--primary))" }}>Tools</span>
        </div>
        <h2 className="font-display text-3xl font-black tracking-tight text-foreground sm:text-4xl">Everything you need to scan, discover, and trade</h2>
        <p className="mt-2 max-w-2xl text-sm text-foreground/50">One command hub for OG Scan's forensic scanner, discovery feeds, token intelligence, and trading.</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-foreground/50">No tools match "{query}".</p>
      )}

      {/* Featured */}
      {featured && !query && <FeaturedCard tool={featured} onNavigate={onNavigate} />}

      {/* Grouped categories */}
      {grouped.map(({ cat, items }) => {
        const CatIcon = CATEGORY_ICON[cat];
        return (
          <section key={cat} className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground/60">
              <CatIcon className="h-3.5 w-3.5" /> {cat}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((tool) => <ToolCard key={tool.id} tool={tool} onNavigate={onNavigate} />)}
            </div>
          </section>
        );
      })}

      {/* When searching, show the featured tool inline within results too */}
      {featured && query && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <ToolCard tool={featured} onNavigate={onNavigate} />
        </div>
      )}
    </div>
  );
};

export default ToolsHub;
