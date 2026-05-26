/**
 * ChainSelector — Horizontal scrollable chain picker for the Discover tab.
 * Shows all supported chains with their emoji + short name.
 * "All Chains" option aggregates across all chains.
 */
import { cn } from "@/lib/utils";
import { SUPPORTED_CHAINS, type ChainConfig } from "@/lib/chains";
import { Globe } from "lucide-react";

interface Props {
  selectedChain: string; // "all" or a chain id
  onSelectChain: (chainId: string) => void;
  className?: string;
  /** If true, shows a compact single-row pill style */
  compact?: boolean;
}

export const ChainSelector: React.FC<Props> = ({ selectedChain, onSelectChain, className, compact }) => {
  if (compact) {
    return (
      <div className={cn("flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide", className)}>
        {/* All Chains option */}
        <button
          onClick={() => onSelectChain("all")}
          className={cn(
            "shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap",
            selectedChain === "all"
              ? "bg-primary/15 text-primary border border-primary/25"
              : "text-white/20 hover:text-white/40 border border-transparent hover:border-white/[0.06]"
          )}
        >
          <Globe className="h-3 w-3" />
          All
        </button>
        {SUPPORTED_CHAINS.map((chain) => (
          <button
            key={chain.id}
            onClick={() => onSelectChain(chain.id)}
            className={cn(
              "shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap",
              selectedChain === chain.id
                ? cn("border", chain.accent)
                : "text-white/20 hover:text-white/40 border border-transparent hover:border-white/[0.06]"
            )}
          >
            <span className="text-xs">{chain.emoji}</span>
            {chain.shortName}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* All Chains card */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => onSelectChain("all")}
          className={cn(
            "shrink-0 flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all",
            selectedChain === "all"
              ? "bg-gradient-to-br from-primary/10 to-white/[0.02] border-primary/25"
              : "bg-white/[0.02] border-white/[0.06] opacity-50 hover:opacity-80"
          )}
        >
          <Globe className="h-5 w-5 text-primary" />
          <div className="text-left">
            <p className="text-xs font-bold text-white">All Chains</p>
            <p className="text-[9px] text-white/30">{SUPPORTED_CHAINS.length} networks</p>
          </div>
        </button>
        {SUPPORTED_CHAINS.map((chain) => (
          <button
            key={chain.id}
            onClick={() => onSelectChain(chain.id)}
            className={cn(
              "shrink-0 flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all",
              selectedChain === chain.id
                ? `bg-gradient-to-br ${chain.color} border-opacity-100 ${chain.accent.split(" ").find(c => c.startsWith("border-"))}`
                : "bg-white/[0.02] border-white/[0.06] opacity-50 hover:opacity-80"
            )}
          >
            <span className="text-xl">{chain.emoji}</span>
            <div className="text-left">
              <p className="text-xs font-bold text-white">{chain.name}</p>
              <p className="text-[9px] text-white/30">{chain.mainDex}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChainSelector;
