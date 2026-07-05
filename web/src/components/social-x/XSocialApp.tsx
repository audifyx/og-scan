/**
 * XSocialApp — X (Twitter) style shell for the entire OrbitX social app.
 * Three-column layout: left icon/label nav rail, center column, right rail
 * with search / trends / who-to-follow. Every social tab lives here:
 *   Home (timeline) · Explore · Notifications · Messages · Chat · Rooms ·
 *   Spaces · Communities · Profile
 * Heavy tabs are lazy-embedded from their existing pages so no functionality
 * is lost. Designed to fill the parent height (h-full).
 */
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Home, Search, Bell, Mail, Hash, MessageSquare, Radio, Globe, User,
  Feather, X as XIcon, Heart, MessageCircle, Repeat2, Share, MoreHorizontal,
  Trash2, Copy, Flag, BadgeCheck, Loader2, TrendingUp, ArrowUpRight,
  ArrowDownRight, Users, Bookmark, LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn, safeAvatarUrl } from "@/lib/utils";

/* ── Lazy heavy tabs (reuse existing pages — zero functionality lost) ── */
const ChatHub = lazy(() => import("@/pages/SocialHub"));
const RoomsPage = lazy(() => import("@/pages/CommunityRooms"));
const SpacesPage = lazy(() => import("@/pages/Spaces"));
const TradingLobbiesPage = lazy(() => import("@/pages/TradingLobbies"));
const CoinCommunitiesPage = lazy(() => import("@/pages/CoinCommunitiesPage"));
const CommunitiesPage = lazy(() => import("@/pages/Communities"));
const MessagesPage = lazy(() => import("@/pages/DirectMessages"));
const ProfilePage = lazy(() => import("@/components/profile-20x/UserProfile"));

/* ═══════════ Types ═══════════ */
export type XTab =
  | "home" | "explore" | "notifications" | "messages"
  | "chat" | "rooms" | "spaces" | "communities" | "profile";

interface Post {
  id: string; user_id: string; username: string | null; avatar_url: string | null;
  content: string; likes_count: number | null; liked_by: string[] | null; created_at: string;
}
interface Suggestion { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null; is_official_account?: boolean | null; bio?: string | null; }
interface Ticker { mint: string; symbol: string | null; priceUsd: number | null; change24h: number | null; }
interface NotifRow { id: string; type: string; title: string; message: string; is_read: boolean; created_at: string; }

const FEED_CHANNEL = "social-general";
const MAX_LEN = 500;
const BOOKMARKS_KEY = "orbitx-x-bookmarks";

const dicebear = (seed: string) => `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(seed || "og")}`;
const avatarOf = (url: string | null | undefined, seed: string) => safeAvatarUrl(url) || dicebear(seed);

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (isNaN(s) || s < 0) return "now";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderContent(text: string, onMint?: (m: string) => void) {
  const parts: (string | JSX.Element)[] = [];
  const tokenRe = /(\$[A-Za-z][A-Za-z0-9]{1,14}|@[A-Za-z0-9_]{2,20}|#[A-Za-z0-9_]{2,30}|https?:\/\/[^\s]+|[1-9A-HJ-NP-Za-km-z]{32,44})/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("$") || tok.startsWith("@") || tok.startsWith("#")) parts.push(<span key={i++} className="text-[#1d9bf0] hover:underline cursor-pointer">{tok}</span>);
    else if (tok.startsWith("http")) parts.push(<a key={i++} href={tok} target="_blank" rel="noreferrer" className="text-[#1d9bf0] hover:underline break-all">{tok}</a>);
    else if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(tok)) parts.push(<button key={i++} type="button" onClick={() => onMint?.(tok)} className="font-mono text-[12px] text-[#1d9bf0] hover:underline">{tok.slice(0, 4)}…{tok.slice(-4)}</button>);
    else parts.push(tok);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function loadBookmarks(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "[]")); } catch { return new Set(); }
}
function saveBookmarks(s: Set<string>) {
  try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
}

/* ═══════════ Nav config ═══════════ */
const NAV: { id: XTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "explore", label: "Explore", Icon: Search },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "messages", label: "Messages", Icon: Mail },
  { id: "chat", label: "Chat", Icon: Hash },
  { id: "rooms", label: "Rooms", Icon: MessageSquare },
  { id: "spaces", label: "Spaces", Icon: Radio },
  { id: "communities", label: "Communities", Icon: Globe },
  { id: "profile", label: "Profile", Icon: User },
];

/* Old sidebar/CommunityHub deep-link keys -> X shell tabs (keeps every legacy entry point working) */
const ENTRY_MAP: Record<string, XTab> = {
  channels: "chat", social: "chat", rooms: "rooms", voice: "rooms",
  spaces: "spaces", communities: "communities", discover: "communities",
};

function resolveInitialTab(preferred?: XTab): XTab {
  try {
    const entry = localStorage.getItem("og_comm_entry");
    if (entry) {
      localStorage.removeItem("og_comm_entry");
      const mapped = ENTRY_MAP[entry];
      if (mapped) return mapped;
    }
  } catch { /* ignore */ }
  if (preferred) return preferred;
  try {
    const saved = localStorage.getItem("og_x_tab") as XTab | null;
    if (saved && NAV.some((n) => n.id === saved)) return saved;
  } catch { /* ignore */ }
  return "home";
}

/** Tabs that use the classic X 600px center column + right rail. */
const NARROW_TABS: XTab[] = ["home", "explore", "notifications"];

const Spinner = () => (
  <div className="flex h-40 items-center justify-center">
    <Loader2 className="h-5 w-5 animate-spin text-white/30" />
  </div>
);

/* ═══════════ Main component ═══════════ */
export default function XSocialApp({ onSelectMint, initialTab }: { onSelectMint?: (m: string) => void; initialTab?: XTab }) {
  const { user, profile, signOut } = useAuth();
  const [tab, setTab] = useState<XTab>(() => resolveInitialTab(initialTab));
  const [feedMode, setFeedMode] = useState<"foryou" | "following">("foryou");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ticker, setTicker] = useState<Ticker[]>([]);
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(loadBookmarks);
  const [searchQ, setSearchQ] = useState("");
  const [commView, setCommView] = useState<"token" | "og">("token");
  const [roomsView, setRoomsView] = useState<"rooms" | "trading">("rooms");

  /* remember the active tab + honor legacy sidebar deep links */
  useEffect(() => {
    try { localStorage.setItem("og_x_tab", tab); } catch { /* ignore */ }
  }, [tab]);
  useEffect(() => {
    const sync = () => {
      try {
        const entry = localStorage.getItem("og_comm_entry");
        if (!entry) return;
        localStorage.removeItem("og_comm_entry");
        const mapped = ENTRY_MAP[entry];
        if (mapped) setTab(mapped);
      } catch { /* ignore */ }
    };
    window.addEventListener("og:community-sub-tab", sync);
    window.addEventListener("og:comm-entry", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("og:community-sub-tab", sync);
      window.removeEventListener("og:comm-entry", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLTextAreaElement>(null);

  const displayName = profile?.display_name || profile?.username || "You";
  const handle = profile?.username || "anon";
  const myAvatar = avatarOf(profile?.avatar_url, user?.id || "me");

  /* ── Feed data ── */
  const load = useCallback(async () => {
    const { data } = await supabase
      .from("social_messages")
      .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at")
      .eq("channel", FEED_CHANNEL).order("created_at", { ascending: false }).limit(100);
    if (data) setPosts(data as Post[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("x-home-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_messages", filter: `channel=eq.${FEED_CHANNEL}` },
        (p) => { const row = p.new as Post; setPosts((prev) => prev.some((x) => x.id === row.id) ? prev : [row, ...prev]); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "social_messages", filter: `channel=eq.${FEED_CHANNEL}` },
        (p) => { const row = p.new as Post; setPosts((prev) => prev.map((x) => x.id === row.id ? { ...x, likes_count: row.likes_count, liked_by: row.liked_by, content: row.content } : x)); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "social_messages" },
        (p) => { const row = p.old as { id?: string }; if (row?.id) setPosts((prev) => prev.filter((x) => x.id !== row.id)); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => { if (!menuId) return; const h = () => setMenuId(null); document.addEventListener("click", h); return () => document.removeEventListener("click", h); }, [menuId]);

  /* ── Following + suggestions ── */
  useEffect(() => {
    if (!user) return;
    supabase.from("followers").select("followee_id").eq("follower_id", user.id)
      .then(({ data }) => { if (data) setFollowingSet(new Set((data as { followee_id: string }[]).map((r) => r.followee_id))); });
  }, [user]);

  useEffect(() => {
    supabase.from("profiles").select("user_id,username,display_name,avatar_url,is_official_account,bio")
      .not("username", "is", null).order("is_official_account", { ascending: false }).order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => { if (data) setSuggestions(data as Suggestion[]); });
  }, []);

  /* ── Trends (market ticker) ── */
  useEffect(() => {
    let on = true;
    const fetchTicker = () => fetch("/api/ogdex/screener?type=trending&interval=24h&limit=20")
      .then((r) => r.json()).then((d) => { if (on && d?.rows) setTicker((d.rows as Ticker[]).filter((x) => x.symbol).slice(0, 20)); }).catch(() => {});
    fetchTicker();
    const id = setInterval(fetchTicker, 30000);
    return () => { on = false; clearInterval(id); };
  }, []);

  /* ── Notifications ── */
  useEffect(() => {
    if (tab !== "notifications" || !user) return;
    setNotifsLoading(true);
    supabase.from("notifications").select("id,type,title,message,is_read,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { setNotifs((data as NotifRow[]) || []); setNotifsLoading(false); });
  }, [tab, user]);

  const markAllRead = async () => {
    if (!user) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  };

  /* ── Actions ── */
  const follow = async (uid: string) => {
    if (!user) { toast.error("Sign in to follow"); return; }
    setFollowingSet((prev) => new Set(prev).add(uid));
    const { error } = await supabase.from("followers").insert({ follower_id: user.id, followee_id: uid });
    if (error) setFollowingSet((prev) => { const n = new Set(prev); n.delete(uid); return n; });
  };

  const submit = async (raw?: string) => {
    const content = (raw ?? text).trim();
    if (!content || !user || posting) return;
    setPosting(true); setText("");
    const optimistic: Post = { id: `tmp-${Date.now()}`, user_id: user.id, username: profile?.username || "Anon", avatar_url: profile?.avatar_url || null, content, likes_count: 0, liked_by: [], created_at: new Date().toISOString() };
    setPosts((prev) => [optimistic, ...prev]);
    const { data, error } = await supabase.from("social_messages")
      .insert({ channel: FEED_CHANNEL, user_id: user.id, username: profile?.username || "Anon", avatar_url: profile?.avatar_url, content, likes_count: 0, liked_by: [] })
      .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at").single();
    if (error) { toast.error("Could not post. Try again."); setPosts((prev) => prev.filter((p) => p.id !== optimistic.id)); setText(content); }
    else if (data) setPosts((prev) => prev.map((p) => p.id === optimistic.id ? (data as Post) : p));
    setPosting(false);
    setComposeOpen(false);
  };

  const toggleLike = async (post: Post) => {
    if (!user) { toast.error("Sign in to like"); return; }
    if (post.id.startsWith("tmp-")) return;
    const likedBy = post.liked_by || [];
    const liked = likedBy.includes(user.id);
    const nextLikedBy = liked ? likedBy.filter((x) => x !== user.id) : [...likedBy, user.id];
    setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, liked_by: nextLikedBy, likes_count: nextLikedBy.length } : p));
    const { error } = await supabase.from("social_messages").update({ likes_count: nextLikedBy.length, liked_by: nextLikedBy }).eq("id", post.id);
    if (error) setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, liked_by: likedBy, likes_count: likedBy.length } : p));
  };

  const toggleBookmark = (p: Post) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(p.id)) { next.delete(p.id); toast.success("Removed from bookmarks"); }
      else { next.add(p.id); toast.success("Added to bookmarks"); }
      saveBookmarks(next);
      return next;
    });
  };

  const deletePost = async (p: Post) => {
    if (!user || p.user_id !== user.id) return;
    setMenuId(null);
    setPosts((prev) => prev.filter((x) => x.id !== p.id));
    if (!p.id.startsWith("tmp-")) { const { error } = await supabase.from("social_messages").delete().eq("id", p.id).eq("user_id", user.id); if (error) toast.error("Could not delete post"); }
  };

  const repost = (p: Post) => {
    const quoted = `RP @${p.username || "anon"}: ${p.content}`;
    setComposeOpen(true);
    setText(quoted.slice(0, MAX_LEN));
    setTimeout(() => modalRef.current?.focus(), 60);
  };

  const replyTo = (p: Post) => {
    setTab("home");
    setText((t) => t.startsWith(`@${p.username} `) ? t : `@${p.username || "anon"} ${t}`);
    setTimeout(() => composerRef.current?.focus(), 60);
  };

  const share = async (p: Post) => {
    try { await navigator.clipboard.writeText(`${p.content}\n\n${window.location.origin}/social`); toast.success("Copied to clipboard"); } catch { toast.error("Copy failed"); }
  };

  /* ── Derived ── */
  const shownPosts = useMemo(() => {
    if (feedMode === "following") return posts.filter((p) => followingSet.has(p.user_id) || (user && p.user_id === user.id));
    return posts;
  }, [posts, feedMode, followingSet, user]);

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) for (const t of (p.content.match(/[$#][A-Za-z][A-Za-z0-9_]{1,20}/g) || [])) counts.set(t.toUpperCase(), (counts.get(t.toUpperCase()) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [posts]);

  const whoToFollow = suggestions.filter((s) => s.user_id !== user?.id && !followingSet.has(s.user_id));

  const searchedUsers = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    return suggestions.filter((s) => (s.username || "").toLowerCase().includes(q) || (s.display_name || "").toLowerCase().includes(q)).slice(0, 8);
  }, [searchQ, suggestions]);

  const isNarrow = NARROW_TABS.includes(tab);
  const unread = notifs.filter((n) => !n.is_read).length;

  /* ═══════════ Sub-renderers ═══════════ */

  const Composer = ({ inline, refEl }: { inline?: boolean; refEl: React.RefObject<HTMLTextAreaElement> }) => (
    <div className={cn("flex gap-3", inline && "border-b border-white/[0.08] px-4 py-3")}>
      <img src={myAvatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <textarea
          ref={refEl}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
          placeholder="What's happening?"
          rows={inline ? 2 : 4}
          className="w-full resize-none bg-transparent text-[17px] text-white placeholder:text-white/30 outline-none"
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
        />
        <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2">
          <span className={cn("text-[11px] font-bold", text.length > MAX_LEN - 40 ? "text-orange-400" : "text-white/25")}>{text.length}/{MAX_LEN}</span>
          <button
            type="button"
            disabled={!text.trim() || posting}
            onClick={() => submit()}
            className={cn(
              "rounded-full px-5 py-1.5 text-[14px] font-black transition",
              text.trim() && !posting ? "bg-[#1d9bf0] text-white hover:bg-[#1a8cd8]" : "bg-[#1d9bf0]/50 text-white/60",
            )}
          >
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
          </button>
        </div>
      </div>
    </div>
  );

  const PostCard = ({ p }: { p: Post }) => {
    const liked = Boolean(user && (p.liked_by || []).includes(user.id));
    const marked = bookmarks.has(p.id);
    const own = user && p.user_id === user.id;
    return (
      <article className="relative flex gap-3 border-b border-white/[0.08] px-4 py-3 transition hover:bg-white/[0.02]">
        <img src={avatarOf(p.avatar_url, p.user_id)} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[14px]">
            <span className="truncate font-black text-white hover:underline">{p.username || "Anon"}</span>
            <span className="truncate text-white/35">@{(p.username || "anon").toLowerCase().replace(/\s+/g, "")}</span>
            <span className="text-white/30">·</span>
            <span className="shrink-0 text-white/35 hover:underline">{timeAgo(p.created_at)}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id); }} className="ml-auto rounded-full p-1.5 text-white/30 transition hover:bg-[#1d9bf0]/10 hover:text-[#1d9bf0]">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
          <div className="whitespace-pre-wrap break-words text-[15px] leading-snug text-white/90">{renderContent(p.content, onSelectMint)}</div>
          <div className="mt-2 flex max-w-md items-center justify-between text-white/35">
            <button type="button" onClick={() => replyTo(p)} className="group flex items-center gap-1.5 transition hover:text-[#1d9bf0]">
              <span className="rounded-full p-1.5 transition group-hover:bg-[#1d9bf0]/10"><MessageCircle className="h-4 w-4" /></span>
            </button>
            <button type="button" onClick={() => repost(p)} className="group flex items-center gap-1.5 transition hover:text-emerald-400">
              <span className="rounded-full p-1.5 transition group-hover:bg-emerald-400/10"><Repeat2 className="h-4 w-4" /></span>
            </button>
            <button type="button" onClick={() => toggleLike(p)} className={cn("group flex items-center gap-1.5 transition hover:text-pink-500", liked && "text-pink-500")}>
              <span className="rounded-full p-1.5 transition group-hover:bg-pink-500/10"><Heart className={cn("h-4 w-4", liked && "fill-current")} /></span>
              {(p.likes_count ?? 0) > 0 && <span className="text-[12px] font-bold">{p.likes_count}</span>}
            </button>
            <button type="button" onClick={() => toggleBookmark(p)} className={cn("group flex items-center gap-1.5 transition hover:text-[#1d9bf0]", marked && "text-[#1d9bf0]")}>
              <span className="rounded-full p-1.5 transition group-hover:bg-[#1d9bf0]/10"><Bookmark className={cn("h-4 w-4", marked && "fill-current")} /></span>
            </button>
            <button type="button" onClick={() => share(p)} className="group flex items-center gap-1.5 transition hover:text-[#1d9bf0]">
              <span className="rounded-full p-1.5 transition group-hover:bg-[#1d9bf0]/10"><Share className="h-4 w-4" /></span>
            </button>
          </div>
        </div>
        {menuId === p.id && (
          <div className="absolute right-3 top-10 z-20 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#16181c] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {own && (
              <button type="button" onClick={() => deletePost(p)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-bold text-rose-400 transition hover:bg-white/[0.04]">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
            <button type="button" onClick={() => { navigator.clipboard.writeText(p.content).catch(() => {}); setMenuId(null); toast.success("Text copied"); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-bold text-white/70 transition hover:bg-white/[0.04]">
              <Copy className="h-4 w-4" /> Copy text
            </button>
            <button type="button" onClick={() => { setMenuId(null); toast.success("Thanks — this post has been reported."); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-bold text-white/70 transition hover:bg-white/[0.04]">
              <Flag className="h-4 w-4" /> Report
            </button>
          </div>
        )}
      </article>
    );
  };

  const FollowCard = ({ s }: { s: Suggestion }) => (
    <div className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
      <img src={avatarOf(s.avatar_url, s.user_id)} alt="" className="h-10 w-10 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[14px] font-black text-white">
          <span className="truncate">{s.display_name || s.username}</span>
          {s.is_official_account && <BadgeCheck className="h-4 w-4 shrink-0 text-[#1d9bf0]" />}
        </div>
        <div className="truncate text-[13px] text-white/35">@{s.username}</div>
        {s.bio && <div className="mt-0.5 line-clamp-1 text-[12px] text-white/50">{s.bio}</div>}
      </div>
      <button type="button" onClick={() => follow(s.user_id)} className="rounded-full bg-white px-4 py-1.5 text-[13px] font-black text-black transition hover:bg-white/85">
        Follow
      </button>
    </div>
  );

  const TrendRow = ({ t, i }: { t: Ticker; i: number }) => {
    const up = (t.change24h ?? 0) >= 0;
    return (
      <button type="button" onClick={() => onSelectMint?.(t.mint)} className="flex w-full items-start justify-between px-4 py-2.5 text-left transition hover:bg-white/[0.03]">
        <div>
          <div className="text-[11px] text-white/35">#{i + 1} · Trending on Solana</div>
          <div className="text-[14px] font-black text-white">${t.symbol}</div>
          <div className="text-[11px] text-white/35">{t.priceUsd != null ? `$${t.priceUsd < 0.01 ? t.priceUsd.toExponential(2) : t.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 6 })}` : ""}</div>
        </div>
        <span className={cn("mt-1 inline-flex items-center gap-0.5 text-[12px] font-bold", up ? "text-emerald-400" : "text-rose-400")}>
          {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {Math.abs(t.change24h ?? 0).toFixed(1)}%
        </span>
      </button>
    );
  };

  /* ═══════════ Center column content ═══════════ */
  const renderCenter = () => {
    switch (tab) {
      case "home":
        return (
          <>
            {/* Sticky header with feed mode tabs */}
            <div className="sticky top-0 z-10 border-b border-white/[0.08] bg-black/70 backdrop-blur-xl">
              <div className="flex">
                {([["foryou", "For you"], ["following", "Following"]] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setFeedMode(id)} className="relative flex-1 py-3.5 text-[15px] font-bold text-white/50 transition hover:bg-white/[0.03]">
                    <span className={cn(feedMode === id && "font-black text-white")}>{label}</span>
                    {feedMode === id && <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-[#1d9bf0]" />}
                  </button>
                ))}
              </div>
            </div>
            <Composer inline refEl={composerRef} />
            {loading ? <Spinner /> : shownPosts.length === 0 ? (
              <div className="px-8 py-16 text-center">
                <div className="text-[17px] font-black text-white">{feedMode === "following" ? "Nothing here yet" : "Welcome to OrbitX"}</div>
                <div className="mt-1 text-[13px] text-white/40">{feedMode === "following" ? "Follow people to see their posts here." : "Be the first to post something."}</div>
              </div>
            ) : (
              shownPosts.map((p) => <PostCard key={p.id} p={p} />)
            )}
          </>
        );

      case "explore":
        return (
          <>
            <div className="sticky top-0 z-10 border-b border-white/[0.08] bg-black/70 p-3 backdrop-blur-xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search OrbitX"
                  className="w-full rounded-full border border-transparent bg-white/[0.07] py-2.5 pl-11 pr-4 text-[15px] text-white placeholder:text-white/30 outline-none transition focus:border-[#1d9bf0] focus:bg-transparent"
                />
              </div>
            </div>
            {searchQ.trim() ? (
              <div>
                <div className="px-4 pt-4 text-[19px] font-black text-white">People</div>
                {searchedUsers.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[13px] text-white/35">No matching users.</div>
                ) : searchedUsers.map((s) => <FollowCard key={s.user_id} s={s} />)}
              </div>
            ) : (
              <>
                <div className="border-b border-white/[0.08] pb-2">
                  <div className="px-4 pt-4 text-[19px] font-black text-white">Trends for you</div>
                  {ticker.length === 0 ? <Spinner /> : ticker.slice(0, 10).map((t, i) => <TrendRow key={t.mint} t={t} i={i} />)}
                </div>
                {trendingTags.length > 0 && (
                  <div className="border-b border-white/[0.08] pb-2">
                    <div className="px-4 pt-4 text-[19px] font-black text-white">Trending in posts</div>
                    {trendingTags.map(([tag, count]) => (
                      <button key={tag} type="button" onClick={() => setSearchQ(tag)} className="flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-white/[0.03]">
                        <div>
                          <div className="text-[14px] font-black text-[#1d9bf0]">{tag}</div>
                          <div className="text-[11px] text-white/35">{count} post{count > 1 ? "s" : ""}</div>
                        </div>
                        <TrendingUp className="h-4 w-4 text-white/25" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="pb-4">
                  <div className="px-4 pt-4 text-[19px] font-black text-white">Who to follow</div>
                  {whoToFollow.slice(0, 6).map((s) => <FollowCard key={s.user_id} s={s} />)}
                </div>
              </>
            )}
          </>
        );

      case "notifications":
        return (
          <>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.08] bg-black/70 px-4 py-3.5 backdrop-blur-xl">
              <span className="text-[19px] font-black text-white">Notifications</span>
              {unread > 0 && (
                <button type="button" onClick={markAllRead} className="rounded-full border border-white/15 px-3 py-1 text-[12px] font-bold text-white/60 transition hover:bg-white/[0.06]">
                  Mark all read
                </button>
              )}
            </div>
            {notifsLoading ? <Spinner /> : notifs.length === 0 ? (
              <div className="px-8 py-16 text-center">
                <Bell className="mx-auto h-8 w-8 text-white/15" />
                <div className="mt-3 text-[17px] font-black text-white">Nothing yet</div>
                <div className="mt-1 text-[13px] text-white/40">Likes, follows and alerts will show up here.</div>
              </div>
            ) : (
              notifs.map((n) => (
                <div key={n.id} className={cn("flex gap-3 border-b border-white/[0.08] px-4 py-3.5", !n.is_read && "bg-[#1d9bf0]/[0.04]")}>
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06]">
                    <Bell className="h-4 w-4 text-[#1d9bf0]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-black text-white">{n.title || n.type}</div>
                    <div className="text-[13px] text-white/50">{n.message}</div>
                  </div>
                  <span className="shrink-0 text-[11px] text-white/30">{timeAgo(n.created_at)}</span>
                </div>
              ))
            )}
          </>
        );

      case "messages":
        return (
          <Suspense fallback={<Spinner />}>
            <div className="h-full min-h-0 overflow-hidden"><MessagesPage /></div>
          </Suspense>
        );

      case "chat":
        return (
          <Suspense fallback={<Spinner />}>
            <div className="h-full min-h-0 overflow-hidden"><ChatHub /></div>
          </Suspense>
        );

      case "rooms":
        return (
          <div className="flex h-full min-h-0 flex-col">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/[0.08] bg-black/70 px-4 py-3 backdrop-blur-xl">
              <span className="mr-2 text-[19px] font-black text-white">Rooms</span>
              {([["rooms", "Community Rooms"], ["trading", "Trading Lobbies"]] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setRoomsView(id)} className={cn("rounded-full px-4 py-1.5 text-[13px] font-bold transition", roomsView === id ? "bg-white text-black" : "bg-white/[0.06] text-white/50 hover:text-white")}>
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <Suspense fallback={<Spinner />}>
                {roomsView === "rooms" ? <RoomsPage /> : <TradingLobbiesPage inline />}
              </Suspense>
            </div>
          </div>
        );

      case "spaces":
        return (
          <Suspense fallback={<Spinner />}>
            <div className="h-full min-h-0 overflow-y-auto px-3 py-4"><SpacesPage /></div>
          </Suspense>
        );

      case "communities":
        return (
          <div className="flex h-full min-h-0 flex-col">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/[0.08] bg-black/70 px-4 py-3 backdrop-blur-xl">
              <span className="mr-2 text-[19px] font-black text-white">Communities</span>
              {([["token", "Token"], ["og", "OG"]] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setCommView(id)} className={cn("rounded-full px-4 py-1.5 text-[13px] font-bold transition", commView === id ? "bg-white text-black" : "bg-white/[0.06] text-white/50 hover:text-white")}>
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Suspense fallback={<Spinner />}>
                {commView === "token" ? <CoinCommunitiesPage /> : <CommunitiesPage />}
              </Suspense>
            </div>
          </div>
        );

      case "profile":
        return (
          <Suspense fallback={<Spinner />}>
            <div className="h-full min-h-0 overflow-y-auto"><ProfilePage /></div>
          </Suspense>
        );
    }
  };

  /* ═══════════ Layout ═══════════ */
  return (
    <div className="flex h-full min-h-0 w-full justify-center bg-black text-white">
      {/* ── Left nav rail ── */}
      <header className="hidden h-full shrink-0 flex-col justify-between border-r border-white/[0.08] px-2 py-3 sm:flex sm:w-[72px] xl:w-[260px] xl:px-4">
        <div className="flex flex-col gap-1">
          <div className="mb-1 flex items-center gap-2 px-3 py-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#1d9bf0] to-[#9945FF] text-[15px] font-black text-white">O</span>
            <span className="hidden text-[17px] font-black tracking-tight xl:block">OrbitX</span>
          </div>
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setTab(n.id)}
              className={cn(
                "group flex items-center gap-4 rounded-full px-3 py-2.5 transition hover:bg-white/[0.07]",
                tab === n.id ? "font-black" : "font-medium text-white/80",
              )}
            >
              <span className="relative">
                <n.Icon className={cn("h-6 w-6", tab === n.id ? "text-white" : "text-white/80")} />
                {n.id === "notifications" && unread > 0 && (
                  <span className="absolute -right-1.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#1d9bf0] px-1 text-[9px] font-black">{unread > 9 ? "9+" : unread}</span>
                )}
              </span>
              <span className="hidden text-[19px] xl:block">{n.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setComposeOpen(true); setTimeout(() => modalRef.current?.focus(), 60); }}
            className="mt-3 flex items-center justify-center rounded-full bg-[#1d9bf0] py-3 text-[16px] font-black text-white shadow-lg shadow-[#1d9bf0]/25 transition hover:bg-[#1a8cd8] xl:px-8"
          >
            <Feather className="h-5 w-5 xl:hidden" />
            <span className="hidden xl:block">Post</span>
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-full p-2 transition hover:bg-white/[0.07]">
          <img src={myAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
          <div className="hidden min-w-0 flex-1 xl:block">
            <div className="truncate text-[14px] font-black">{displayName}</div>
            <div className="truncate text-[12px] text-white/35">@{handle}</div>
          </div>
          <button type="button" title="Log out" onClick={() => signOut?.()} className="hidden rounded-full p-1.5 text-white/35 transition hover:text-rose-400 xl:block">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Center column ── */}
      <main className={cn(
        "flex h-full min-h-0 min-w-0 flex-col border-r border-white/[0.08]",
        isNarrow ? "w-full max-w-[600px]" : "w-full max-w-[900px]",
      )}>
        <div className="min-h-0 flex-1 overflow-y-auto pb-20 sm:pb-0">{renderCenter()}</div>
      </main>

      {/* ── Right rail ── */}
      {isNarrow && (
        <aside className="hidden h-full w-[350px] shrink-0 flex-col gap-4 overflow-y-auto px-6 py-3 lg:flex">
          {tab !== "explore" && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); if (e.target.value.trim()) setTab("explore"); }}
                placeholder="Search"
                className="w-full rounded-full border border-transparent bg-white/[0.07] py-2.5 pl-11 pr-4 text-[15px] text-white placeholder:text-white/30 outline-none transition focus:border-[#1d9bf0]"
              />
            </div>
          )}

          <div className="overflow-hidden rounded-2xl bg-white/[0.04]">
            <div className="px-4 py-3 text-[19px] font-black">What's happening</div>
            {ticker.slice(0, 5).map((t, i) => <TrendRow key={t.mint} t={t} i={i} />)}
            <button type="button" onClick={() => setTab("explore")} className="w-full px-4 py-3 text-left text-[14px] font-bold text-[#1d9bf0] transition hover:bg-white/[0.03]">
              Show more
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white/[0.04]">
            <div className="px-4 py-3 text-[19px] font-black">Who to follow</div>
            {whoToFollow.slice(0, 3).map((s) => <FollowCard key={s.user_id} s={s} />)}
            <button type="button" onClick={() => setTab("explore")} className="w-full px-4 py-3 text-left text-[14px] font-bold text-[#1d9bf0] transition hover:bg-white/[0.03]">
              Show more
            </button>
          </div>

          <div className="px-2 text-[11px] leading-relaxed text-white/25">
            OrbitX Social · Beta · Built for the trenches
          </div>
        </aside>
      )}

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-white/[0.08] bg-black/85 px-1 py-1.5 backdrop-blur-xl sm:hidden">
        {NAV.slice(0, 4).map((n) => (
          <button key={n.id} type="button" onClick={() => setTab(n.id)} className={cn("relative rounded-full p-2.5", tab === n.id ? "text-white" : "text-white/40")}>
            <n.Icon className="h-6 w-6" />
            {n.id === "notifications" && unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#1d9bf0]" />}
          </button>
        ))}
        {NAV.slice(4).map((n) => (
          <button key={n.id} type="button" onClick={() => setTab(n.id)} className={cn("rounded-full p-2.5", tab === n.id ? "text-white" : "text-white/40")}>
            <n.Icon className="h-6 w-6" />
          </button>
        ))}
      </nav>

      {/* ── Mobile compose FAB ── */}
      {tab === "home" && (
        <button
          type="button"
          onClick={() => { setComposeOpen(true); setTimeout(() => modalRef.current?.focus(), 60); }}
          className="fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-[#1d9bf0] text-white shadow-2xl shadow-[#1d9bf0]/40 transition hover:bg-[#1a8cd8] sm:hidden"
        >
          <Feather className="h-6 w-6" />
        </button>
      )}

      {/* ── Compose modal ── */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#5b7083]/40 p-4 pt-[8vh]" onClick={() => setComposeOpen(false)}>
          <div className="w-full max-w-[600px] rounded-2xl bg-black shadow-2xl ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3">
              <button type="button" onClick={() => setComposeOpen(false)} className="rounded-full p-2 text-white/60 transition hover:bg-white/[0.07] hover:text-white">
                <XIcon className="h-5 w-5" />
              </button>
              <span className="text-[13px] font-bold text-[#1d9bf0]">Drafts save automatically</span>
            </div>
            <div className="px-4 pb-4">
              <Composer refEl={modalRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
