import { useState, useEffect } from "react";
import { Coins, Plus, Trash2, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface WatchlistItem {
  id: string;
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  added_by_name: string | null;
  created_at: string;
}

export const LobbyWatchlist = ({ lobbyId }: { lobbyId: string }) => {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("lobby_watchlists")
        .select("*")
        .eq("lobby_id", lobbyId)
        .order("created_at", { ascending: false });
      if (data) setItems(data);
    };
    fetch();
  }, [lobbyId]);

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await window.fetch(`https://api.dexscreener.com/latest/dex/search?q=${search}`);
        const data = await res.json();
        setSearchResults((data.pairs || []).filter((p: any) => p.chainId === "solana").slice(0, 6));
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const addToken = async (pair: any) => {
    await supabase.from("lobby_watchlists").insert({
      lobby_id: lobbyId,
      token_address: pair.baseToken.address,
      token_symbol: pair.baseToken.symbol,
      token_name: pair.baseToken.name,
      added_by: user?.id,
      added_by_name: profile?.username || "Unknown",
    });
    setItems((prev) => [{ id: crypto.randomUUID(), token_address: pair.baseToken.address, token_symbol: pair.baseToken.symbol, token_name: pair.baseToken.name, added_by_name: profile?.username || "Unknown", created_at: new Date().toISOString() }, ...prev]);
    setShowAdd(false);
    setSearch("");
  };

  const removeToken = async (id: string) => {
    await supabase.from("lobby_watchlists").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="og-glass-card rounded-xl overflow-hidden flex flex-col h-full">
      <div className="px-3 py-2 border-b border-primary/10 flex items-center gap-2">
        <Coins className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold font-display">SHARED WATCHLIST</span>
        <button onClick={() => setShowAdd(!showAdd)} className="ml-auto p-1 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {showAdd && (
        <div className="p-2 border-b border-border/20">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Solana tokens..." className="w-full bg-white/[0.03] border border-border/30 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30" />
          {searchResults.length > 0 && (
            <div className="mt-1 max-h-40 overflow-y-auto space-y-0.5">
              {searchResults.map((pair: any, i: number) => (
                <button key={i} onClick={() => addToken(pair)} className="w-full text-left p-2 rounded-lg hover:bg-primary/10 flex items-center gap-2 transition-colors">
                  <span className="text-xs font-semibold text-foreground">{pair.baseToken.symbol}</span>
                  <span className="text-[9px] text-muted-foreground truncate flex-1">{pair.baseToken.name}</span>
                  <span className={`text-[9px] font-mono ${(pair.priceChange?.h24 || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {pair.priceChange?.h24 > 0 ? "+" : ""}{pair.priceChange?.h24?.toFixed(1)}%
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground/50 text-center py-6">No tokens added yet</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/10 hover:bg-white/[0.03] border border-border/10 group transition-colors">
            <img src={`https://api.dicebear.com/7.x/shapes/svg?seed=${item.token_symbol}`} className="w-7 h-7 rounded-full border border-primary/20" alt="" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{item.token_symbol}</p>
              <p className="text-[9px] text-muted-foreground/60 truncate">{item.token_name}</p>
            </div>
            <a href={`https://dexscreener.com/solana/${item.token_address}`} target="_blank" rel="noopener" className="p-1 text-muted-foreground/40 hover:text-primary transition-colors">
              <ExternalLink className="h-3 w-3" />
            </a>
            <button onClick={() => removeToken(item.id)} className="p-1 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
