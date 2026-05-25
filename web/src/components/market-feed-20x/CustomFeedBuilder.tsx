/**
 * CustomFeedBuilder — Create custom feeds with layered filters.
 * "Show me tokens where LP > $50k AND trending AND whale bought AND not a copy"
 * Wired to: Jupiter trending + top traded APIs. Fetches & filters real token data.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { Filter, Plus, X, Save, Trash2, Check, Play, Pause, SlidersHorizontal, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { jupTrending, jupTopTraded, fmtUsd, type JupTokenInfo } from "@/lib/og";

interface FeedFilter {
  field: string;
  operator: ">" | "<" | "=" | "!=" | "contains" | "between";
  value: string | number;
  value2?: number;
  label: string;
}

interface CustomFeed {
  id: string;
  name: string;
  filters: FeedFilter[];
  createdAt: string;
  enabled: boolean;
  matchCount: number;
}

interface TokenResult {
  mint: string;
  symbol: string;
  name: string;
  logoURI?: string;
  mcap: number;
  liquidity: number;
  volume24h: number;
  priceChange24h: number;
  priceChange1h: number;
  holders: number;
  riskScore: number;
  mintRevoked: boolean;
  isVerified: boolean;
}

interface Props {
  onApplyFilters?: (filters: FeedFilter[]) => void;
  onSelectMint?: (mint: string) => void;
}

const FIELD_OPTIONS = [
  { value: "liquidity", label: "Liquidity ($)", type: "number" },
  { value: "mcap", label: "Market Cap ($)", type: "number" },
  { value: "volume24h", label: "24h Volume ($)", type: "number" },
  { value: "priceChange24h", label: "24h Change (%)", type: "number" },
  { value: "priceChange1h", label: "1h Change (%)", type: "number" },
  { value: "holders", label: "Holder Count", type: "number" },
  { value: "riskScore", label: "Risk Score", type: "number" },
  { value: "mintRevoked", label: "Mint Revoked", type: "boolean" },
  { value: "isVerified", label: "Is Verified", type: "boolean" },
];

const PRESETS: Array<{ name: string; filters: FeedFilter[] }> = [
  {
    name: "💎 Safe & Growing",
    filters: [
      { field: "liquidity", operator: ">", value: 50000, label: "LP > $50k" },
      { field: "riskScore", operator: "<", value: 40, label: "Risk < 40" },
      { field: "holders", operator: ">", value: 100, label: "Holders > 100" },
      { field: "mintRevoked", operator: "=", value: "true", label: "Mint Revoked" },
    ],
  },
  {
    name: "🚀 Hot & New",
    filters: [
      { field: "priceChange1h", operator: ">", value: 10, label: "1h Change > 10%" },
      { field: "liquidity", operator: ">", value: 10000, label: "LP > $10k" },
    ],
  },
  {
    name: "🐋 Big Cap Movers",
    filters: [
      { field: "mcap", operator: ">", value: 1000000, label: "MCap > $1M" },
      { field: "priceChange24h", operator: ">", value: 5, label: "24h > 5%" },
      { field: "volume24h", operator: ">", value: 100000, label: "Vol > $100k" },
    ],
  },
  {
    name: "🧹 Clean Only",
    filters: [
      { field: "mintRevoked", operator: "=", value: "true", label: "Mint Revoked" },
      { field: "riskScore", operator: "<", value: 30, label: "Risk < 30" },
      { field: "isVerified", operator: "=", value: "true", label: "Verified" },
    ],
  },
];

const STORAGE_KEY = "ogscan_custom_feeds";

function loadFeeds(): CustomFeed[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveFeeds(feeds: CustomFeed[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(feeds));
}

function mapTokenToResult(t: JupTokenInfo): TokenResult {
  const buyVol = t.stats24h?.buyVolume ?? 0;
  const sellVol = t.stats24h?.sellVolume ?? 0;
  const holders = t.holderCount ?? 0;
  const topHolders = t.topHoldersPercent ?? t.audit?.topHoldersPercentage ?? 50;
  // Simple risk score: high concentration + no mint revoke = risky
  const riskScore = Math.min(100, Math.round(
    (t.audit?.mintAuthorityDisabled ? 0 : 30) +
    (t.audit?.freezeAuthorityDisabled ? 0 : 15) +
    (holders < 50 ? 25 : holders < 200 ? 10 : 0) +
    (topHolders > 50 ? 25 : topHolders > 30 ? 10 : 0)
  ));

  return {
    mint: (t as any).address ?? t.id,
    symbol: t.symbol || "???",
    name: t.name || "",
    logoURI: (t as any).logoURI ?? t.icon,
    mcap: t.mcap ?? 0,
    liquidity: t.liquidity ?? 0,
    volume24h: buyVol + sellVol,
    priceChange24h: t.stats24h?.priceChange ?? 0,
    priceChange1h: t.stats1h?.priceChange ?? 0,
    holders,
    riskScore,
    mintRevoked: !!t.audit?.mintAuthorityDisabled,
    isVerified: !!t.isVerified,
  };
}

function matchesFilter(token: TokenResult, filter: FeedFilter): boolean {
  const val = (token as any)[filter.field];
  if (val === undefined) return false;

  const filterVal = typeof filter.value === "string" ? filter.value : Number(filter.value);

  if (typeof val === "boolean") {
    return filter.operator === "=" ? val === (filterVal === "true") : val !== (filterVal === "true");
  }

  const numVal = Number(val);
  const numFilter = Number(filterVal);

  switch (filter.operator) {
    case ">": return numVal > numFilter;
    case "<": return numVal < numFilter;
    case "=": return numVal === numFilter;
    case "!=": return numVal !== numFilter;
    default: return true;
  }
}

export const CustomFeedBuilder: React.FC<Props> = ({ onApplyFilters, onSelectMint }) => {
  const [feeds, setFeeds] = useState<CustomFeed[]>(loadFeeds);
  const [expanded, setExpanded] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<FeedFilter[]>([]);
  const [feedName, setFeedName] = useState("");
  const [addingField, setAddingField] = useState(false);
  const [allTokens, setAllTokens] = useState<TokenResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<TokenResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Fetch tokens
  const fetchTokens = async () => {
    setLoading(true);
    try {
      const [trending, topTraded] = await Promise.all([
        jupTrending("24h", 50),
        jupTopTraded("24h", 30),
      ]);
      if (!mounted.current) return;
      const seen = new Set<string>();
      const combined: TokenResult[] = [];
      for (const t of [...trending, ...topTraded]) {
        const mint = (t as any).address ?? t.id;
        if (seen.has(mint)) continue;
        seen.add(mint);
        combined.push(mapTokenToResult(t));
      }
      setAllTokens(combined);
    } catch (e) {
      console.error("[CustomFeedBuilder] Fetch failed:", e);
    }
    if (mounted.current) setLoading(false);
  };

  // Fetch on first expand
  useEffect(() => {
    if (expanded && allTokens.length === 0) fetchTokens();
  }, [expanded]);

  // Apply filters to tokens
  const applyFilters = (filters: FeedFilter[]) => {
    if (allTokens.length === 0) {
      fetchTokens().then(() => {
        // Will reapply after state update
      });
    }

    const results = allTokens.filter(token =>
      filters.every(filter => matchesFilter(token, filter))
    );
    setFilteredResults(results);
    setShowResults(true);
    onApplyFilters?.(filters);
    toast.success(`${results.length} tokens match your filters`);
  };

  // Re-apply when tokens change
  useEffect(() => {
    if (currentFilters.length > 0 && allTokens.length > 0) {
      const results = allTokens.filter(token =>
        currentFilters.every(filter => matchesFilter(token, filter))
      );
      setFilteredResults(results);
    }
  }, [allTokens]);

  const addFilter = (field: typeof FIELD_OPTIONS[0]) => {
    const newFilter: FeedFilter = {
      field: field.value,
      operator: field.type === "boolean" ? "=" : ">",
      value: field.type === "boolean" ? "true" : 0,
      label: field.label,
    };
    setCurrentFilters(prev => [...prev, newFilter]);
    setAddingField(false);
  };

  const updateFilter = (index: number, updates: Partial<FeedFilter>) => {
    setCurrentFilters(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const removeFilter = (index: number) => {
    setCurrentFilters(prev => prev.filter((_, i) => i !== index));
  };

  const saveFeed = () => {
    if (currentFilters.length === 0) return;
    const feed: CustomFeed = {
      id: crypto.randomUUID(),
      name: feedName || `Feed ${feeds.length + 1}`,
      filters: currentFilters,
      createdAt: new Date().toISOString(),
      enabled: true,
      matchCount: filteredResults.length,
    };
    setFeeds(prev => {
      const next = [...prev, feed];
      saveFeeds(next);
      return next;
    });
    setFeedName("");
    toast.success("Feed saved!");
  };

  const deleteFeed = (id: string) => {
    setFeeds(prev => {
      const next = prev.filter(f => f.id !== id);
      saveFeeds(next);
      return next;
    });
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setCurrentFilters(preset.filters);
    setFeedName(preset.name);
    applyFilters(preset.filters);
  };

  const applyFeed = (feed: CustomFeed) => {
    setCurrentFilters(feed.filters);
    applyFilters(feed.filters);
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors"
      >
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-white">Custom Feed Builder</p>
          <p className="text-[10px] text-white/25">
            {feeds.length} saved feeds · {currentFilters.length} active filters
            {filteredResults.length > 0 && ` · ${filteredResults.length} matches`}
          </p>
        </div>
        {currentFilters.length > 0 && (
          <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px]">
            {currentFilters.length} active
          </Badge>
        )}
        {expanded ? <ChevronUp className="h-4 w-4 text-white/20" /> : <ChevronDown className="h-4 w-4 text-white/20" />}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] p-3 space-y-3">
          {/* Presets */}
          <div>
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">Quick Presets</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.015] hover:border-primary/30 hover:bg-primary/5 text-[10px] text-white/40 hover:text-white/60 transition-all"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Active filters */}
          {currentFilters.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">Active Filters</p>
              <div className="space-y-1">
                {currentFilters.map((filter, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/15">
                    <span className="text-[10px] text-white/40">{filter.label}</span>
                    <select
                      value={filter.operator}
                      onChange={e => updateFilter(i, { operator: e.target.value as any })}
                      className="text-[10px] bg-transparent border border-white/[0.08] rounded px-1.5 py-0.5 text-white/60"
                    >
                      <option value=">">&gt;</option>
                      <option value="<">&lt;</option>
                      <option value="=">=</option>
                      <option value="!=">≠</option>
                    </select>
                    <Input
                      value={filter.value}
                      onChange={e => updateFilter(i, { value: e.target.value })}
                      className="h-6 w-24 text-[10px] bg-white/[0.03] border-white/[0.08]"
                    />
                    <button onClick={() => removeFilter(i)} className="text-white/15 hover:text-red-400">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add filter */}
          {addingField ? (
            <div className="grid grid-cols-2 gap-1">
              {FIELD_OPTIONS.map(field => (
                <button
                  key={field.value}
                  onClick={() => addFilter(field)}
                  className="text-left px-2.5 py-1.5 rounded-lg border border-white/[0.06] hover:border-primary/30 hover:bg-primary/5 text-[10px] text-white/40 hover:text-white/60 transition-all"
                >
                  {field.label}
                </button>
              ))}
              <button onClick={() => setAddingField(false)} className="px-2.5 py-1.5 rounded-lg border border-white/[0.06] text-[10px] text-white/20">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingField(true)}
              className="w-full flex items-center justify-center gap-1 p-2 rounded-lg border border-dashed border-white/[0.08] hover:border-primary/30 text-white/20 hover:text-white/40 transition-colors"
            >
              <Plus className="h-3 w-3" /> <span className="text-[10px]">Add Filter</span>
            </button>
          )}

          {/* Apply / Save */}
          {currentFilters.length > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => applyFilters(currentFilters)}
                disabled={loading}
                className="flex-1 h-8 text-xs gap-1"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                {loading ? "Loading..." : "Apply Filters"}
              </Button>
              <div className="flex items-center gap-1">
                <Input placeholder="Feed name..." value={feedName} onChange={e => setFeedName(e.target.value)} className="h-8 w-28 text-[10px] bg-white/[0.03] border-white/[0.08]" />
                <Button size="sm" variant="outline" onClick={saveFeed} className="h-8 text-xs gap-1">
                  <Save className="h-3 w-3" /> Save
                </Button>
              </div>
            </div>
          )}

          {/* Filtered results */}
          {showResults && filteredResults.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">
                Results ({filteredResults.length} tokens)
              </p>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {filteredResults.slice(0, 30).map(token => (
                  <button
                    key={token.mint}
                    onClick={() => onSelectMint?.(token.mint)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition-colors text-left"
                  >
                    {token.logoURI && <img src={token.logoURI} className="w-5 h-5 rounded-full" alt="" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-white">{token.symbol}</span>
                        {token.mintRevoked && <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[7px]">✓ Mint</Badge>}
                        {token.isVerified && <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[7px]">✓ Verified</Badge>}
                      </div>
                      <div className="flex gap-2 text-[8px] text-white/20">
                        <span>MCap: {fmtUsd(token.mcap)}</span>
                        <span>LP: {fmtUsd(token.liquidity)}</span>
                        <span>Vol: {fmtUsd(token.volume24h)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={cn("text-[10px] font-bold", token.priceChange24h >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(1)}%
                      </span>
                      <div className="text-[8px] text-white/15">Risk: {token.riskScore}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showResults && filteredResults.length === 0 && !loading && (
            <div className="text-center py-4">
              <p className="text-xs text-white/20">No tokens match your filters</p>
              <p className="text-[10px] text-white/10">Try adjusting the filter values</p>
            </div>
          )}

          {/* Saved feeds */}
          {feeds.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">Saved Feeds</p>
              <div className="space-y-1">
                {feeds.map(feed => (
                  <div key={feed.id} className="flex items-center gap-2 p-2 rounded-lg border border-white/[0.06] bg-white/[0.015]">
                    <span className="text-[11px] font-bold text-white flex-1">{feed.name}</span>
                    <span className="text-[9px] text-white/15">{feed.filters.length} filters</span>
                    <button onClick={() => applyFeed(feed)} className="px-2 py-0.5 rounded text-[9px] bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">Apply</button>
                    <button onClick={() => deleteFeed(feed.id)} className="text-white/15 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomFeedBuilder;
