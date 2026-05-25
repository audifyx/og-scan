/**
 * SmartWatchlist — Track tokens with price alerts and auto-categorization.
 * Tags tokens, sets alerts, groups by narrative, shows live prices.
 * Wired to: Jupiter search + price APIs for real-time data.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Star, Bell, BellOff, Tag, Plus, X, Search, Loader2, TrendingUp, TrendingDown, AlertTriangle, Trash2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { jupSearchToken, jupPrice, fmtUsd, shortAddr, type JupTokenInfo } from "@/lib/og";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface WatchlistItem {
  mint: string;
  symbol: string;
  name: string;
  logoURI?: string;
  addedAt: string;
  addedPrice: number;
  currentPrice: number;
  priceChange: number;
  mcap: number;
  tags: string[];
  alertAbove: number | null;
  alertBelow: number | null;
  notes: string;
}

interface Props {
  onSelectMint?: (mint: string) => void;
}

const STORAGE_KEY = "ogscan_watchlist";
const TAG_COLORS: Record<string, string> = {
  "gem": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "risky": "bg-red-500/10 text-red-400 border-red-500/20",
  "watching": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "ai": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "meme": "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "defi": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "default": "bg-white/[0.03] text-white/30 border-white/[0.06]",
};

function loadWatchlist(): WatchlistItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveWatchlist(items: WatchlistItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
}

export const SmartWatchlist: React.FC<Props> = ({ onSelectMint }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>(loadWatchlist);

  // Load from Supabase on mount
  useEffect(() => {
    if (!user) return;
    supabase.from("smart_watchlist").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => {
      if (data && data.length > 0) {
        const loaded: WatchlistItem[] = data.map((r: any) => ({
          mint: r.mint, symbol: r.symbol || "???", name: r.name || "", logoURI: r.logo_uri,
          addedAt: r.created_at, addedPrice: r.added_price ?? 0, currentPrice: r.current_price ?? 0,
          priceChange: r.price_change ?? 0, mcap: r.mcap ?? 0, tags: r.tags ?? [],
          alertAbove: r.alert_above, alertBelow: r.alert_below, notes: r.notes ?? "",
        }));
        setItems(loaded);
        saveWatchlist(loaded);
      }
    });
  }, [user?.id]);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JupTokenInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const search = async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try { setResults((await jupSearchToken(q)).slice(0, 6)); }
    catch { setResults([]); }
    setSearching(false);
  };

  // Fetch live prices for all watchlist items
  const refreshPrices = useCallback(async () => {
    if (items.length === 0) return;
    setRefreshing(true);
    try {
      const mints = items.map(i => i.mint);
      const prices = await jupPrice(mints);
      if (!mounted.current) return;
      setItems(prev => {
        const updated = prev.map(item => {
          const priceData = prices[item.mint];
          if (!priceData) return item;
          const currentPrice = priceData.usdPrice ?? item.currentPrice;
          const priceChange = item.addedPrice > 0
            ? ((currentPrice - item.addedPrice) / item.addedPrice) * 100
            : (priceData.priceChange24h ?? 0);

          // Check price alerts
          if (item.alertAbove && currentPrice >= item.alertAbove) {
            toast.success(`🔔 $${item.symbol} hit $${currentPrice.toFixed(6)} (above alert $${item.alertAbove})`);
          }
          if (item.alertBelow && currentPrice <= item.alertBelow) {
            toast.warning(`🔔 $${item.symbol} dropped to $${currentPrice.toFixed(6)} (below alert $${item.alertBelow})`);
          }

          return { ...item, currentPrice, priceChange };
        });
        saveWatchlist(updated);
        return updated;
      });
    } catch {}
    if (mounted.current) setRefreshing(false);
  }, [items.length]);

  // Refresh prices on mount and every 60 seconds
  useEffect(() => {
    refreshPrices();
    const iv = setInterval(refreshPrices, 60 * 1000);
    return () => clearInterval(iv);
  }, [refreshPrices]);

  const addItem = async (token: JupTokenInfo) => {
    if (items.some(i => i.mint === ((token as any).address ?? token.id))) {
      toast.error("Already in watchlist");
      return;
    }
    const mint = (token as any).address ?? token.id;
    // Fetch current price
    let currentPrice = token.usdPrice ?? 0;
    try {
      const priceData = await jupPrice([mint]);
      if (priceData[mint]) currentPrice = priceData[mint].usdPrice;
    } catch {}

    const item: WatchlistItem = {
      mint,
      symbol: token.symbol || "???",
      name: token.name || "",
      logoURI: (token as any).logoURI ?? token.icon,
      addedAt: new Date().toISOString(),
      addedPrice: currentPrice,
      currentPrice,
      priceChange: 0,
      mcap: token.mcap || 0,
      tags: [],
      alertAbove: null,
      alertBelow: null,
      notes: "",
    };
    setItems(prev => {
      const next = [item, ...prev];
      saveWatchlist(next);
      return next;
    });
    // Persist to Supabase
    if (user) {
      supabase.from("smart_watchlist").insert({
        user_id: user.id, mint: item.mint, symbol: item.symbol, name: item.name,
        logo_uri: item.logoURI, added_price: item.addedPrice, current_price: item.currentPrice,
        mcap: item.mcap, tags: item.tags, notes: item.notes,
      }).then(() => {});
    }
    setQuery("");
    setResults([]);
    setShowAdd(false);
    toast.success(`Added $${item.symbol} at $${currentPrice > 0.001 ? currentPrice.toFixed(4) : currentPrice.toExponential(2)}`);
  };

  const removeItem = (mint: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.mint !== mint);
      saveWatchlist(next);
      return next;
    });
    if (user) supabase.from("smart_watchlist").delete().eq("user_id", user.id).eq("mint", mint).then(() => {});
  };

  const toggleTag = (mint: string, tag: string) => {
    setItems(prev => {
      const next = prev.map(i => {
        if (i.mint !== mint) return i;
        const tags = i.tags.includes(tag) ? i.tags.filter(t => t !== tag) : [...i.tags, tag];
        return { ...i, tags };
      });
      saveWatchlist(next);
      return next;
    });
  };

  const allTags = [...new Set(items.flatMap(i => i.tags))];
  const filtered = filterTag ? items.filter(i => i.tags.includes(filterTag)) : items;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <Star className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Smart Watchlist</p>
          <p className="text-[10px] text-white/25">{items.length} token{items.length !== 1 ? "s" : ""} tracked · Live prices</p>
        </div>
        <button
          onClick={refreshPrices}
          disabled={refreshing}
          className="p-1.5 rounded-lg border border-white/[0.08] text-white/20 hover:text-white/40 transition-colors"
          title="Refresh prices"
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
        </button>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="p-1.5 rounded-lg border border-white/[0.08] text-white/20 hover:border-primary/30 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {showAdd && (
        <div className="p-3 border-b border-white/[0.06] bg-primary/5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20" />
            <Input
              placeholder="Search token to add..."
              value={query}
              onChange={e => { setQuery(e.target.value); search(e.target.value); }}
              className="pl-8 h-8 text-xs bg-white/[0.03] border-white/[0.08]"
              autoFocus
            />
          </div>
          {searching && <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-white/20" /></div>}
          {results.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {results.map(r => (
                <button
                  key={(r as any).address ?? r.id}
                  onClick={() => addItem(r)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                >
                  {((r as any).logoURI ?? r.icon) && <img src={(r as any).logoURI ?? r.icon} className="w-5 h-5 rounded-full" alt="" />}
                  <span className="text-[11px] font-bold text-white">{r.symbol}</span>
                  <span className="text-[9px] text-white/20 flex-1 truncate">{r.name}</span>
                  {r.mcap ? <span className="text-[9px] text-white/15">{fmtUsd(r.mcap)}</span> : null}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {allTags.length > 0 && (
        <div className="px-3 py-2 border-b border-white/[0.04] flex gap-1 flex-wrap">
          <button
            onClick={() => setFilterTag(null)}
            className={cn("px-2 py-0.5 rounded text-[9px] transition-all",
              !filterTag ? "bg-primary/10 text-primary" : "text-white/20 hover:text-white/40"
            )}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              className={cn("px-2 py-0.5 rounded text-[9px] border transition-all",
                filterTag === tag
                  ? TAG_COLORS[tag] || TAG_COLORS.default
                  : "border-transparent text-white/20 hover:text-white/40"
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-[400px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Star className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
            <p className="text-xs text-white/20">Watchlist is empty</p>
            <p className="text-[10px] text-white/10 mt-1">Add tokens to track them with live prices</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {filtered.map(item => (
              <div key={item.mint} className="p-3 hover:bg-white/[0.015] transition-colors">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectMint?.(item.mint)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {item.logoURI ? (
                      <img src={item.logoURI} className="w-7 h-7 rounded-full" alt="" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] font-bold text-white/20">
                        {item.symbol.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{item.symbol}</span>
                        {item.tags.map(tag => (
                          <Badge key={tag} className={cn("text-[7px]", TAG_COLORS[tag] || TAG_COLORS.default)}>
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <span className="text-[9px] text-white/20">{item.name}</span>
                    </div>
                  </button>
                  <div className="text-right">
                    {item.currentPrice > 0 && (
                      <p className="text-[10px] font-bold text-white">
                        ${item.currentPrice < 0.001 ? item.currentPrice.toExponential(2) : item.currentPrice.toFixed(4)}
                      </p>
                    )}
                    {item.priceChange !== 0 && (
                      <p className={cn("text-[9px] font-bold", item.priceChange >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {item.priceChange >= 0 ? "+" : ""}{item.priceChange.toFixed(1)}%
                      </p>
                    )}
                    {item.currentPrice === 0 && item.mcap > 0 && (
                      <p className="text-[10px] font-bold text-white">{fmtUsd(item.mcap)}</p>
                    )}
                    <p className="text-[8px] text-white/15">Added {new Date(item.addedAt).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => removeItem(item.mint)} className="p-1 text-white/10 hover:text-red-400">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                {editingItem === item.mint && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {["gem", "risky", "watching", "ai", "meme", "defi"].map(tag => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(item.mint, tag)}
                        className={cn("px-2 py-0.5 rounded text-[8px] border transition-all",
                          item.tags.includes(tag) ? TAG_COLORS[tag] : "border-white/[0.06] text-white/15"
                        )}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setEditingItem(editingItem === item.mint ? null : item.mint)}
                  className="text-[8px] text-white/10 hover:text-white/25 mt-1"
                >
                  {editingItem === item.mint ? "Done" : "Tags"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartWatchlist;
