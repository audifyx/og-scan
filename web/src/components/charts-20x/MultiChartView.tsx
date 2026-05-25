/**
 * MultiChartView — View up to 4 token charts simultaneously in a grid.
 * Each chart uses DexScreener embed. Drag to rearrange, click to fullscreen.
 * Charts persist in localStorage across page refreshes.
 */
import { useState, useEffect } from "react";
import { Grid2X2, Maximize2, Minimize2, X, Plus, Search, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { jupSearchToken, type JupTokenInfo, shortAddr } from "@/lib/og";

interface ChartSlot {
  id: string;
  mint: string;
  symbol: string;
  name: string;
  logoURI?: string;
}

interface Props {
  onSelectMint?: (mint: string) => void;
}

const MAX_CHARTS = 4;
const STORAGE_KEY = "ogscan_multichart_slots";

function loadSlots(): ChartSlot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSlots(slots: ChartSlot[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}

export const MultiChartView: React.FC<Props> = ({ onSelectMint }) => {
  const [slots, setSlots] = useState<ChartSlot[]>(loadSlots);
  const [fullscreenSlot, setFullscreenSlot] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<JupTokenInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingSlot, setAddingSlot] = useState(false);

  // Persist slots whenever they change
  useEffect(() => { saveSlots(slots); }, [slots]);

  const searchToken = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try { setSearchResults((await jupSearchToken(q)).slice(0, 6)); }
    catch { setSearchResults([]); }
    setSearching(false);
  };

  const addChart = (token: JupTokenInfo) => {
    if (slots.length >= MAX_CHARTS) return;
    const mint = (token as any).address ?? token.id;
    // Don't add duplicate mints
    if (slots.some(s => s.mint === mint)) {
      setSearchQuery("");
      setSearchResults([]);
      setAddingSlot(false);
      return;
    }
    setSlots(prev => [...prev, {
      id: crypto.randomUUID(),
      mint,
      symbol: token.symbol || "???",
      name: token.name || "",
      logoURI: (token as any).logoURI ?? token.icon,
    }]);
    setSearchQuery("");
    setSearchResults([]);
    setAddingSlot(false);
  };

  const removeChart = (id: string) => {
    setSlots(prev => prev.filter(s => s.id !== id));
    if (fullscreenSlot === id) setFullscreenSlot(null);
  };

  const gridCols = slots.length <= 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2";
  const chartHeight = slots.length <= 2 ? "h-[350px]" : "h-[250px]";

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 p-3 border-b border-white/[0.06]">
        <Grid2X2 className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Multi-Chart</p>
          <p className="text-[10px] text-white/25">{slots.length}/{MAX_CHARTS} charts</p>
        </div>
        {slots.length < MAX_CHARTS && (
          <button
            onClick={() => setAddingSlot(!addingSlot)}
            className="p-1.5 rounded-lg border border-white/[0.08] text-white/20 hover:border-primary/30 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {addingSlot && (
        <div className="p-3 border-b border-white/[0.06] bg-primary/5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20" />
            <Input
              placeholder="Search token for chart..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); searchToken(e.target.value); }}
              className="pl-8 h-8 text-xs bg-white/[0.03] border-white/[0.08]"
              autoFocus
            />
            {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-white/20" />}
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {searchResults.map(r => {
                const rMint = (r as any).address ?? r.id;
                return (
                  <button
                    key={rMint}
                    onClick={() => addChart(r)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                  >
                    {((r as any).logoURI ?? r.icon) && <img src={(r as any).logoURI ?? r.icon} className="w-5 h-5 rounded-full" alt="" />}
                    <span className="text-[11px] font-bold text-white">{r.symbol}</span>
                    <span className="text-[9px] text-white/20 truncate flex-1">{r.name}</span>
                    {slots.some(s => s.mint === rMint) && (
                      <Badge className="bg-white/[0.05] text-white/20 text-[7px]">Added</Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {slots.length === 0 ? (
        <div className="p-12 text-center">
          <Grid2X2 className="h-10 w-10 text-white/[0.06] mx-auto mb-3" />
          <p className="text-xs text-white/20">No charts added yet</p>
          <p className="text-[10px] text-white/10 mt-1">Add up to {MAX_CHARTS} tokens to compare charts side by side</p>
        </div>
      ) : fullscreenSlot ? (
        // Fullscreen view
        <div className="relative">
          {(() => {
            const slot = slots.find(s => s.id === fullscreenSlot);
            if (!slot) return null;
            return (
              <>
                <div className="flex items-center gap-2 p-2 border-b border-white/[0.06]">
                  {slot.logoURI && <img src={slot.logoURI} className="w-4 h-4 rounded-full" alt="" />}
                  <span className="text-xs font-bold text-white">{slot.symbol}</span>
                  <span className="text-[10px] text-white/20">{slot.name}</span>
                  <div className="flex-1" />
                  <button onClick={() => onSelectMint?.(slot.mint)} className="text-[9px] text-primary hover:underline">
                    Full Scan →
                  </button>
                  <button onClick={() => setFullscreenSlot(null)} className="p-1 text-white/20 hover:text-white/40">
                    <Minimize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <iframe
                  src={`https://dexscreener.com/solana/${slot.mint}?embed=1&theme=dark&trades=0&info=0`}
                  className="w-full h-[500px] border-0"
                  title={`${slot.symbol} chart`}
                />
              </>
            );
          })()}
        </div>
      ) : (
        // Grid view
        <div className={cn("grid gap-1 p-1", gridCols)}>
          {slots.map(slot => (
            <div key={slot.id} className="relative rounded-lg border border-white/[0.06] overflow-hidden">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-black/40 absolute top-0 left-0 right-0 z-10">
                {slot.logoURI && <img src={slot.logoURI} className="w-3.5 h-3.5 rounded-full" alt="" />}
                <span className="text-[10px] font-bold text-white">{slot.symbol}</span>
                <div className="flex-1" />
                <button onClick={() => onSelectMint?.(slot.mint)} className="p-0.5 text-[8px] text-primary hover:underline mr-1">
                  Scan
                </button>
                <button onClick={() => setFullscreenSlot(slot.id)} className="p-0.5 text-white/20 hover:text-white/40">
                  <Maximize2 className="h-2.5 w-2.5" />
                </button>
                <button onClick={() => removeChart(slot.id)} className="p-0.5 text-white/20 hover:text-red-400">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
              <iframe
                src={`https://dexscreener.com/solana/${slot.mint}?embed=1&theme=dark&trades=0&info=0`}
                className={cn("w-full border-0", chartHeight)}
                title={`${slot.symbol} chart`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiChartView;
