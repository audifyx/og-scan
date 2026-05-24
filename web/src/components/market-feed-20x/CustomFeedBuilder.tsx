/**
 * CustomFeedBuilder — Create custom feeds with layered filters.
 * "Show me tokens where LP > $50k AND trending AND whale bought AND not a copy"
 */
import { useState, useEffect } from "react";
import { Filter, Plus, X, Save, Trash2, Check, Play, Pause, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FeedFilter {
  field: string;
  operator: ">" | "<" | "=" | "!=" | "contains" | "between";
  value: string | number;
  value2?: number; // for "between"
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

interface Props {
  onApplyFilters?: (filters: FeedFilter[]) => void;
}

const FIELD_OPTIONS = [
  { value: "liquidity", label: "Liquidity ($)", type: "number" },
  { value: "mcap", label: "Market Cap ($)", type: "number" },
  { value: "volume24h", label: "24h Volume ($)", type: "number" },
  { value: "priceChange24h", label: "24h Change (%)", type: "number" },
  { value: "priceChange1h", label: "1h Change (%)", type: "number" },
  { value: "holders", label: "Holder Count", type: "number" },
  { value: "riskScore", label: "Risk Score", type: "number" },
  { value: "age", label: "Token Age (hours)", type: "number" },
  { value: "bundlePct", label: "Bundle %", type: "number" },
  { value: "hasTwitter", label: "Has Twitter", type: "boolean" },
  { value: "hasWebsite", label: "Has Website", type: "boolean" },
  { value: "mintRevoked", label: "Mint Revoked", type: "boolean" },
  { value: "isTrending", label: "Is Trending", type: "boolean" },
  { value: "whaleActivity", label: "Recent Whale Activity", type: "boolean" },
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
      { field: "age", operator: "<", value: 24, label: "< 24h old" },
      { field: "priceChange1h", operator: ">", value: 10, label: "1h Change > 10%" },
      { field: "liquidity", operator: ">", value: 10000, label: "LP > $10k" },
    ],
  },
  {
    name: "🐋 Whale Targets",
    filters: [
      { field: "whaleActivity", operator: "=", value: "true", label: "Whale Activity" },
      { field: "liquidity", operator: ">", value: 25000, label: "LP > $25k" },
      { field: "bundlePct", operator: "<", value: 15, label: "Bundle < 15%" },
    ],
  },
  {
    name: "🧹 Clean Only",
    filters: [
      { field: "mintRevoked", operator: "=", value: "true", label: "Mint Revoked" },
      { field: "bundlePct", operator: "<", value: 5, label: "Bundle < 5%" },
      { field: "riskScore", operator: "<", value: 30, label: "Risk < 30" },
      { field: "hasTwitter", operator: "=", value: "true", label: "Has Twitter" },
      { field: "hasWebsite", operator: "=", value: "true", label: "Has Website" },
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

export const CustomFeedBuilder: React.FC<Props> = ({ onApplyFilters }) => {
  const [feeds, setFeeds] = useState<CustomFeed[]>(loadFeeds);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<FeedFilter[]>([]);
  const [feedName, setFeedName] = useState("");
  const [addingField, setAddingField] = useState(false);

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
      matchCount: 0,
    };
    setFeeds(prev => {
      const next = [...prev, feed];
      saveFeeds(next);
      return next;
    });
    setEditing(false);
    setCurrentFilters([]);
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
    setEditing(true);
    onApplyFilters?.(preset.filters);
  };

  const applyFeed = (feed: CustomFeed) => {
    setCurrentFilters(feed.filters);
    onApplyFilters?.(feed.filters);
    toast.success(`Applied: ${feed.name}`);
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
          <p className="text-[10px] text-white/25">{feeds.length} saved feeds · {currentFilters.length} active filters</p>
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
              <button
                onClick={() => setAddingField(false)}
                className="px-2.5 py-1.5 rounded-lg border border-white/[0.06] text-[10px] text-white/20"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingField(true)}
              className="w-full flex items-center justify-center gap-1 p-2 rounded-lg border border-dashed border-white/[0.08] hover:border-primary/30 text-white/20 hover:text-white/40 transition-colors"
            >
              <Plus className="h-3 w-3" /> <span className="text-[10px]">Add Filter</span>
            </button>
          )}

          {/* Save / Apply */}
          {currentFilters.length > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onApplyFilters?.(currentFilters)}
                className="flex-1 h-8 text-xs gap-1"
              >
                <Play className="h-3 w-3" /> Apply Filters
              </Button>
              <div className="flex items-center gap-1">
                <Input
                  placeholder="Feed name..."
                  value={feedName}
                  onChange={e => setFeedName(e.target.value)}
                  className="h-8 w-28 text-[10px] bg-white/[0.03] border-white/[0.08]"
                />
                <Button size="sm" variant="outline" onClick={saveFeed} className="h-8 text-xs gap-1">
                  <Save className="h-3 w-3" /> Save
                </Button>
              </div>
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
                    <button
                      onClick={() => applyFeed(feed)}
                      className="px-2 py-0.5 rounded text-[9px] bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                    >
                      Apply
                    </button>
                    <button onClick={() => deleteFeed(feed.id)} className="text-white/15 hover:text-red-400">
                      <Trash2 className="h-3 w-3" />
                    </button>
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
