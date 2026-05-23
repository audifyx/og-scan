import { useState, useEffect } from "react";
import {
  Users, Plus, ChevronLeft, Lock, Globe, Search, LineChart,
  MessageSquare, Coins, Volume2, Settings, Trash2, Share, Crown,
  Pin, UserCheck, Eye, Mic, MicOff, Shield
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LobbyChat } from "@/components/lobbies/LobbyChat";
import { LobbyWatchlist } from "@/components/lobbies/LobbyWatchlist";
import { VoicePanel } from "@/components/lobbies/VoicePanel";
import { AppLayout } from "@/components/layout/AppLayout";
import { toast } from "sonner";

interface Lobby {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  creator_name: string | null;
  creator_avatar: string | null;
  privacy: string;
  chart_pair: any;
  member_count: number;
  is_active: boolean;
  created_at: string;
}

interface LobbyMember {
  id: string;
  user_id: string;
  role: string | null;
  joined_at: string | null;
  username?: string;
  avatar_url?: string;
}

const CRYPTO_AVATARS = [
  "bitcoin", "ethereum", "solana", "doge", "pepe", "shiba",
  "polygon", "avalanche", "cardano", "chainlink", "uniswap", "aave",
  "bonk", "jup", "ray", "orca", "mango", "serum", "step", "atlas",
];

const TradingLobbies = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [activeLobby, setActiveLobby] = useState<Lobby | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrivacy, setNewPrivacy] = useState("public");
  const [creating, setCreating] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chart" | "watchlist" | "chat" | "members">("chart");
  const [chartSearch, setChartSearch] = useState("");
  const [chartResults, setChartResults] = useState<any[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [activeMembers, setActiveMembers] = useState<LobbyMember[]>([]);
  const [showMembers, setShowMembers] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    fetchLobbies();
    const channel = supabase
      .channel("lobbies-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "trading_lobbies" }, () => fetchLobbies())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Fetch active members when lobby is selected
  useEffect(() => {
    if (!activeLobby) return;
    fetchMembers(activeLobby.id);
    const channel = supabase
      .channel(`lobby-members-${activeLobby.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lobby_members", filter: `lobby_id=eq.${activeLobby.id}` },
        () => fetchMembers(activeLobby.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeLobby?.id]);

  // Chart sync - listen for chart_pair changes
  useEffect(() => {
    if (!activeLobby) return;
    const channel = supabase
      .channel(`lobby-chart-${activeLobby.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trading_lobbies", filter: `id=eq.${activeLobby.id}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.chart_pair) {
            setActiveLobby(prev => prev ? { ...prev, chart_pair: updated.chart_pair } : null);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeLobby?.id]);

  const fetchLobbies = async () => {
    const { data } = await supabase
      .from("trading_lobbies")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (data) setLobbies(data);
  };

  const fetchMembers = async (lobbyId: string) => {
    const { data } = await supabase
      .from("lobby_members")
      .select("*")
      .eq("lobby_id", lobbyId);
    if (!data) return;
    // Fetch profiles
    const userIds = data.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url")
      .in("user_id", userIds);
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    setActiveMembers(data.map(m => ({
      ...m,
      username: profileMap.get(m.user_id)?.username || undefined,
      avatar_url: profileMap.get(m.user_id)?.avatar_url || undefined,
    })));
  };

  const createLobby = async () => {
    if (!newName.trim() || !user) return;
    setCreating(true);
    const { data, error } = await supabase.from("trading_lobbies").insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      created_by: user.id,
      creator_name: profile?.username || user.email?.split("@")[0],
      creator_avatar: profile?.avatar_url,
      privacy: newPrivacy,
    }).select().single();

    if (data) {
      await supabase.from("lobby_members").insert({
        lobby_id: data.id,
        user_id: user.id,
        role: "creator",
      });
      setActiveLobby(data);
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
    }
    setCreating(false);
  };

  const joinLobby = async (lobby: Lobby) => {
    if (!user) return;
    await supabase.from("lobby_members").upsert({
      lobby_id: lobby.id,
      user_id: user.id,
    }, { onConflict: "lobby_id,user_id" });
    setActiveLobby(lobby);
  };

  const leaveLobby = async () => {
    if (!user || !activeLobby) return;
    await supabase.from("lobby_members").delete()
      .eq("lobby_id", activeLobby.id)
      .eq("user_id", user.id);
    setActiveLobby(null);
    setActiveMembers([]);
  };

  const deleteLobby = async (id: string) => {
    await supabase.from("trading_lobbies").delete().eq("id", id);
    if (activeLobby?.id === id) setActiveLobby(null);
    toast.success("Lobby deleted");
  };

  // Chart search
  useEffect(() => {
    if (!chartSearch.trim()) { setChartResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${chartSearch}`);
        const data = await res.json();
        setChartResults((data.pairs || []).filter((p: any) => p.chainId === "solana").slice(0, 8));
      } catch { setChartResults([]); }
    }, 500);
    return () => clearTimeout(timer);
  }, [chartSearch]);

  const updateChart = async (pair: any) => {
    if (!activeLobby) return;
    const chartPair = {
      chainId: pair.chainId,
      pairAddress: pair.pairAddress,
      symbol: `${pair.baseToken.symbol}/${pair.quoteToken.symbol}`,
    };
    await supabase.from("trading_lobbies").update({ chart_pair: chartPair }).eq("id", activeLobby.id);
    setActiveLobby({ ...activeLobby, chart_pair: chartPair });
    setChartSearch("");
    setChartResults([]);
    toast.success("Chart synced for all users!");
  };

  const filteredLobbies = lobbies.filter((l) =>
    !searchFilter || l.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Active lobby view
  if (activeLobby) {
    const chartPair = activeLobby.chart_pair || {};
    const chartUrl = chartPair.pairAddress
      ? `https://dexscreener.com/${chartPair.chainId || "solana"}/${chartPair.pairAddress}?embed=1&theme=dark&trades=0&info=0`
      : `https://dexscreener.com/solana?embed=1&theme=dark`;
    const isCreator = activeLobby.created_by === user?.id;

    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-60px)] lg:h-screen">
          {/* Header */}
          <div className="shrink-0 border-b border-primary/10 bg-card/50 backdrop-blur-xl p-3 flex items-center gap-3">
            <button onClick={() => { leaveLobby(); }} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold font-display flex items-center gap-2">
                {activeLobby.name}
                {activeLobby.privacy === "private" && <Lock className="h-3 w-3 text-muted-foreground" />}
                {isCreator && <Badge className="text-[7px] bg-primary/10 text-primary border-primary/20 h-4">OWNER</Badge>}
              </h2>
              <p className="text-[9px] text-muted-foreground flex items-center gap-2">
                Chart: {chartPair.symbol || "SOL/USDC"}
                <span className="flex items-center gap-1">
                  <Users className="h-2.5 w-2.5" /> {activeMembers.length} online
                </span>
              </p>
            </div>

            {/* Active Members Avatars */}
            <div className="hidden lg:flex items-center -space-x-2">
              {activeMembers.slice(0, 5).map(m => (
                <div key={m.id} className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent border-2 border-card flex items-center justify-center text-primary-foreground text-[8px] font-bold">
                  {m.avatar_url ? (
                    <img src={m.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${m.user_id}`} className="w-full h-full rounded-full object-cover" alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=fallback`; }} />
                  ) : (
                    m.username?.charAt(0).toUpperCase() || "?"
                  )}
                </div>
              ))}
              {activeMembers.length > 5 && (
                <div className="w-7 h-7 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                  +{activeMembers.length - 5}
                </div>
              )}
            </div>

            <button onClick={() => setShowMembers(!showMembers)} className="p-2 rounded-lg bg-muted/20 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors">
              <Users className="h-4 w-4" />
            </button>

            <div className="hidden lg:flex relative w-56">
              <input
                value={chartSearch}
                onChange={(e) => setChartSearch(e.target.value)}
                placeholder="Sync chart..."
                className="w-full bg-muted/20 border border-border/30 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30"
              />
              {chartResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/40 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto">
                  {chartResults.map((pair: any, i: number) => (
                    <button key={i} onClick={() => updateChart(pair)} className="w-full text-left p-2 hover:bg-primary/10 flex justify-between text-xs transition-colors">
                      <span className="font-semibold">{pair.baseToken.symbol}/{pair.quoteToken.symbol}</span>
                      <span className="text-muted-foreground">{pair.dexId}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                const url = `${window.location.origin}/lobbies?id=${activeLobby.id}`;
                navigator.clipboard.writeText(url);
                toast.success("Lobby link copied!");
              }}
              className="p-2 rounded-lg bg-muted/20 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Share className="h-4 w-4" />
            </button>

            {isCreator && (
              <button
                onClick={() => { if (confirm("Delete this lobby?")) deleteLobby(activeLobby.id); }}
                className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Mobile tabs */}
          <div className="flex lg:hidden border-b border-border/20 bg-card/30 shrink-0">
            {[
              { key: "chart", icon: LineChart, label: "Chart" },
              { key: "watchlist", icon: Coins, label: "Watchlist" },
              { key: "chat", icon: MessageSquare, label: "Chat" },
              { key: "members", icon: Users, label: `Members (${activeMembers.length})` },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setMobileTab(key as any)}
                className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors ${
                  mobileTab === key ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 flex">
            {/* Desktop: 3 columns */}
            <div className="hidden lg:flex flex-1 gap-3 p-3 min-h-0">
              <div className="flex-[2] min-w-0 flex flex-col gap-3">
                <div className="flex-1 glass-card rounded-xl overflow-hidden">
                  <iframe src={chartUrl} className="w-full h-full border-0" title="DexScreener Chart" />
                </div>
                <VoicePanel lobbyId={activeLobby.id} lobbyName={activeLobby.name} />
              </div>
              <div className={`${showMembers ? 'w-96' : 'w-80'} flex flex-col gap-3 min-h-0 transition-all`}>
                {showMembers ? (
                  <MembersPanel members={activeMembers} creatorId={activeLobby.created_by} />
                ) : (
                  <>
                    <div className="flex-1 min-h-0">
                      <LobbyChat lobbyId={activeLobby.id} />
                    </div>
                    <div className="h-64">
                      <LobbyWatchlist lobbyId={activeLobby.id} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Mobile: tabbed */}
            <div className="flex lg:hidden flex-1 flex-col min-h-0">
              {mobileTab === "chart" && (
                <div className="flex-1 flex flex-col gap-2 p-2 min-h-0">
                  {/* Mobile chart search */}
                  <div className="relative">
                    <input
                      value={chartSearch}
                      onChange={(e) => setChartSearch(e.target.value)}
                      placeholder="Search to sync chart..."
                      className="w-full bg-muted/20 border border-border/30 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30"
                    />
                    {chartResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/40 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto">
                        {chartResults.map((pair: any, i: number) => (
                          <button key={i} onClick={() => updateChart(pair)} className="w-full text-left p-2 hover:bg-primary/10 flex justify-between text-xs">
                            <span className="font-semibold">{pair.baseToken.symbol}/{pair.quoteToken.symbol}</span>
                            <span className="text-muted-foreground">{pair.dexId}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 glass-card rounded-xl overflow-hidden">
                    <iframe src={chartUrl} className="w-full h-full border-0" title="Chart" />
                  </div>
                  <VoicePanel lobbyId={activeLobby.id} lobbyName={activeLobby.name} />
                </div>
              )}
              {mobileTab === "watchlist" && (
                <div className="flex-1 p-2 min-h-0">
                  <LobbyWatchlist lobbyId={activeLobby.id} />
                </div>
              )}
              {mobileTab === "chat" && (
                <div className="flex-1 p-2 min-h-0">
                  <LobbyChat lobbyId={activeLobby.id} />
                </div>
              )}
              {mobileTab === "members" && (
                <div className="flex-1 p-2 min-h-0">
                  <MembersPanel members={activeMembers} creatorId={activeLobby.created_by} />
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Lobby list view
  return (
    <AppLayout>
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold font-display gradient-text flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              TRADING LOBBIES
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Trade together. Watch together. Win together.</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="btn-3d bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl gap-1.5 text-xs">
            <Plus className="h-4 w-4" /> Create
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          <input
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search lobbies..."
            className="w-full bg-muted/15 border border-border/30 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30"
          />
        </div>

        {showCreate && (
          <div className="glass-card rounded-2xl p-5 border border-primary/15 space-y-4">
            <h3 className="text-sm font-bold font-display gradient-text">CREATE NEW LOBBY</h3>
            <div className="space-y-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Lobby name..." className="w-full bg-muted/15 border border-border/30 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30" />
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" className="w-full bg-muted/15 border border-border/30 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30" />
              <div className="flex gap-2">
                {["public", "private", "invite-only"].map(p => (
                  <button key={p} onClick={() => setNewPrivacy(p)} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${newPrivacy === p ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted/15 text-muted-foreground border border-border/20"}`}>
                    {p === "public" ? <Globe className="h-3.5 w-3.5" /> : p === "private" ? <Lock className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                    {p.charAt(0).toUpperCase() + p.slice(1).replace("-", " ")}
                  </button>
                ))}
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-2 font-semibold">Lobby Avatar</p>
                <div className="flex flex-wrap gap-2">
                  {CRYPTO_AVATARS.slice(0, 10).map((seed) => (
                    <button key={seed} className="w-9 h-9 rounded-full border border-border/30 hover:border-primary/50 overflow-hidden transition-colors hover:scale-110">
                      <img src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${seed}`} className="w-full h-full" alt={seed} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowCreate(false)} className="rounded-xl text-xs">Cancel</Button>
              <Button onClick={createLobby} disabled={!newName.trim() || creating} className="btn-3d bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl text-xs">
                {creating ? "Creating..." : "Create Lobby"}
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredLobbies.map((lobby) => (
            <button
              key={lobby.id}
              onClick={() => joinLobby(lobby)}
              className="glass-card rounded-2xl p-4 text-left hover:border-primary/30 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/20 via-accent/10 to-transparent" />
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/15 flex items-center justify-center shrink-0">
                  <img src={lobby.creator_avatar || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${lobby.name}`} className="w-8 h-8 rounded-lg" alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(lobby.name)}`; }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold truncate group-hover:text-primary transition-colors">{lobby.name}</h3>
                    {lobby.privacy !== "public" && <Lock className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
                  </div>
                  {lobby.description && (
                    <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{lobby.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
                      <Users className="h-2.5 w-2.5" /> {lobby.member_count || 0}
                    </span>
                    <span className="text-[9px] text-muted-foreground/50">by {lobby.creator_name || "Unknown"}</span>
                    <Badge className={`text-[8px] h-4 px-1.5 ${
                      lobby.privacy === "private" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                      lobby.privacy === "invite-only" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                      "bg-green-500/10 text-green-400 border-green-500/20"
                    }`}>{lobby.privacy}</Badge>
                    {lobby.created_by === user?.id && (
                      <Badge className="text-[8px] bg-primary/10 text-primary border-primary/20 h-4 px-1.5">YOURS</Badge>
                    )}
                  </div>
                </div>
              </div>
              {lobby.created_by === user?.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm("Delete this lobby?")) deleteLobby(lobby.id); }}
                  className="absolute top-3 right-3 p-1.5 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </button>
          ))}
        </div>

        {filteredLobbies.length === 0 && (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/50">No lobbies found. Create the first one!</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

const MembersPanel = ({ members, creatorId }: { members: LobbyMember[]; creatorId: string }) => (
  <div className="glass-card rounded-xl p-4 h-full overflow-auto">
    <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
      <Users className="h-4 w-4 text-primary" />
      Active Members ({members.length})
    </h3>
    <div className="space-y-2">
      {members.map(m => (
        <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-xs font-bold">
            {m.avatar_url ? (
              <img src={m.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${m.user_id}`} className="w-full h-full rounded-full object-cover" alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=fallback`; }} />
            ) : (
              m.username?.charAt(0).toUpperCase() || "?"
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{m.username || "Anonymous"}</p>
            <p className="text-[9px] text-muted-foreground">{m.role || "member"}</p>
          </div>
          {m.user_id === creatorId && (
            <Badge className="text-[7px] bg-primary/10 text-primary border-primary/20">
              <Crown className="h-2.5 w-2.5 mr-0.5" /> Owner
            </Badge>
          )}
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Online" />
        </div>
      ))}
      {members.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">No members yet</p>
      )}
    </div>
  </div>
);

export default TradingLobbies;
