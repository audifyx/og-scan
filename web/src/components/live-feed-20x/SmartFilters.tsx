/**
 * SmartFilters — Intelligent real-time feed filtering.
 * Filter by mcap range, age, holder velocity, whale presence, etc.
 * Auto-learns from user clicks what they care about.
 */
import { useState, useEffect } from "react";
import { Filter, Zap, Save, RotateCcw, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FilterRange {
  min: number;
  max: number;
  enabled: boolean;
}

interface SmartFilterConfig {
  mcapRange: FilterRange;
  ageRange: FilterRange; // hours
  holderMin: number;
  holderMinEnabled: boolean;
  volumeMin: number;
  volumeMinEnabled: boolean;
  requireSocials: boolean;
  requireLpLock: boolean;
  maxDevHolding: number;
  maxDevHoldingEnabled: boolean;
  hideRuGs: boolean;
  onlyNew: boolean; // < 1h old
  onlyPumping: boolean; // positive change
  whalesOnly: boolean;
  smartMode: boolean; // Auto-filter based on user history
}

interface Props {
  onFilterChange: (filters: SmartFilterConfig) => void;
  activeCount?: number;
}

const DEFAULT_FILTERS: SmartFilterConfig = {
  mcapRange: { min: 0, max: 100000000, enabled: false },
  ageRange: { min: 0, max: 720, enabled: false },
  holderMin: 50,
  holderMinEnabled: false,
  volumeMin: 5000,
  volumeMinEnabled: false,
  requireSocials: false,
  requireLpLock: false,
  maxDevHolding: 20,
  maxDevHoldingEnabled: false,
  hideRuGs: true,
  onlyNew: false,
  onlyPumping: false,
  whalesOnly: false,
  smartMode: false,
};

const QUICK_FILTERS = [
  { label: "🆕 New Only", apply: (f: SmartFilterConfig) => ({ ...f, onlyNew: !f.onlyNew }) },
  { label: "📈 Pumping", apply: (f: SmartFilterConfig) => ({ ...f, onlyPumping: !f.onlyPumping }) },
  { label: "🐋 Whale Activity", apply: (f: SmartFilterConfig) => ({ ...f, whalesOnly: !f.whalesOnly }) },
  { label: "🔒 LP Locked", apply: (f: SmartFilterConfig) => ({ ...f, requireLpLock: !f.requireLpLock }) },
  { label: "🐦 Has Socials", apply: (f: SmartFilterConfig) => ({ ...f, requireSocials: !f.requireSocials }) },
  { label: "🗑️ Hide Rugs", apply: (f: SmartFilterConfig) => ({ ...f, hideRuGs: !f.hideRuGs }) },
];

const MCAP_PRESETS = [
  { label: "Micro (<$100k)", min: 0, max: 100000 },
  { label: "Small ($100k-$1M)", min: 100000, max: 1000000 },
  { label: "Mid ($1M-$10M)", min: 1000000, max: 10000000 },
  { label: "Large ($10M+)", min: 10000000, max: 100000000 },
];

export const SmartFilters: React.FC<Props> = ({ onFilterChange, activeCount }) => {
  const [filters, setFilters] = useState<SmartFilterConfig>(DEFAULT_FILTERS);
  const [expanded, setExpanded] = useState(false);

  const updateFilters = (update: Partial<SmartFilterConfig>) => {
    setFilters(prev => {
      const next = { ...prev, ...update };
      onFilterChange(next);
      return next;
    });
  };

  const activeFilterCount = [
    filters.onlyNew,
    filters.onlyPumping,
    filters.whalesOnly,
    filters.requireLpLock,
    filters.requireSocials,
    filters.hideRuGs,
    filters.mcapRange.enabled,
    filters.ageRange.enabled,
    filters.holderMinEnabled,
    filters.volumeMinEnabled,
    filters.maxDevHoldingEnabled,
    filters.smartMode,
  ].filter(Boolean).length;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.015] transition-colors"
      >
        <Filter className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold text-white">Smart Filters</span>
        {activeFilterCount > 0 && (
          <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px]">
            {activeFilterCount} active
          </Badge>
        )}
        {activeCount !== undefined && (
          <span className="text-[10px] text-white/20">{activeCount} results</span>
        )}
        <div className="flex-1" />
        {filters.smartMode && (
          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[8px] gap-0.5">
            <Sparkles className="h-2 w-2" /> AI Mode
          </Badge>
        )}
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-white/15" /> : <ChevronDown className="h-3.5 w-3.5 text-white/15" />}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] p-3 space-y-3">
          {/* Quick toggles */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_FILTERS.map(qf => {
              const key = qf.label.includes("New") ? "onlyNew" :
                qf.label.includes("Pump") ? "onlyPumping" :
                qf.label.includes("Whale") ? "whalesOnly" :
                qf.label.includes("LP") ? "requireLpLock" :
                qf.label.includes("Social") ? "requireSocials" :
                "hideRuGs";
              const active = (filters as any)[key];
              return (
                <button
                  key={qf.label}
                  onClick={() => updateFilters(qf.apply(filters))}
                  className={cn("px-2.5 py-1.5 rounded-lg border text-[10px] transition-all",
                    active
                      ? "bg-primary/10 border-primary/20 text-primary"
                      : "border-white/[0.06] text-white/30 hover:border-white/[0.12]"
                  )}
                >
                  {qf.label}
                </button>
              );
            })}
          </div>

          {/* MCap presets */}
          <div>
            <p className="text-[9px] text-white/20 uppercase tracking-wider mb-1.5">Market Cap Range</p>
            <div className="flex flex-wrap gap-1">
              {MCAP_PRESETS.map(preset => {
                const active = filters.mcapRange.enabled &&
                  filters.mcapRange.min === preset.min &&
                  filters.mcapRange.max === preset.max;
                return (
                  <button
                    key={preset.label}
                    onClick={() => updateFilters({
                      mcapRange: active
                        ? { ...filters.mcapRange, enabled: false }
                        : { min: preset.min, max: preset.max, enabled: true },
                    })}
                    className={cn("px-2 py-1 rounded text-[9px] border transition-all",
                      active
                        ? "bg-primary/10 border-primary/20 text-primary"
                        : "border-white/[0.06] text-white/25 hover:border-white/[0.1]"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Smart mode toggle */}
          <button
            onClick={() => updateFilters({ smartMode: !filters.smartMode })}
            className={cn("w-full flex items-center gap-2 p-2.5 rounded-lg border transition-all",
              filters.smartMode
                ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                : "border-white/[0.06] text-white/25 hover:border-purple-500/15"
            )}
          >
            <Sparkles className="h-4 w-4" />
            <div className="flex-1 text-left">
              <p className="text-[11px] font-bold">Smart Mode</p>
              <p className="text-[9px] opacity-50">Auto-filter based on your interaction patterns</p>
            </div>
            <div className={cn("w-8 h-4 rounded-full transition-all",
              filters.smartMode ? "bg-purple-500" : "bg-white/10"
            )}>
              <div className={cn("w-3 h-3 rounded-full bg-white transition-all mt-0.5",
                filters.smartMode ? "ml-4.5 translate-x-0.5" : "ml-0.5"
              )} />
            </div>
          </button>

          {/* Reset */}
          <button
            onClick={() => { setFilters(DEFAULT_FILTERS); onFilterChange(DEFAULT_FILTERS); }}
            className="text-[10px] text-white/15 hover:text-white/30 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="h-3 w-3" /> Reset all filters
          </button>
        </div>
      )}
    </div>
  );
};

export default SmartFilters;
