/**
 * ToolsHub — redesigned OG Scan tools page.
 * Modular layout: featured hero tool, search filter, and category-grouped cards
 * with progressive disclosure. Theme-aware. Preserves onNavigate(id) contract.
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
  accent: "primary" | "secondary";
  category: Category;
  badge?: string;
  featured?: boolean;
}

const TOOLS: ToolItem[] = [
  {
    id: "scanner", label: "Truth Scanner", category: "Forensics", featured: true,
    description: "Scan any mint for its OG verdict — a 4-tier explainable classification (OG / SAFE / RISKY / DANGEROUS) with confidence, rug score, clone lineage, dev wallet DNA, holder risk and bundle detection.",
    detail: "OG Verdict · Lifecycle · Share · History", Icon: ShieldCheck, accent: "primary", badge: "Core",
  },
  {
    id: "snipe-feed", label: "Launch Radar", category: "Discovery",
    description: "Fresh mints, migrations, repeat-dev flags, and snipe alerts in real time.",
    detail: "Launches · Migrations · Alerts", Icon: Target, accent: "secondary", badge: "Live",
  },
  {
    id: "feed", label: "Market Feed", category: "Discovery",
    description: "Trending tokens, whale moves, narrative clusters and news signals.",
    detail: "Trending · News · Heatmap", Icon: Rss, accent: "primary", badge: "Hot",
  },
  {
    id: "market-pulse", label: "Token Intel", category: "Analytics",
    description: "Open any token for vitals, whale watch, pairs and live TX flow.",
    detail: "Vitals · Whales · TX Feed", Icon: Activity, accent: "secondary",
  },
  {
    id: "swap", label: "Swap", category: "Trade",
    description: "Fast Jupiter-routed swaps with live quotes and clean execution.",
    detail: "Route · Quote · Confirm", Icon: Zap, accent: "primary",
  },
  {
    id: "listings", label: "Token Listings", category: "Discovery",
    description: "List and promote tokens with pulled data and AI analysis.",
    detail: "List · Analyze · Publish", Icon: Star, accent: "secondary", badge: "New",
  },
  {
    id: "our-coin", label: "About OGScan", category: "Info",
    description: "Official token info, roadmap, infrastructure and community.",
    detail: "Token · Roadmap · Infra", Icon: Coins, accent: "primary",
  },
];

const CATEGORY_ORDER: Category[] = ["Forensics", "Discovery", "Analytics", "Trade", "Info"];
const CATEGORY_ICON: Record<Category, React.ComponentType<{ className?: string }>> = {
  Forensics: ShieldCheck, Discovery: Compass, Analytics: BarChart3, Trade: Zap, Info: Coins,
};

interface ToolsHubProps {
  onNavigate: (tabId: string) => void;
}

const FeaturedCard: React.FC<{ tool: ToolItem; onNavigate: (id: string) => void }> = ({ tool, onNavigate }) => (
  <button
    type="button"
    onClick={() => onNavigate(tool.id)}
    className="glass-card group relative w-full overflow-hidden border border-primary/30 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50"
  >
    <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary blur-3xl opacity-20 transition-opacity group-hover:opacity-30" />
    <div className="relative flex items-start gap-4">
      <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl border border-primary/40 bg-primary/15">
        <tool.Icon className="h-7 w-7 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-lg font-black text-white">{tool.label}</p>
          {tool.badge && <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary">{tool.badge}</span>}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-white/55">{tool.description}</p>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-primary/70">{tool.detail}</p>
      </div>
      <ArrowUpRight className="h-5 w-5 flex-none text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </div>
  </button>
);

const ToolCard: React.FC<{ tool: ToolItem; onNavigate: (id: string) => void }> = ({ tool, onNavigate }) => {
  const isPrimary = tool.accent === "primary";
  return (
    <button
      type="button"
      onClick={() => onNavigate(tool.id)}
      className={cn(
        "glass-card group relative overflow-hidden text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97]",
        isPrimary ? "hover:border-primary/40" : "hover:border-secondary/40",
      )}
    >
      <div className={cn("pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-20 transition-opacity duration-300 group-hover:opacity-35", isPrimary ? "bg-primary" : "bg-secondary")} />
      <div className="relative flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", isPrimary ? "border-primary/30 bg-primary/15" : "border-secondary/30 bg-secondary/15")}>
            <tool.Icon className={cn("h-5 w-5", isPrimary ? "text-primary" : "text-secondary")} />
          </div>
          {tool.badge ? (
            <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider", isPrimary ? "border-primary/30 bg-primary/10 text-primary" : "border-secondary/30 bg-secondary/10 text-secondary")}>{tool.badge}</span>
          ) : (
            <ArrowUpRight className="h-3.5 w-3.5 text-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </div>
        <div>
          <p className="text-[13px] font-black leading-tight text-white">{tool.label}</p>
          <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-white/45">{tool.description}</p>
        </div>
        <p className={cn("text-[9px] font-bold uppercase tracking-wider", isPrimary ? "text-primary/60" : "text-secondary/60")}>{tool.detail}</p>
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
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div>
        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
          <span className="h-px w-10 bg-primary" /> TOOLS
        </div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Everything you need to scan, discover, and trade</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/50">One command hub for OG Scan's forensic scanner, discovery feeds, token intelligence, and trading.</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-white/50">No tools match “{query}”.</p>
      )}

      {/* Featured */}
      {featured && !query && <FeaturedCard tool={featured} onNavigate={onNavigate} />}

      {/* Grouped categories */}
      {grouped.map(({ cat, items }) => {
        const CatIcon = CATEGORY_ICON[cat];
        return (
          <section key={cat} className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/60">
              <CatIcon className="h-3.5 w-3.5" /> {cat}
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {items.map((tool) => <ToolCard key={tool.id} tool={tool} onNavigate={onNavigate} />)}
            </div>
          </section>
        );
      })}

      {/* When searching, show the featured tool inline within results too */}
      {featured && query && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <ToolCard tool={featured} onNavigate={onNavigate} />
        </div>
      )}
    </div>
  );
};

export default ToolsHub;
