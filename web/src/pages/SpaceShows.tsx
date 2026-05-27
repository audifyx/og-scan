/**
 * SpaceShows — Podcast-style show pages for recurring Spaces.
 * Hosts can create shows, manage episodes, add descriptions/cover art,
 * and listeners can follow shows, browse episodes, and get notified.
 */
import React, { useState, useEffect } from "react";
import {
  Radio, Play, Users, Heart, Bell, BellOff, Plus, ChevronLeft,
  Mic, Calendar, Clock, Star, Share2, Search, Bookmark,
  TrendingUp, Award, ChevronRight, X, Upload, Globe, Lock
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Show {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  host_id: string;
  host_username: string | null;
  host_avatar: string | null;
  category: string | null;
  follower_count: number;
  episode_count: number;
  is_private: boolean;
  created_at: string;
  latest_episode_at: string | null;
}

interface Episode {
  id: string;
  show_id: string;
  title: string;
  description: string | null;
  episode_number: number;
  space_id: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
  listener_count: number;
  scheduled_for: string | null;
  created_at: string;
  status: "upcoming" | "live" | "ended";
}

const CATEGORIES = ["Crypto", "Trading", "NFT", "DeFi", "Education", "News", "Entertainment", "Business", "Tech", "Memes"];

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
const CoverArt = ({ url, title, size = 16 }: { url: string | null; title: string; size?: number }) => (
  <div className={cn(
    `w-${size} h-${size} rounded-2xl bg-gradient-to-br from-violet-600/40 to-purple-800/40 flex items-center justify-center text-2xl font-black text-white/30 overflow-hidden shrink-0 border border-white/[0.08]`,
  )}>
    {url ? <img src={url} alt={title} className="w-full h-full object-cover" /> : title?.[0]?.toUpperCase()}
  </div>
);

const EpisodeCard = ({ ep, onClick }: { ep: Episode; onClick: () => void }) => {
  const dur = ep.duration_seconds
    ? `${Math.floor(ep.duration_seconds / 60)}m`
    : ep.scheduled_for
      ? new Date(ep.scheduled_for).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })
      : null;
  const date = new Date(ep.created_at).toLocaleDateString("en-AU", { month: "short", day: "numeric" });
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] transition-all text-left group"
    >
      <div className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
        ep.status === "live" ? "bg-red-500/20" : "bg-violet-500/10"
      )}>
        {ep.status === "live"
          ? <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          : <Play className="h-3.5 w-3.5 text-violet-400 ml-0.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-white/25">EP{ep.episode_number}</span>
          {ep.status === "live" && <span className="text-[10px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">LIVE</span>}
          {ep.status === "upcoming" && <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">UPCOMING</span>}
        </div>
        <p className="text-sm font-semibold text-white/80 truncate">{ep.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-white/25">{date}</span>
          {dur && <span className="text-xs text-white/25">· {dur}</span>}
          {ep.listener_count > 0 && <span className="text-xs text-white/25">· {ep.listener_count.toLocaleString()} listeners</span>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-white/15 group-hover:text-white/40 transition-colors shrink-0" />
    </button>
  );
};

const ShowCard = ({ show, isFollowing, onFollow, onClick }: {
  show: Show;
  isFollowing: boolean;
  onFollow: (e: React.MouseEvent) => void;
  onClick: () => void;
}) => (
  <button onClick={onClick} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.04] border border-white/[0.05] transition-all w-full text-left hover:border-white/[0.1]">
    <CoverArt url={show.cover_url} title={show.title} size={12} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-black text-white truncate">{show.title}</p>
      <p className="text-xs text-white/30 truncate mt-0.5">{show.host_username || "Unknown host"}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-white/20">{show.episode_count} episodes</span>
        <span className="text-[10px] text-white/20">·</span>
        <span className="text-[10px] text-white/20">{show.follower_count.toLocaleString()} followers</span>
        {show.category && (
          <>
            <span className="text-[10px] text-white/20">·</span>
            <span className="text-[10px] text-violet-400/60">{show.category}</span>
          </>
        )}
      </div>
    </div>
    <button
      onClick={onFollow}
      className={cn(
        "shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
        isFollowing
          ? "bg-white/[0.06] text-white/40 hover:bg-red-500/10 hover:text-red-400"
          : "bg-violet-600/20 text-violet-400 hover:bg-violet-600/40 border border-violet-500/20"
      )}
    >
      {isFollowing ? "Following" : "+ Follow"}
    </button>
  </button>
);

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
const SpaceShows: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<"browse" | "show" | "create">("browse");
  const [shows, setShows] = useState<Show[]>([]);
  const [myShows, setMyShows] = useState<Show[]>([]);
  const [activeShow, setActiveShow] = useState<Show | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [searchQ, setSearchQ] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "following" | "mine">("all");
  const [loading, setLoading] = useState(true);

  // Create show form
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("Crypto");
  const [newPrivate, setNewPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadShows(); }, []);

  const loadShows = async () => {
    setLoading(true);
    const [{ data: allShows }, { data: owned }] = await Promise.all([
      supabase.from("space_shows").select("*").order("follower_count", { ascending: false }).limit(50),
      user ? supabase.from("space_shows").select("*").eq("host_id", user.id) : { data: [] },
    ]);
    setShows((allShows || []) as Show[]);
    setMyShows((owned || []) as Show[]);

    // Load follows
    if (user) {
      const { data: fol } = await supabase
        .from("show_follows")
        .select("show_id")
        .eq("user_id", user.id);
      setFollowing(new Set((fol || []).map((f: any) => f.show_id)));
    }
    setLoading(false);
  };

  const loadEpisodes = async (showId: string) => {
    const { data } = await supabase
      .from("spaces")
      .select("id, title, description, episode_number, recording_url, duration_seconds, listener_count, scheduled_for, created_at, is_live")
      .eq("show_id", showId)
      .order("episode_number", { ascending: false })
      .limit(30);
    const eps: Episode[] = ((data || []) as any[]).map(s => ({
      id: s.id,
      show_id: showId,
      title: s.title || `Episode ${s.episode_number}`,
      description: s.description,
      episode_number: s.episode_number || 0,
      space_id: s.id,
      recording_url: s.recording_url,
      duration_seconds: s.duration_seconds,
      listener_count: s.listener_count || 0,
      scheduled_for: s.scheduled_for,
      created_at: s.created_at,
      status: s.is_live ? "live" : s.scheduled_for && new Date(s.scheduled_for) > new Date() ? "upcoming" : "ended",
    }));
    setEpisodes(eps);
  };

  const toggleFollow = async (e: React.MouseEvent, showId: string) => {
    e.stopPropagation();
    if (!user) return;
    const isFollowing = following.has(showId);
    if (isFollowing) {
      await supabase.from("show_follows").delete().eq("show_id", showId).eq("user_id", user.id);
      setFollowing(prev => { const s = new Set(prev); s.delete(showId); return s; });
      await supabase.from("space_shows").update({ follower_count: shows.find(s => s.id === showId)!.follower_count - 1 }).eq("id", showId);
    } else {
      await supabase.from("show_follows").insert({ show_id: showId, user_id: user.id });
      setFollowing(prev => new Set([...prev, showId]));
      await supabase.from("space_shows").update({ follower_count: (shows.find(s => s.id === showId)?.follower_count || 0) + 1 }).eq("id", showId);
    }
    setShows(prev => prev.map(s => s.id === showId
      ? { ...s, follower_count: s.follower_count + (isFollowing ? -1 : 1) }
      : s
    ));
  };

  const openShow = async (show: Show) => {
    setActiveShow(show);
    await loadEpisodes(show.id);
    setView("show");
  };

  const createShow = async () => {
    if (!newTitle.trim() || !user || creating) return;
    setCreating(true);
    const { data: profile } = await supabase.from("profiles").select("username, avatar_url").eq("id", user.id).single();
    const { data: show } = await supabase.from("space_shows").insert({
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      category: newCategory,
      is_private: newPrivate,
      host_id: user.id,
      host_username: (profile as any)?.username,
      host_avatar: (profile as any)?.avatar_url,
      follower_count: 0,
      episode_count: 0,
    }).select().single();
    if (show) {
      setMyShows(prev => [show as Show, ...prev]);
      setShows(prev => [show as Show, ...prev]);
      openShow(show as Show);
    }
    setNewTitle(""); setNewDesc(""); setCreating(false);
  };

  const filteredShows = (() => {
    let list = activeTab === "mine" ? myShows : activeTab === "following" ? shows.filter(s => following.has(s.id)) : shows;
    if (searchQ) list = list.filter(s => s.title.toLowerCase().includes(searchQ.toLowerCase()) || (s.host_username || "").toLowerCase().includes(searchQ.toLowerCase()));
    return list;
  })();

  if (view === "create") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView("browse")} className="p-2 rounded-xl hover:bg-white/[0.06]">
              <ChevronLeft className="h-5 w-5 text-white/40" />
            </button>
            <h1 className="text-xl font-black">Create a Show</h1>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/40 font-bold uppercase tracking-wide block mb-1.5">Show Title *</label>
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="The OG Alpha Show"
                className="w-full bg-white/[0.05] rounded-xl px-4 py-3 text-sm text-white outline-none placeholder-white/20 border border-white/[0.06] focus:border-violet-500/40"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 font-bold uppercase tracking-wide block mb-1.5">Description</label>
              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="What's this show about?"
                rows={3}
                className="w-full bg-white/[0.05] rounded-xl px-4 py-3 text-sm text-white outline-none placeholder-white/20 border border-white/[0.06] focus:border-violet-500/40 resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 font-bold uppercase tracking-wide block mb-1.5">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setNewCategory(c)}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                      newCategory === c ? "bg-violet-600 text-white" : "bg-white/[0.05] text-white/40 hover:text-white/70"
                    )}>{c}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setNewPrivate(!newPrivate)}
                className={cn("relative w-10 h-5 rounded-full transition-colors", newPrivate ? "bg-violet-600" : "bg-white/[0.1]")}>
                <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", newPrivate ? "left-5" : "left-0.5")} />
              </button>
              <span className="text-sm text-white/60">Private show</span>
            </div>
            <button
              onClick={createShow}
              disabled={!newTitle.trim() || creating}
              className="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 font-black text-sm transition-colors disabled:opacity-40"
            >
              {creating ? "Creating…" : "🎙️ Create Show"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "show" && activeShow) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        {/* Header */}
        <div className="relative">
          <div className="h-32 bg-gradient-to-b from-violet-900/30 to-transparent" />
          <div className="absolute top-4 left-4">
            <button onClick={() => setView("browse")} className="p-2 rounded-xl bg-black/40 backdrop-blur hover:bg-black/60 transition-colors">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
        <div className="px-4 -mt-8 pb-8">
          <div className="flex items-end gap-4 mb-5">
            <CoverArt url={activeShow.cover_url} title={activeShow.title} size={20} />
            <div className="flex-1 min-w-0 pb-1">
              <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">{activeShow.category}</p>
              <h1 className="text-xl font-black text-white leading-tight mt-0.5 truncate">{activeShow.title}</h1>
              <p className="text-sm text-white/40 mt-0.5">{activeShow.host_username}</p>
            </div>
          </div>
          {activeShow.description && (
            <p className="text-sm text-white/50 leading-relaxed mb-5">{activeShow.description}</p>
          )}
          {/* Stats */}
          <div className="flex items-center gap-5 mb-5">
            <div className="text-center">
              <p className="text-lg font-black text-white">{activeShow.follower_count.toLocaleString()}</p>
              <p className="text-[10px] text-white/30 uppercase tracking-wide">Followers</p>
            </div>
            <div className="w-px h-8 bg-white/[0.06]" />
            <div className="text-center">
              <p className="text-lg font-black text-white">{activeShow.episode_count}</p>
              <p className="text-[10px] text-white/30 uppercase tracking-wide">Episodes</p>
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={e => toggleFollow(e, activeShow.id)}
              className={cn(
                "flex-1 py-2.5 rounded-2xl font-black text-sm transition-all",
                following.has(activeShow.id)
                  ? "bg-white/[0.06] text-white/50"
                  : "bg-violet-600 hover:bg-violet-500 text-white"
              )}
            >
              {following.has(activeShow.id) ? "✓ Following" : "+ Follow Show"}
            </button>
            <button className="p-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] transition-colors">
              <Share2 className="h-5 w-5 text-white/40" />
            </button>
            {user?.id === activeShow.host_id && (
              <button className="p-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] transition-colors">
                <Star className="h-5 w-5 text-amber-400" />
              </button>
            )}
          </div>
          {/* Episodes */}
          <h2 className="text-sm font-black text-white/50 uppercase tracking-widest mb-3">Episodes ({episodes.length})</h2>
          {episodes.length === 0 ? (
            <div className="text-center py-10">
              <Mic className="h-8 w-8 text-white/10 mx-auto mb-2" />
              <p className="text-sm text-white/20">No episodes yet</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {episodes.map(ep => (
                <EpisodeCard key={ep.id} ep={ep} onClick={() => ep.space_id && navigate(`/spaces/${ep.space_id}`)} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-white/[0.06]">
            <ChevronLeft className="h-5 w-5 text-white/40" />
          </button>
          <div>
            <h1 className="text-lg font-black text-white">Space Shows</h1>
            <p className="text-xs text-white/30">Recurring shows & podcast feeds</p>
          </div>
        </div>
        <button
          onClick={() => setView("create")}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/20 transition-colors"
        >
          <Plus className="h-4 w-4 text-violet-400" />
          <span className="text-xs font-bold text-violet-400">New Show</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 bg-white/[0.04] rounded-xl px-3 py-2.5 border border-white/[0.06]">
          <Search className="h-4 w-4 text-white/25 shrink-0" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search shows…"
            className="flex-1 bg-transparent text-sm text-white/70 placeholder-white/20 outline-none"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mb-4">
        {(["all", "following", "mine"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold capitalize transition-all",
              activeTab === tab ? "bg-violet-600/20 text-violet-400 border border-violet-500/20" : "text-white/30 hover:text-white/60"
            )}
          >{tab === "mine" ? "My Shows" : tab === "following" ? "Following" : "All Shows"}</button>
        ))}
      </div>

      {/* Show list */}
      <div className="px-4 pb-8 space-y-2">
        {loading ? (
          [...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white/[0.03] animate-pulse" />)
        ) : filteredShows.length === 0 ? (
          <div className="text-center py-16">
            <Radio className="h-12 w-12 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 font-bold">No shows found</p>
            {activeTab === "mine" && (
              <button onClick={() => setView("create")} className="mt-4 px-5 py-2.5 rounded-2xl bg-violet-600/20 text-violet-400 text-sm font-bold hover:bg-violet-600/40 transition-colors">
                Create Your First Show
              </button>
            )}
          </div>
        ) : (
          filteredShows.map(show => (
            <ShowCard
              key={show.id}
              show={show}
              isFollowing={following.has(show.id)}
              onFollow={e => toggleFollow(e, show.id)}
              onClick={() => openShow(show)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default SpaceShows;
