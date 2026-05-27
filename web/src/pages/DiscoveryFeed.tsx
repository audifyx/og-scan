/**
 * DiscoveryFeed — ogscan.fun/discover
 *
 * Advanced smart discovery: personalised For You feed, trending spaces,
 * live right now, full search (spaces, hosts, shows, rooms), topic filters,
 * following-only view, featured hosts, and external stream cards.
 *
 * No AI. Pure engagement signals + follower graph.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search, Flame, Zap, Users, Radio, Globe, Star, Hash,
  Play, Clock, TrendingUp, ChevronRight, Filter, X, Mic,
  Headphones, Calendar, ExternalLink, RefreshCw, Sparkles,
  BookOpen, Layers, MessageSquare, ArrowUpRight,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { safeAvatarUrl } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
interface SpaceCard {
  id: string;
  title: string;
  host_username: string;
  host_avatar: string | null;
  host_id: string;
  listener_count: number;
  peak_listeners: number;
  category: string | null;
  tags: string[] | null;
  is_live: boolean;
  scheduled_for: string | null;
  created_at: string;
  ended_at: string | null;
  topic: string | null;
  rsvp_count?: number;
}

interface HostCard {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number;
  page_accent: string | null;
  is_live?: boolean;
}

interface ExternalStreamCard {
  id: string;
  user_id: string;
  username: string | null;
  platform: "twitch" | "youtube" | "linkedin" | "facebook" | "other";
  stream_url: string;
  title: string | null;
  thumbnail_url: string | null;
  viewer_count: number | null;
  is_live: boolean;
  created_at: string;
}

interface ShowCard {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  description: string | null;
  episode_count: number;
  follower_count: number;
  category: string | null;
  host_id: string;
  host_username?: string;
}

type FeedTab = "foryou" | "live" | "trending" | "following" | "shows" | "rooms";

// ────────────────────────────────────────────────────────────────────────────
// Accent colours
// ────────────────────────────────────────────────────────────────────────────
const ACCENT: Record<string, string> = {
  violet: "#7c3aed", sky: "#0284c7", emerald: "#059669",
  amber: "#d97706", rose: "#e11d48", cyan: "#0891b2",
  pink: "#db2777", indigo: "#4f46e5",
};
const accentColor = (a: string | null | undefined) => ACCENT[a || "violet"] || ACCENT.violet;

const PLATFORM_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  twitch:   { icon: "🟣", color: "#9146FF", label: "Twitch" },
  youtube:  { icon: "🔴", color: "#FF0000", label: "YouTube" },
  linkedin: { icon: "🔵", color: "#0A66C2", label: "LinkedIn" },
  facebook: { icon: "🔵", color: "#1877F2", label: "Facebook" },
  other:    { icon: "🌐", color: "#6b7280", label: "Live" },
};

const CATEGORIES = ["All", "Crypto", "Trading", "DeFi", "NFTs", "Market", "Tech", "Community", "News", "Other"];

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────
function LiveBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[9px] font-bold tracking-wider border border-red-500/30">
      <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
      LIVE · {count}
    </span>
  );
}

function SpaceCardView({ space, onRsvp }: { space: SpaceCard; onRsvp?: (id: string) => void }) {
  const isLive = space.is_live;
  const isScheduled = !isLive && space.scheduled_for && new Date(space.scheduled_for) > new Date();
  return (
    <Link
      to={isLive ? `/space/${space.id}` : `/space/${space.id}`}
      className="group flex flex-col gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07] hover:border-white/[0.12] transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isLive && <LiveBadge count={space.listener_count} />}
            {isScheduled && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-[9px] font-bold border border-violet-500/30">
                <Calendar className="h-2.5 w-2.5" />
                {formatDistanceToNow(new Date(space.scheduled_for!), { addSuffix: true })}
              </span>
            )}
            {space.category && (
              <span className="text-[9px] text-white/30 font-medium px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
                {space.category}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-white/90 leading-snug line-clamp-2 group-hover:text-white transition-colors">{space.title}</p>
          {space.topic && <p className="text-xs text-white/35 mt-0.5 line-clamp-1">{space.topic}</p>}
        </div>
        <div className="shrink-0 flex items-center justify-center h-9 w-9 rounded-full bg-white/[0.06] border border-white/[0.1]">
          {isLive ? <Radio className="h-4 w-4 text-red-400 animate-pulse" /> : <Clock className="h-4 w-4 text-white/40" />}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full overflow-hidden bg-white/[0.08] border border-white/[0.1]">
            {space.host_avatar ? (
              <img src={safeAvatarUrl(space.host_avatar)} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-[9px] text-white/40 font-bold">
                {(space.host_username || "?")[0].toUpperCase()}
              </div>
            )}
          </div>
          <span className="text-xs text-white/50">@{space.host_username}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-white/30">
          <span className="flex items-center gap-1"><Headphones className="h-3 w-3" />{isLive ? space.listener_count : (space.peak_listeners || 0)}</span>
          {isScheduled && onRsvp && (
            <button
              onClick={e => { e.preventDefault(); onRsvp(space.id); }}
              className="px-2 py-0.5 rounded-full bg-violet-600/30 text-violet-300 border border-violet-500/40 hover:bg-violet-600/50 transition-colors text-[9px] font-medium"
            >
              RSVP
            </button>
          )}
        </div>
      </div>
      {space.tags && space.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {space.tags.slice(0, 4).map(tag => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-white/30 border border-white/[0.05]">#{tag}</span>
          ))}
        </div>
      )}
    </Link>
  );
}

function HostCardView({ host }: { host: HostCard }) {
  const color = accentColor(host.page_accent);
  return (
    <Link to={`/u/${host.username}`} className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07] hover:border-white/[0.12] transition-all">
      <div className="relative shrink-0">
        <div
          className="h-10 w-10 rounded-full overflow-hidden border-2 transition-all"
          style={{ borderColor: host.is_live ? "#ef4444" : `${color}44` }}
        >
          {host.avatar_url ? (
            <img src={safeAvatarUrl(host.avatar_url)} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-sm font-bold" style={{ background: color + "33", color }}>
              {(host.username || "?")[0].toUpperCase()}
            </div>
          )}
        </div>
        {host.is_live && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 border-2 border-[#0f0f1a] animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-white/80 truncate">{host.display_name || host.username}</p>
          {host.is_live && <span className="text-[8px] text-red-400 font-bold">LIVE</span>}
        </div>
        <p className="text-[10px] text-white/35 truncate">@{host.username} · {host.followers_count} followers</p>
        {host.bio && <p className="text-[10px] text-white/25 truncate mt-0.5">{host.bio}</p>}
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 shrink-0 transition-colors" />
    </Link>
  );
}

function ExternalStreamCardView({ card }: { card: ExternalStreamCard }) {
  const p = PLATFORM_ICONS[card.platform] || PLATFORM_ICONS.other;
  return (
    <a href={card.stream_url} target="_blank" rel="noopener noreferrer"
      className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07] hover:border-white/[0.12] transition-all">
      {card.thumbnail_url ? (
        <img src={card.thumbnail_url} alt="" className="h-12 w-20 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="h-12 w-20 rounded-lg shrink-0 flex items-center justify-center text-2xl" style={{ backgroundColor: p.color + "22" }}>
          {p.icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border" style={{ color: p.color, borderColor: p.color + "44", background: p.color + "15" }}>
            {p.icon} {p.label}
          </span>
          {card.is_live && <LiveBadge count={card.viewer_count || 0} />}
        </div>
        <p className="text-xs font-semibold text-white/80 line-clamp-1">{card.title || "Live Stream"}</p>
        <p className="text-[10px] text-white/35">@{card.username || "unknown"}</p>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 shrink-0 transition-colors" />
    </a>
  );
}

function ShowCardView({ show }: { show: ShowCard }) {
  return (
    <Link to={`/show/${show.slug}`} className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07] hover:border-white/[0.12] transition-all">
      {show.cover_url ? (
        <img src={show.cover_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0 border border-white/[0.08]" />
      ) : (
        <div className="h-12 w-12 rounded-lg shrink-0 bg-violet-900/40 border border-violet-500/20 flex items-center justify-center">
          <BookOpen className="h-5 w-5 text-violet-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white/80 truncate">{show.title}</p>
        <p className="text-[10px] text-white/35">{show.episode_count} eps · {show.follower_count} followers</p>
        {show.description && <p className="text-[10px] text-white/25 truncate">{show.description}</p>}
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 shrink-0 transition-colors" />
    </Link>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────
export default function DiscoveryFeed() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<FeedTab>("foryou");
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Data
  const [liveSpaces, setLiveSpaces] = useState<SpaceCard[]>([]);
  const [scheduledSpaces, setScheduledSpaces] = useState<SpaceCard[]>([]);
  const [trendingSpaces, setTrendingSpaces] = useState<SpaceCard[]>([]);
  const [featuredHosts, setFeaturedHosts] = useState<HostCard[]>([]);
  const [externalStreams, setExternalStreams] = useState<ExternalStreamCard[]>([]);
  const [shows, setShows] = useState<ShowCard[]>([]);
  const [followingSpaces, setFollowingSpaces] = useState<SpaceCard[]>([]);
  const [searchResults, setSearchResults] = useState<{ spaces: SpaceCard[]; hosts: HostCard[] } | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      // Parallel fetch
      const [
        { data: live },
        { data: scheduled },
        { data: trending },
        { data: hosts },
        { data: extStreams },
        { data: showsData },
      ] = await Promise.all([
        supabase.from("spaces").select("*").eq("is_live", true).order("listener_count", { ascending: false }).limit(30),
        supabase.from("spaces").select("*").eq("is_live", false).is("ended_at", null).not("scheduled_for", "is", null).gte("scheduled_for", new Date().toISOString()).order("scheduled_for", { ascending: true }).limit(20),
        supabase.from("spaces").select("*").eq("is_live", false).not("ended_at", "is", null).order("peak_listeners", { ascending: false }).limit(30),
        supabase.from("profiles").select("user_id,username,display_name,avatar_url,bio,followers_count,page_accent").order("followers_count", { ascending: false }).limit(20),
        supabase.from("external_stream_cards").select("*").eq("is_live", true).order("created_at", { ascending: false }).limit(20),
        supabase.from("space_shows").select("*,profiles(username)").eq("is_published", true).order("follower_count", { ascending: false }).limit(20),
      ]);

      setLiveSpaces((live as SpaceCard[]) || []);
      setScheduledSpaces((scheduled as SpaceCard[]) || []);
      setTrendingSpaces((trending as SpaceCard[]) || []);

      // Mark hosts as live if they have a live space
      const liveHostIds = new Set((live || []).map((s: any) => s.host_id));
      setFeaturedHosts(((hosts || []) as HostCard[]).map(h => ({ ...h, is_live: liveHostIds.has(h.user_id) })));
      setExternalStreams((extStreams as ExternalStreamCard[]) || []);
      setShows(((showsData || []) as any[]).map(s => ({
        ...s,
        host_username: s.profiles?.username,
      })) as ShowCard[]);

      // Following feed
      if (user) {
        const { data: followedUsers } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
        if (followedUsers && followedUsers.length > 0) {
          const ids = followedUsers.map((f: any) => f.following_id);
          const { data: fSpaces } = await supabase.from("spaces").select("*").in("host_id", ids).or("is_live.eq.true,ended_at.is.null").order("created_at", { ascending: false }).limit(30);
          setFollowingSpaces((fSpaces as SpaceCard[]) || []);
        }
      }
    } catch (e) {
      // silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const q = `%${searchQuery.trim()}%`;
      const [{ data: spaces }, { data: profiles }] = await Promise.all([
        supabase.from("spaces").select("*").or(`title.ilike.${q},topic.ilike.${q},category.ilike.${q}`).limit(20),
        supabase.from("profiles").select("user_id,username,display_name,avatar_url,bio,followers_count,page_accent").or(`username.ilike.${q},display_name.ilike.${q},bio.ilike.${q}`).limit(10),
      ]);
      setSearchResults({ spaces: (spaces as SpaceCard[]) || [], hosts: (profiles as HostCard[]) || [] });
    }, 300);
  }, [searchQuery]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh live data every 30s
  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  // RSVP
  const handleRsvp = async (spaceId: string) => {
    if (!user) { toast.error("Sign in to RSVP"); return; }
    const { error } = await supabase.from("space_rsvps").upsert({ space_id: spaceId, user_id: user.id, rsvp_type: "going" }, { onConflict: "space_id,user_id" });
    if (error) toast.error("Failed to RSVP");
    else toast.success("RSVP'd! We'll remind you.");
  };

  // Category filter
  const filterByCategory = (spaces: SpaceCard[]) => {
    if (categoryFilter === "All") return spaces;
    return spaces.filter(s => s.category?.toLowerCase() === categoryFilter.toLowerCase() || s.tags?.some(t => t.toLowerCase() === categoryFilter.toLowerCase()));
  };

  // Tab data
  const tabData: Record<FeedTab, SpaceCard[]> = {
    foryou: filterByCategory([...liveSpaces, ...scheduledSpaces]),
    live: filterByCategory(liveSpaces),
    trending: filterByCategory(trendingSpaces),
    following: filterByCategory(followingSpaces),
    shows: [],
    rooms: [],
  };

  const TABS: { key: FeedTab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: "foryou", label: "For You", icon: Sparkles, count: tabData.foryou.length },
    { key: "live", label: "Live Now", icon: Radio, count: liveSpaces.length },
    { key: "trending", label: "Trending", icon: TrendingUp, count: trendingSpaces.length },
    { key: "following", label: "Following", icon: Users, count: followingSpaces.length },
    { key: "shows", label: "Shows", icon: Layers, count: shows.length },
    { key: "rooms", label: "Rooms", icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white font-sans">
      <Toaster />

      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-30 bg-[#0f0f1a]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-3 py-3">
            <button onClick={() => navigate(-1)} className="shrink-0 flex items-center gap-1 text-sm text-white/40 hover:text-white transition-colors group">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Search spaces, hosts, shows…"
                className="w-full pl-9 pr-4 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.08] transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <button
              onClick={() => load(true)}
              className={`shrink-0 h-9 w-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.1] transition-all ${refreshing ? "animate-spin" : ""}`}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all ${categoryFilter === cat ? "bg-violet-600/30 text-violet-300 border-violet-500/40" : "bg-white/[0.04] text-white/40 border-white/[0.06] hover:border-white/[0.12] hover:text-white/60"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-24">

        {/* ── Search Results ── */}
        {searchQuery && searchFocused && searchResults && (
          <div className="mt-4 mb-6 space-y-4">
            {searchResults.spaces.length > 0 && (
              <div>
                <p className="text-xs text-white/40 font-medium mb-2 flex items-center gap-1.5"><Radio className="h-3 w-3" /> Spaces</p>
                <div className="space-y-2">
                  {searchResults.spaces.map(s => <SpaceCardView key={s.id} space={s} onRsvp={handleRsvp} />)}
                </div>
              </div>
            )}
            {searchResults.hosts.length > 0 && (
              <div>
                <p className="text-xs text-white/40 font-medium mb-2 flex items-center gap-1.5"><Users className="h-3 w-3" /> Hosts</p>
                <div className="space-y-2">
                  {searchResults.hosts.map(h => <HostCardView key={h.user_id} host={h} />)}
                </div>
              </div>
            )}
            {searchResults.spaces.length === 0 && searchResults.hosts.length === 0 && (
              <p className="text-sm text-white/30 text-center py-8">No results for "{searchQuery}"</p>
            )}
          </div>
        )}

        {/* ── Live Now Strip ── */}
        {!searchQuery && liveSpaces.length > 0 && (
          <div className="mt-6 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                Live Now
                <span className="text-[10px] text-white/30 font-normal ml-0.5">{liveSpaces.length} spaces</span>
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
              {liveSpaces.slice(0, 8).map(space => (
                <Link key={space.id} to={`/space/${space.id}`} className="shrink-0 w-44 flex flex-col gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07] hover:border-red-500/20 transition-all group">
                  <div className="flex items-center justify-between">
                    <LiveBadge count={space.listener_count} />
                    <Radio className="h-3 w-3 text-red-400 animate-pulse" />
                  </div>
                  <p className="text-xs font-semibold text-white/85 leading-snug line-clamp-2 group-hover:text-white transition-colors">{space.title}</p>
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full overflow-hidden bg-white/[0.08]">
                      {space.host_avatar ? <img src={safeAvatarUrl(space.host_avatar)} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <span className="text-[10px] text-white/40 truncate">@{space.host_username}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── External Stream Cards ── */}
        {!searchQuery && externalStreams.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <Globe className="h-4 w-4 text-white/40" />
                Streaming Live Elsewhere
              </h2>
            </div>
            <div className="space-y-2">
              {externalStreams.slice(0, 5).map(card => <ExternalStreamCardView key={card.id} card={card} />)}
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        {!searchQuery && (
          <>
            <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-none">
              {TABS.map(({ key, label, icon: Icon, count }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === key ? "bg-violet-600/30 text-violet-300 border border-violet-500/40" : "text-white/40 hover:text-white/60 border border-transparent"}`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                  {count != null && count > 0 && (
                    <span className={`text-[9px] px-1 rounded-full ${activeTab === key ? "bg-violet-500/30 text-violet-300" : "bg-white/[0.06] text-white/30"}`}>{count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab: Shows */}
            {activeTab === "shows" && (
              <div className="space-y-2">
                {shows.length === 0 ? (
                  <div className="text-center py-12">
                    <Layers className="h-8 w-8 text-white/20 mx-auto mb-3" />
                    <p className="text-sm text-white/40">No shows yet</p>
                    <p className="text-xs text-white/25 mt-1">Shows are multi-episode series. Hosts create them from their Space settings.</p>
                  </div>
                ) : shows.map(show => <ShowCardView key={show.id} show={show} />)}
              </div>
            )}

            {/* Tab: Featured Hosts (for you sidebar) */}
            {activeTab === "foryou" && featuredHosts.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs text-white/40 font-medium mb-2 flex items-center gap-1.5"><Star className="h-3 w-3" /> Featured Hosts</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {featuredHosts.slice(0, 4).map(h => <HostCardView key={h.user_id} host={h} />)}
                </div>
              </div>
            )}

            {/* Tab: Main space list */}
            {(activeTab === "foryou" || activeTab === "live" || activeTab === "trending" || activeTab === "following") && (
              <div className="space-y-3">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-28 rounded-2xl bg-white/[0.03] border border-white/[0.05] animate-pulse" />
                  ))
                ) : tabData[activeTab].length === 0 ? (
                  <div className="text-center py-12">
                    <Radio className="h-8 w-8 text-white/20 mx-auto mb-3" />
                    <p className="text-sm text-white/40">
                      {activeTab === "following" && !user ? "Sign in to see spaces from people you follow" :
                       activeTab === "following" && followingSpaces.length === 0 ? "Follow some hosts to see their spaces here" :
                       "Nothing here right now — check back soon!"}
                    </p>
                  </div>
                ) : (
                  tabData[activeTab].map(space => <SpaceCardView key={space.id} space={space} onRsvp={handleRsvp} />)
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
