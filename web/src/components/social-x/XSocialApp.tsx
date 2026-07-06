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
  ArrowDownRight, Users, Bookmark, LogOut, LayoutGrid, Settings, Coins,
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
interface CommunityLite { id: string; name: string; description: string | null; member_count: number | null; avatar_url?: string | null; icon?: string | null; category?: string | null; }

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

/* Pull image URLs out of post text so they render as real media, X-style. */
const IMG_URL_RE = /https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s]*)?/gi;
function splitMedia(content: string): { text: string; imgs: string[] } {
  const imgs = content.match(IMG_URL_RE) || [];
  let text = content;
  for (const u of imgs) text = text.replace(u, "").trim();
  return { text, imgs: imgs.slice(0, 4) };
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

/* Mobile pill: 5 core tabs; the rest live in the More sheet (each tab appears exactly once).
   Notifications moved to the top-right bell — Communities takes its pill slot. */
const CORE_TABS: XTab[] = ["home", "explore", "communities", "messages", "profile"];
const MORE_TABS: XTab[] = ["chat", "rooms", "spaces"];

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
  const [searchScope, setSearchScope] = useState<"all" | "people" | "coins" | "communities">("all");
  const [foundProfiles, setFoundProfiles] = useState<Suggestion[]>([]);
  const [foundComms, setFoundComms] = useState<CommunityLite[]>([]);
  const [foundDexCoins, setFoundDexCoins] = useState<Ticker[]>([]);
  const [searching, setSearching] = useState(false);
  const [commView, setCommView] = useState<"token" | "og">("token");
  const [roomsView, setRoomsView] = useState<"rooms" | "trading">("rooms");
  const [moreOpen, setMoreOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<"all" | "mentions" | "likes" | "follows">("all");
  const [newPosts, setNewPosts] = useState(0);
  const feedScrollRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef(tab); tabRef.current = tab;
  const uidRef = useRef(user?.id); uidRef.current = user?.id;

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
  const exploreSearchRef = useRef<HTMLInputElement>(null);

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
        (p) => { const row = p.new as Post; setPosts((prev) => prev.some((x) => x.id === row.id) ? prev : [row, ...prev]); if (tabRef.current === "home" && row.user_id !== uidRef.current && (feedScrollRef.current?.scrollTop ?? 0) > 300) setNewPosts((n) => n + 1); })
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

  /* ── Notifications (loaded eagerly so the top-right bell badge is live) ── */
  useEffect(() => {
    if (!user) return;
    setNotifsLoading(true);
    supabase.from("notifications").select("id,type,title,message,is_read,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { setNotifs((data as NotifRow[]) || []); setNotifsLoading(false); });
  }, [user, tab === "notifications"]);

  /* ── Universal search: people + communities (server), coins (trending ticker) ── */
  useEffect(() => {
    const q = searchQ.trim().replace(/[%,()]/g, "");
    if (q.length < 2) { setFoundProfiles([]); setFoundComms([]); setFoundDexCoins([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const like = `%${q}%`;
      // Real coin search across all of Solana (symbol or contract address), not
      // just the trending ticker. Highest-liquidity Solana pair per token.
      const coinsP = fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => {
          const seen = new Set<string>();
          return (((d && d.pairs) || []) as any[])
            .filter((p) => p.chainId === "solana" && p.baseToken?.address)
            .sort((a, b) => Number(b.liquidity?.usd ?? 0) - Number(a.liquidity?.usd ?? 0))
            .filter((p) => (seen.has(p.baseToken.address) ? false : (seen.add(p.baseToken.address), true)))
            .slice(0, 8)
            .map((p) => ({
              mint: p.baseToken.address as string,
              symbol: (p.baseToken.symbol as string) ?? null,
              priceUsd: p.priceUsd != null ? Number(p.priceUsd) : null,
              change24h: p.priceChange?.h24 != null ? Number(p.priceChange.h24) : null,
            } as Ticker));
        })
        .catch(() => [] as Ticker[]);
      const [pRes, cRes, coins] = await Promise.all([
        supabase.from("profiles")
          .select("user_id,username,display_name,avatar_url,is_official_account,bio")
          .or(`username.ilike.${like},display_name.ilike.${like}`)
          .not("username", "is", null).limit(12),
        supabase.from("communities")
          .select("id,name,description,member_count,avatar_url,icon,category")
          .or(`name.ilike.${like},description.ilike.${like}`)
          .limit(10),
        coinsP,
      ]);
      setFoundProfiles((pRes.data as Suggestion[]) || []);
      setFoundComms((cRes.data as CommunityLite[]) || []);
      setFoundDexCoins(coins);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

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

  const officialIds = useMemo(() => new Set(suggestions.filter((x) => x.is_official_account).map((x) => x.user_id)), [suggestions]);

  const whoToFollow = suggestions.filter((s) => s.user_id !== user?.id && !followingSet.has(s.user_id));

  const marketPulse = useMemo(() => {
    const withChg = ticker.filter((t) => t.change24h != null);
    const gainers = withChg.filter((t) => (t.change24h ?? 0) > 0).length;
    const losers = withChg.filter((t) => (t.change24h ?? 0) < 0).length;
    const avg = withChg.length ? withChg.reduce((sum, t) => sum + (t.change24h ?? 0), 0) / withChg.length : 0;
    const sol = ticker.find((t) => (t.symbol || "").toUpperCase() === "SOL") || null;
    const topMovers = [...withChg].sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0)).slice(0, 10);
    return { gainers, losers, avg, sol, topMovers };
  }, [ticker]);

  const shownNotifs = useMemo(() => {
    if (notifFilter === "all") return notifs;
    return notifs.filter((n) => {
      const ty = (n.type || "").toLowerCase();
      if (notifFilter === "likes") return ty.includes("like");
      if (notifFilter === "follows") return ty.includes("follow");
      return ty.includes("repl") || ty.includes("mention") || ty.includes("comment");
    });
  }, [notifs, notifFilter]);

  const searchedUsers = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    const local = suggestions.filter((s) => (s.username || "").toLowerCase().includes(q) || (s.display_name || "").toLowerCase().includes(q));
    const seen = new Set<string>();
    return [...foundProfiles, ...local].filter((s) => (seen.has(s.user_id) ? false : (seen.add(s.user_id), true))).slice(0, 10);
  }, [searchQ, suggestions, foundProfiles]);

  const foundCoins = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    const local = ticker.filter((t) => (t.symbol || "").toLowerCase().includes(q) || t.mint.toLowerCase() === q);
    const seen = new Set<string>();
    return [...local, ...foundDexCoins].filter((t) => (seen.has(t.mint) ? false : (seen.add(t.mint), true))).slice(0, 10);
  }, [searchQ, ticker, foundDexCoins]);

  const isNarrow = NARROW_TABS.includes(tab);
  const PILL_INDEX = CORE_TABS.indexOf(tab) >= 0 ? CORE_TABS.indexOf(tab) : MORE_TABS.includes(tab) ? CORE_TABS.length : -1; // More slot; -1 = none (notifications lives top-right)
  const unread = notifs.filter((n) => !n.is_read).length;

  /* ═══════════ Sub-renderers ═══════════ */

  const Composer = ({ inline, refEl }: { inline?: boolean; refEl: React.RefObject<HTMLTextAreaElement> }) => (
    <div className={cn("flex gap-3", inline && "border-b border-white/[0.08] px-4 py-3")}>
      <img src={myAvatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/10" />
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
        <div className="mt-1 flex flex-wrap gap-1.5">
          {["$SOL", "$BONK", "#trenches", "gm ☀️", "🔥"].map((q) => (
            <button key={q} type="button" onClick={() => setText((t) => (t + (t && !t.endsWith(" ") ? " " : "") + q + " ").slice(0, MAX_LEN))} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-[#1d9bf0]/90 transition hover:border-[#1d9bf0]/40 hover:bg-[#1d9bf0]/10 active:scale-95">
            {q}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2">
          <span className="flex items-center gap-2">
            {text.length > 0 && (
              <svg width="18" height="18" viewBox="0 0 20 20" className="-rotate-90">
                <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="2.5" />
                <circle cx="10" cy="10" r="8" fill="none" stroke={text.length > MAX_LEN - 40 ? "#fb923c" : "#1d9bf0"} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${(text.length / MAX_LEN) * 50.3} 50.3`} />
              </svg>
            )}
            <span className={cn("text-[11px] font-bold", text.length > MAX_LEN - 40 ? "text-orange-400" : "text-white/25")}>{text.length}/{MAX_LEN}</span>
          </span>
          <button
            type="button"
            disabled={!text.trim() || posting}
            onClick={() => submit()}
            className={cn(
              "rounded-full px-5 py-1.5 text-[14px] font-black transition-all duration-200 active:scale-95",
              text.trim() && !posting
                ? "bg-gradient-to-r from-[#1d9bf0] to-[#4a9ff5] text-white shadow-[0_4px_16px_rgba(29,155,240,0.4)] hover:shadow-[0_4px_24px_rgba(29,155,240,0.6)]"
                : "bg-[#1d9bf0]/40 text-white/50",
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
      <article className="x-fade-in group/post relative flex gap-3 border-b border-white/[0.06] px-4 py-3.5 transition-colors duration-200 hover:bg-white/[0.025]">
        <img src={avatarOf(p.avatar_url, p.user_id)} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/10 transition group-hover/post:ring-[#1d9bf0]/40" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[14px]">
            <span className="truncate font-black text-white hover:underline">{p.username || "Anon"}</span>
            {officialIds.has(p.user_id) && <BadgeCheck className="h-4 w-4 shrink-0 text-[#1d9bf0]" />}
            <span className="truncate text-white/35">@{(p.username || "anon").toLowerCase().replace(/\s+/g, "")}</span>
            <span className="text-white/30">·</span>
            <span className="shrink-0 text-white/35 hover:underline">{timeAgo(p.created_at)}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id); }} className="ml-auto rounded-full p-1.5 text-white/30 transition hover:bg-[#1d9bf0]/10 hover:text-[#1d9bf0]">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
          {(() => { const { text: body, imgs } = splitMedia(p.content); return (
            <>
              {body && <div className="whitespace-pre-wrap break-words text-[15px] leading-snug text-white/90">{renderContent(body, onSelectMint)}</div>}
              {imgs.length > 0 && (
                <div className={cn("mt-2 grid gap-1.5 overflow-hidden rounded-2xl", imgs.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                  {imgs.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer" className="block overflow-hidden">
                      <img src={u} alt="" loading="lazy" className={cn("w-full object-cover ring-1 ring-white/[0.08] transition duration-300 hover:scale-[1.02]", imgs.length > 1 ? "h-40" : "max-h-[380px]")} />
                    </a>
                  ))}
                </div>
              )}
            </>
          ); })()}
          <div className="mt-2 flex max-w-md items-center justify-between text-white/35">
            <button type="button" onClick={() => replyTo(p)} className="group flex items-center gap-1.5 transition active:scale-90 hover:text-[#1d9bf0]">
              <span className="rounded-full p-1.5 transition group-hover:bg-[#1d9bf0]/10"><MessageCircle className="h-4 w-4" /></span>
            </button>
            <button type="button" onClick={() => repost(p)} className="group flex items-center gap-1.5 transition active:scale-90 hover:text-emerald-400">
              <span className="rounded-full p-1.5 transition group-hover:bg-emerald-400/10"><Repeat2 className="h-4 w-4" /></span>
            </button>
            <button type="button" onClick={() => toggleLike(p)} className={cn("group flex items-center gap-1.5 transition active:scale-90 hover:text-pink-500", liked && "text-pink-500")}>
              <span className="rounded-full p-1.5 transition group-hover:bg-pink-500/10"><Heart className={cn("h-4 w-4", liked && "x-like-pop fill-current")} /></span>
              {(p.likes_count ?? 0) > 0 && <span className="text-[12px] font-bold">{p.likes_count}</span>}
            </button>
            <button type="button" onClick={() => toggleBookmark(p)} className={cn("group flex items-center gap-1.5 transition active:scale-90 hover:text-[#1d9bf0]", marked && "text-[#1d9bf0]")}>
              <span className="rounded-full p-1.5 transition group-hover:bg-[#1d9bf0]/10"><Bookmark className={cn("h-4 w-4", marked && "fill-current")} /></span>
            </button>
            <button type="button" onClick={() => share(p)} className="group flex items-center gap-1.5 transition active:scale-90 hover:text-[#1d9bf0]">
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
    <div className="flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-white/[0.04]">
      <img src={avatarOf(s.avatar_url, s.user_id)} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[14px] font-black text-white">
          <span className="truncate">{s.display_name || s.username}</span>
          {s.is_official_account && <BadgeCheck className="h-4 w-4 shrink-0 text-[#1d9bf0]" />}
        </div>
        <div className="truncate text-[13px] text-white/35">@{s.username}</div>
        {s.bio && <div className="mt-0.5 line-clamp-1 text-[12px] text-white/50">{s.bio}</div>}
      </div>
      <button type="button" onClick={() => follow(s.user_id)} className="rounded-full bg-white px-4 py-1.5 text-[13px] font-black text-black shadow-[0_2px_12px_rgba(255,255,255,0.15)] transition-all duration-200 hover:shadow-[0_2px_20px_rgba(255,255,255,0.3)] active:scale-95">
        Follow
      </button>
    </div>
  );

  const TrendRow = ({ t, i }: { t: Ticker; i: number }) => {
    const up = (t.change24h ?? 0) >= 0;
    return (
      <button type="button" onClick={() => onSelectMint?.(t.mint)} className="group/trend flex w-full items-start justify-between px-4 py-2.5 text-left transition-all duration-200 hover:bg-white/[0.04] hover:pl-5">
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

  const CommunityRow = ({ c }: { c: CommunityLite }) => (
    <button
      type="button"
      onClick={() => { setCommView("og"); setTab("communities"); }}
      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-white/[0.04]"
    >
      {c.avatar_url ? (
        <img src={c.avatar_url} alt="" className="h-11 w-11 shrink-0 rounded-2xl object-cover ring-1 ring-white/[0.1]" />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#1d9bf0]/25 to-[#9945FF]/20 text-[18px] ring-1 ring-white/[0.1]">
          {c.icon || (c.name || "?").slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-black text-white">{c.name}</span>
          {c.category && <span className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-bold text-white/45 ring-1 ring-white/[0.06]">{c.category}</span>}
        </div>
        <div className="truncate text-[12px] text-white/40">
          {(c.member_count ?? 0).toLocaleString()} member{(c.member_count ?? 0) === 1 ? "" : "s"}{c.description ? ` · ${c.description}` : ""}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-white px-4 py-1.5 text-[12px] font-black text-black opacity-90 transition group-hover:opacity-100">View</span>
    </button>
  );

  /* ═══════════ Center column content ═══════════ */
  const renderCenter = () => {
    switch (tab) {
      case "home":
        return (
          <>
            {/* ── Command deck hero ── */}
            <div className="x-rise relative overflow-hidden border-b border-white/[0.06]">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#1d9bf0]/[0.10] via-transparent to-[#9945FF]/[0.12]" />
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#9945FF]/20 blur-[80px]" />
              <div className="relative px-4 pb-4 pt-4">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img src={myAvatar} alt="" className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white/15" />
                    <span className="absolute -bottom-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-black text-[11px] ring-1 ring-white/20">👋</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">
                      {(() => { const hr = new Date().getHours(); return hr < 5 ? "Late night" : hr < 12 ? "gm ☀️" : hr < 17 ? "Good afternoon" : hr < 21 ? "Good evening" : "Night owl 🌙"; })()}
                    </div>
                    <div className="flex items-center gap-1.5 text-[21px] font-black leading-tight text-white">
                      <span className="truncate">{displayName}</span>
                      {profile?.is_official_account && <BadgeCheck className="h-5 w-5 shrink-0 text-[#1d9bf0]" />}
                    </div>
                  </div>
                  <button type="button" onClick={() => setTab("notifications")} className="relative ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] active:scale-95">
                    <Bell className="h-5 w-5" />
                    {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#1d9bf0] px-1 text-[9px] font-black">{unread > 9 ? "9+" : unread}</span>}
                  </button>
                </div>

                {/* live market pulse */}
                <div className="mt-3.5 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/40 p-3 backdrop-blur-xl">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#9945FF]/30 to-[#1d9bf0]/25 ring-1 ring-white/10">
                    <TrendingUp className="h-4 w-4 text-[#1d9bf0]" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[9.5px] font-bold uppercase tracking-widest text-white/40">Market pulse</div>
                    <div className="text-[15px] font-black text-white">
                      {marketPulse.avg >= 0 ? "Risk-on" : "Cooling off"}{" "}
                      <span className={marketPulse.avg >= 0 ? "text-emerald-400" : "text-rose-400"}>{marketPulse.avg >= 0 ? "+" : ""}{marketPulse.avg.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-2.5 text-[12px] font-black">
                    <span className="text-emerald-400">▲{marketPulse.gainers}</span>
                    <span className="text-rose-400">▼{marketPulse.losers}</span>
                    {marketPulse.sol?.priceUsd != null && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-white/85">SOL ${marketPulse.sol.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}
                  </div>
                </div>

                {/* quick actions */}
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[
                    { Icon: Feather, label: "Post", on: () => { setTab("home"); setTimeout(() => composerRef.current?.focus(), 60); } },
                    { Icon: Search, label: "Explore", on: () => setTab("explore") },
                    { Icon: Globe, label: "Communities", on: () => setTab("communities") },
                    { Icon: Mail, label: "Messages", on: () => setTab("messages") },
                  ].map((a) => (
                    <button key={a.label} type="button" onClick={a.on} className="group flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] py-2.5 transition hover:border-[#1d9bf0]/40 hover:bg-[#1d9bf0]/[0.07] active:scale-95">
                      <a.Icon className="h-5 w-5 text-white/70 transition group-hover:text-[#1d9bf0]" />
                      <span className="text-[10.5px] font-bold text-white/60 group-hover:text-white">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Top movers rail ── */}
            {marketPulse.topMovers.length > 0 && (
              <div className="x-rise border-b border-white/[0.06] px-4 py-3" style={{ animationDelay: "70ms" }}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[13px] font-black text-white">🔥 Top movers</span>
                  <button type="button" onClick={() => setTab("explore")} className="text-[11.5px] font-bold text-[#1d9bf0] hover:underline">See all</button>
                </div>
                <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {marketPulse.topMovers.map((t) => {
                    const up = (t.change24h ?? 0) >= 0;
                    return (
                      <button key={t.mint} type="button" onClick={() => onSelectMint?.(t.mint)} className="x-tilt w-32 shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-3 text-left">
                        <div className="text-[13px] font-black text-white">${t.symbol}</div>
                        <div className="mt-0.5 truncate text-[11px] text-white/40">{t.priceUsd != null ? "$" + (t.priceUsd < 0.01 ? t.priceUsd.toExponential(1) : t.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })) : "—"}</div>
                        <div className={cn("mt-2 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-black", up ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400")}>{up ? "▲" : "▼"} {Math.abs(t.change24h ?? 0).toFixed(1)}%</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Suggested to follow ── */}
            {whoToFollow.length > 0 && (
              <div className="x-rise border-b border-white/[0.06] px-4 py-3" style={{ animationDelay: "140ms" }}>
                <div className="mb-2 text-[13px] font-black text-white">Suggested for you</div>
                <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {whoToFollow.slice(0, 12).map((sg) => (
                    <div key={sg.user_id} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                      <div className="rounded-full bg-gradient-to-tr from-[#1d9bf0] via-[#9945FF] to-[#f91880] p-[2px]">
                        <img src={avatarOf(sg.avatar_url, sg.user_id)} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-black" />
                      </div>
                      <span className="w-16 truncate text-center text-[10px] font-semibold text-white/70">{sg.username || "anon"}</span>
                      <button type="button" onClick={() => follow(sg.user_id)} className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-black text-black transition hover:bg-white/90 active:scale-95">Follow</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sticky header with feed mode tabs + live dot */}
            <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-black/55 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl">
              <div className="flex">
                {([["foryou", "For you"], ["following", "Following"]] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setFeedMode(id)} className="relative flex-1 py-3.5 text-[15px] font-bold text-white/50 transition hover:bg-white/[0.03]">
                    <span className={cn("inline-flex items-center gap-1.5", feedMode === id && "font-black text-white")}>
                      {id === "foryou" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" style={{ animation: "xGlowPulse 2s ease infinite" }} />}
                      {label}
                    </span>
                    {feedMode === id && <span className="absolute bottom-0 left-1/2 h-[3px] w-14 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#1d9bf0] to-[#9945FF] shadow-[0_0_10px_rgba(29,155,240,0.6)]" />}
                  </button>
                ))}
              </div>
              {/* live market marquee */}
              {ticker.length > 3 && (
                <div className="x-marquee border-t border-white/[0.05]">
                  <div className="x-marquee-track">
                    {[...ticker, ...ticker].map((t, i) => {
                      const up = (t.change24h ?? 0) >= 0;
                      return (
                        <button key={`${t.mint}-${i}`} type="button" onClick={() => onSelectMint?.(t.mint)} className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-bold transition hover:bg-white/[0.04]">
                          <span className="text-white/85">${t.symbol}</span>
                          <span className={up ? "text-emerald-400" : "text-rose-400"}>{up ? "▲" : "▼"}{Math.abs(t.change24h ?? 0).toFixed(1)}%</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <Composer inline refEl={composerRef} />
            {loading ? (
              <div>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex animate-pulse gap-3 border-b border-white/[0.06] px-4 py-4" style={{ animationDelay: `${i * 150}ms` }}>
                    <div className="h-10 w-10 shrink-0 rounded-full bg-white/[0.07]" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 w-36 rounded-full bg-white/[0.07]" />
                      <div className="h-3 w-full rounded-full bg-white/[0.05]" />
                      <div className="h-3 w-2/3 rounded-full bg-white/[0.05]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : shownPosts.length === 0 ? (
              <div className="px-8 py-14 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#1d9bf0]/15 to-[#9945FF]/10 ring-1 ring-white/[0.08]">
                  <TrendingUp className="h-6 w-6 text-[#1d9bf0]/70" />
                </div>
                <div className="text-[17px] font-black text-white">{feedMode === "following" ? "Nothing here yet" : "Welcome to OrbitX"}</div>
                <div className="mt-1 text-[13px] text-white/40">{feedMode === "following" ? "Follow people to see their posts here." : "Break the silence — one tap:"}</div>
                {feedMode === "foryou" && (
                  <div className="mx-auto mt-4 flex max-w-xs flex-col gap-2">
                    {["gm to the trenches ☀️", "What is everyone aping today? 👀", "First post on OrbitX 🚀"].map((q) => (
                      <button key={q} type="button" onClick={() => submit(q)} className="rounded-full border border-[#1d9bf0]/30 bg-[#1d9bf0]/[0.07] px-4 py-2 text-[13px] font-bold text-[#1d9bf0] transition hover:bg-[#1d9bf0]/[0.15] active:scale-95">
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              shownPosts.map((p, i) => (
                <React.Fragment key={p.id}>
                  <PostCard p={p} />
                  {i === 2 && feedMode === "foryou" && ticker.length >= 3 && (
                    <div className="border-b border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent px-4 py-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[13px] font-black text-white">🔥 Moving right now</span>
                        <button type="button" onClick={() => setTab("explore")} className="text-[11.5px] font-bold text-[#1d9bf0] hover:underline">See all</button>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {ticker.slice(0, 6).map((t) => {
                          const up = (t.change24h ?? 0) >= 0;
                          return (
                            <button key={t.mint} type="button" onClick={() => onSelectMint?.(t.mint)} className="flex shrink-0 flex-col items-start gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 transition hover:border-[#1d9bf0]/40 hover:bg-[#1d9bf0]/[0.06] active:scale-95">
                              <span className="text-[12.5px] font-black text-white">${t.symbol}</span>
                              <span className={cn("text-[11px] font-bold", up ? "text-emerald-400" : "text-rose-400")}>{up ? "+" : ""}{(t.change24h ?? 0).toFixed(1)}%</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))
            )}
          </>
        );

      case "explore": {
        const scopeChips: { id: "all" | "people" | "coins" | "communities"; label: string }[] = [
          { id: "all", label: "All" },
          { id: "people", label: "People" },
          { id: "coins", label: "Coins" },
          { id: "communities", label: "Communities" },
        ];
        const showPeople = searchScope === "all" || searchScope === "people";
        const showCoins = searchScope === "all" || searchScope === "coins";
        const showComms = searchScope === "all" || searchScope === "communities";
        return (
          <>
            <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-black/55 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl">
              <div className="p-3 pb-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    ref={exploreSearchRef}
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Search people, coins & communities"
                    className="w-full rounded-full border border-white/[0.06] bg-white/[0.06] py-2.5 pl-11 pr-10 text-[15px] text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-[#1d9bf0]/70 focus:bg-black focus:shadow-[0_0_0_3px_rgba(29,155,240,0.15)]"
                  />
                  {searchQ && (
                    <button type="button" onClick={() => setSearchQ("")} className="absolute right-3 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-white/[0.1] text-white/50 transition hover:bg-white/[0.2] hover:text-white" aria-label="Clear search">
                      <XIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              {searchQ.trim() && (
                <div className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none]">
                  {scopeChips.map((c) => (
                    <button key={c.id} type="button" onClick={() => setSearchScope(c.id)} className={cn("shrink-0 rounded-full px-4 py-1.5 text-[12.5px] font-bold transition-all duration-200 active:scale-95", searchScope === c.id ? "bg-white text-black shadow-[0_2px_12px_rgba(255,255,255,0.2)]" : "bg-white/[0.06] text-white/50 ring-1 ring-white/[0.06] hover:bg-white/[0.1] hover:text-white")}>
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {searchQ.trim() ? (
              <div className="pb-8">
                {searching && (
                  <div className="h-0.5 w-full overflow-hidden bg-white/[0.04]">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-[#1d9bf0] to-[#9945FF]" />
                  </div>
                )}
                {showPeople && (
                  <section className="border-b border-white/[0.06] pb-2">
                    <div className="flex items-center gap-2 px-4 pb-1 pt-5">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#1d9bf0]/20 to-[#9945FF]/15 ring-1 ring-white/[0.08]"><Users className="h-3.5 w-3.5 text-[#1d9bf0]" /></span>
                      <span className="text-[17px] font-black text-white">People</span>
                      <span className="text-[12px] font-bold text-white/30">{searchedUsers.length}</span>
                    </div>
                    {searchedUsers.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[13px] text-white/35">No matching users.</div>
                    ) : searchedUsers.map((s) => <FollowCard key={s.user_id} s={s} />)}
                  </section>
                )}
                {showCoins && (
                  <section className="border-b border-white/[0.06] pb-2">
                    <div className="flex items-center gap-2 px-4 pb-1 pt-5">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#1d9bf0]/20 to-[#9945FF]/15 ring-1 ring-white/[0.08]"><Coins className="h-3.5 w-3.5 text-[#1d9bf0]" /></span>
                      <span className="text-[17px] font-black text-white">Coins</span>
                      <span className="text-[12px] font-bold text-white/30">{foundCoins.length}</span>
                    </div>
                    {foundCoins.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[13px] text-white/35">No coins found. Try a symbol or paste a contract address.</div>
                    ) : foundCoins.map((t, i) => <TrendRow key={t.mint} t={t} i={i} />)}
                  </section>
                )}
                {showComms && (
                  <section className="pb-2">
                    <div className="flex items-center gap-2 px-4 pb-1 pt-5">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#1d9bf0]/20 to-[#9945FF]/15 ring-1 ring-white/[0.08]"><Globe className="h-3.5 w-3.5 text-[#1d9bf0]" /></span>
                      <span className="text-[17px] font-black text-white">Communities</span>
                      <span className="text-[12px] font-bold text-white/30">{foundComms.length}</span>
                    </div>
                    {foundComms.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[13px] text-white/35">No matching communities.</div>
                    ) : foundComms.map((c) => <CommunityRow key={c.id} c={c} />)}
                  </section>
                )}
              </div>
            ) : (
              <div className="pb-10">
                {/* Discover hero */}
                <div className="x-rise relative overflow-hidden border-b border-white/[0.06] px-4 pb-4 pt-4">
                  <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-[#1d9bf0]/20 blur-[70px]" />
                  <div className="pointer-events-none absolute -left-16 top-6 h-40 w-40 rounded-full bg-[#9945FF]/15 blur-[80px]" />
                  <div className="relative">
                    <div className="text-[24px] font-black tracking-tight text-white">Discover</div>
                    <div className="mt-0.5 text-[13px] text-white/45">Find people, coins and communities across OrbitX.</div>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {([
                        { Icon: Users, label: "People", scope: "people" as const },
                        { Icon: Coins, label: "Coins", scope: "coins" as const },
                        { Icon: Globe, label: "Communities", scope: "communities" as const },
                        { Icon: TrendingUp, label: "Trending", scope: "all" as const },
                      ]).map((c) => (
                        <button key={c.label} type="button" onClick={() => { setSearchScope(c.scope); exploreSearchRef.current?.focus(); }} className="x-tilt group flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] py-3">
                          <c.Icon className="h-5 w-5 text-white/70 transition group-hover:text-[#1d9bf0]" />
                          <span className="text-[10.5px] font-bold text-white/60 group-hover:text-white">{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick searches */}
                <div className="x-rise border-b border-white/[0.06] px-4 py-3" style={{ animationDelay: "60ms" }}>
                  <div className="mb-2 text-[13px] font-black text-white">Quick searches</div>
                  <div className="flex flex-wrap gap-2">
                    {[...trendingTags.slice(0, 6).map(([t]) => t), "$SOL", "$BONK", "$WIF"].filter((v, i, a) => a.indexOf(v) === i).slice(0, 8).map((tag) => (
                      <button key={tag} type="button" onClick={() => setSearchQ(tag)} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12.5px] font-bold text-[#1d9bf0]/90 transition hover:border-[#1d9bf0]/40 hover:bg-[#1d9bf0]/10 active:scale-95">{tag}</button>
                    ))}
                  </div>
                </div>

                {/* Trending grid */}
                <div className="x-rise border-b border-white/[0.06] px-4 py-3" style={{ animationDelay: "120ms" }}>
                  <div className="mb-2 flex items-center gap-1.5 text-[15px] font-black text-white">🔥 Trending on Solana</div>
                  {ticker.length === 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="x-shim h-[58px] rounded-2xl" />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {ticker.slice(0, 8).map((t) => {
                        const up = (t.change24h ?? 0) >= 0;
                        return (
                          <button key={t.mint} type="button" onClick={() => onSelectMint?.(t.mint)} className="x-tilt flex items-center justify-between rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-white/[0.02] px-3 py-2.5 text-left">
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-black text-white">${t.symbol}</div>
                              <div className="truncate text-[10.5px] text-white/40">{t.priceUsd != null ? "$" + (t.priceUsd < 0.01 ? t.priceUsd.toExponential(1) : t.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })) : "—"}</div>
                            </div>
                            <span className={cn("shrink-0 text-[12px] font-black", up ? "text-emerald-400" : "text-rose-400")}>{up ? "▲" : "▼"}{Math.abs(t.change24h ?? 0).toFixed(1)}%</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {trendingTags.length > 0 && (
                  <div className="x-rise border-b border-white/[0.06] pb-2" style={{ animationDelay: "180ms" }}>
                    <div className="px-4 pt-4 text-[15px] font-black text-white">Trending in posts</div>
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

                <div className="x-rise pb-2" style={{ animationDelay: "240ms" }}>
                  <div className="px-4 pt-4 text-[15px] font-black text-white">Who to follow</div>
                  {whoToFollow.slice(0, 6).map((s) => <FollowCard key={s.user_id} s={s} />)}
                </div>
              </div>
            )}
          </>
        );
      }

      case "notifications":
        return (
          <>
            <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-black/55 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl">
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="flex items-center gap-2 text-[19px] font-black text-white">
                  Notifications
                  {unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#1d9bf0] px-1.5 text-[11px] font-black text-white">{unread > 99 ? "99+" : unread}</span>}
                </span>
                {unread > 0 && (
                  <button type="button" onClick={markAllRead} className="rounded-full border border-white/15 px-3 py-1 text-[12px] font-bold text-white/60 transition hover:bg-white/[0.06]">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none]">
                {(([["all", "All"], ["mentions", "Mentions"], ["likes", "Likes"], ["follows", "Follows"]]) as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setNotifFilter(id)} className={cn("shrink-0 rounded-full px-4 py-1.5 text-[12.5px] font-bold transition-all duration-200 active:scale-95", notifFilter === id ? "bg-white text-black shadow-[0_2px_12px_rgba(255,255,255,0.2)]" : "bg-white/[0.06] text-white/50 ring-1 ring-white/[0.06] hover:bg-white/[0.1] hover:text-white")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {notifsLoading ? <Spinner /> : shownNotifs.length === 0 ? (
              <div className="px-8 py-16 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#1d9bf0]/15 to-[#9945FF]/10 ring-1 ring-white/[0.08]">
                  <Bell className="h-6 w-6 text-[#1d9bf0]/70" />
                </div>
                <div className="mt-3 text-[17px] font-black text-white">{notifFilter === "all" ? "Nothing yet" : "You\u2019re all caught up"}</div>
                <div className="mt-1 text-[13px] text-white/40">{notifFilter === "all" ? "Likes, follows and alerts will show up here." : `No ${notifFilter} notifications.`}</div>
              </div>
            ) : (
              shownNotifs.map((n) => (
                <div key={n.id} className={cn("x-fade-in flex gap-3 border-b border-white/[0.06] px-4 py-3.5 transition-colors hover:bg-white/[0.02]", !n.is_read && "bg-[#1d9bf0]/[0.05] shadow-[inset_2px_0_0_#1d9bf0]")}>
                  {(() => {
                    const ty = (n.type || "").toLowerCase();
                    const [Ic, tone, ring] = ty.includes("like") ? [Heart, "text-pink-500", "from-pink-500/20 to-rose-500/10 ring-pink-500/25"] as const
                      : ty.includes("follow") ? [User, "text-emerald-400", "from-emerald-400/20 to-teal-500/10 ring-emerald-400/25"] as const
                      : ty.includes("repl") || ty.includes("mention") || ty.includes("comment") ? [MessageCircle, "text-[#1d9bf0]", "from-[#1d9bf0]/20 to-[#9945FF]/15 ring-[#1d9bf0]/25"] as const
                      : ty.includes("alert") || ty.includes("price") ? [TrendingUp, "text-amber-400", "from-amber-400/20 to-orange-500/10 ring-amber-400/25"] as const
                      : [Bell, "text-[#1d9bf0]", "from-[#1d9bf0]/20 to-[#9945FF]/15 ring-[#1d9bf0]/25"] as const;
                    return (
                      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br ring-1", ring)}>
                        <Ic className={cn("h-4 w-4", tone)} />
                      </div>
                    );
                  })()}
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
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/[0.06] bg-black/55 px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl">
              <span className="mr-2 text-[19px] font-black text-white">Rooms</span>
              {([["rooms", "Community Rooms"], ["trading", "Trading Lobbies"]] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setRoomsView(id)} className={cn("rounded-full px-4 py-1.5 text-[13px] font-bold transition-all duration-200 active:scale-95", roomsView === id ? "bg-white text-black shadow-[0_2px_12px_rgba(255,255,255,0.2)]" : "bg-white/[0.06] text-white/50 ring-1 ring-white/[0.06] hover:bg-white/[0.1] hover:text-white")}>
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
            <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-black/55 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl">
              <div className="flex items-center justify-between px-4 pt-3">
                <div>
                  <div className="text-[19px] font-black leading-tight text-white">Communities</div>
                  <div className="text-[11px] text-white/35">Token rooms & OG groups — find your people</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSearchScope("communities"); setTab("explore"); }}
                  aria-label="Search communities"
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-white/60 ring-1 ring-white/[0.08] transition hover:bg-white/[0.1] hover:text-white active:scale-95"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 px-4 py-3">
                {([["token", "Token Communities"], ["og", "OG Communities"]] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setCommView(id)} className={cn("rounded-full px-4 py-1.5 text-[13px] font-bold transition-all duration-200 active:scale-95", commView === id ? "bg-white text-black shadow-[0_2px_12px_rgba(255,255,255,0.2)]" : "bg-white/[0.06] text-white/50 ring-1 ring-white/[0.06] hover:bg-white/[0.1] hover:text-white")}>
                    {label}
                  </button>
                ))}
              </div>
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
    <div className="relative flex h-full min-h-0 w-full justify-center bg-black text-white">
      <style>{`
        @keyframes xFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .x-fade-in { animation: xFadeIn .28s ease both; }
        @keyframes xGlowPulse { 0%,100% { opacity: .5; } 50% { opacity: .9; } }
        @keyframes xLikePop { 0% { transform: scale(1); } 40% { transform: scale(1.45); } 70% { transform: scale(.9); } 100% { transform: scale(1); } }
        .x-like-pop { animation: xLikePop .45s cubic-bezier(.34,1.56,.64,1) both; }
        .x-marquee { overflow: hidden; position: relative; }
        .x-marquee-track { display: flex; width: max-content; animation: xTick 36s linear infinite; }
        .x-marquee:hover .x-marquee-track { animation-play-state: paused; }
        @keyframes xTick { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .x-tilt { transition: transform .2s ease, border-color .2s ease, background .2s ease; }
        .x-tilt:hover { transform: translateY(-3px); border-color: rgba(29,155,240,.45); }
        @keyframes xRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .x-rise { animation: xRise .5s cubic-bezier(.22,1,.36,1) both; }
        @keyframes xShim { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .x-shim { background: linear-gradient(90deg, rgba(255,255,255,.04) 25%, rgba(255,255,255,.09) 37%, rgba(255,255,255,.04) 63%); background-size: 200% 100%; animation: xShim 1.4s ease infinite; }
      `}</style>
      {/* ambient atmosphere */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-[#1d9bf0]/[0.05] blur-[120px]" />
        <div className="absolute -bottom-40 right-1/4 h-80 w-80 rounded-full bg-[#9945FF]/[0.05] blur-[120px]" />
      </div>
      {/* ── Left nav rail ── */}
      <header className="hidden h-full shrink-0 flex-col justify-between border-r border-white/[0.08] px-2 py-3 sm:flex sm:w-[72px] xl:w-[260px] xl:px-4">
        <div className="flex flex-col gap-1">
          <div className="mb-1 flex items-center gap-2 px-3 py-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#1d9bf0] to-[#9945FF] text-[15px] font-black text-white shadow-[0_4px_16px_rgba(29,155,240,0.45)]">O</span>
            <span className="hidden text-[17px] font-black tracking-tight xl:block">OrbitX</span>
            <a href="/app" className="ml-auto hidden rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-white/50 transition hover:bg-white/[0.06] hover:text-white xl:block">Hub</a>
          </div>
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setTab(n.id)}
              className={cn(
                "group flex items-center gap-4 rounded-full px-3 py-2.5 transition-all duration-200 active:scale-[0.97]",
                tab === n.id
                  ? "bg-white/[0.06] font-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
                  : "font-medium text-white/80 hover:bg-white/[0.05]",
              )}
            >
              <span className="relative">
                <n.Icon className={cn("h-6 w-6 transition-transform duration-200 group-hover:scale-110", tab === n.id ? "text-[#1d9bf0] drop-shadow-[0_0_8px_rgba(29,155,240,0.5)]" : "text-white/80")} />
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
            className="mt-3 flex items-center justify-center rounded-full bg-gradient-to-r from-[#1d9bf0] via-[#4a9ff5] to-[#1d9bf0] bg-[length:200%_100%] bg-left py-3 text-[16px] font-black text-white shadow-[0_8px_24px_rgba(29,155,240,0.4)] transition-all duration-300 hover:bg-right hover:shadow-[0_8px_32px_rgba(29,155,240,0.55)] active:scale-[0.98] xl:px-8"
          >
            <Feather className="h-5 w-5 xl:hidden" />
            <span className="hidden xl:block">Post</span>
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-transparent p-2 transition hover:border-white/[0.07] hover:bg-white/[0.05]">
          <img src={myAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
          <div className="hidden min-w-0 flex-1 xl:block">
            <div className="truncate text-[14px] font-black">{displayName}</div>
            <div className="truncate text-[12px] text-white/35">@{handle}</div>
          </div>
          <a href="/settings" title="Settings" className="hidden rounded-full p-1.5 text-white/35 transition hover:text-white xl:block">
            <Settings className="h-4 w-4" />
          </a>
          <button type="button" title="Log out" onClick={() => signOut?.()} className="hidden rounded-full p-1.5 text-white/35 transition hover:text-rose-400 xl:block">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Center column ── */}
      <main className={cn(
        "relative flex h-full min-h-0 min-w-0 flex-col border-r border-white/[0.08]",
        isNarrow ? "w-full max-w-[600px]" : "w-full max-w-[900px]",
      )}>
        {tab === "home" && newPosts > 0 && (
          <button
            type="button"
            onClick={() => { feedScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); setNewPosts(0); }}
            className="x-rise absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#1d9bf0] to-[#9945FF] px-4 py-2 text-[13px] font-black text-white shadow-[0_8px_24px_rgba(29,155,240,0.5)] transition hover:brightness-110 active:scale-95 sm:top-3"
          >
            ▲ {newPosts} new post{newPosts > 1 ? "s" : ""}
          </button>
        )}
        <div
          ref={feedScrollRef}
          onScroll={(e) => { if (e.currentTarget.scrollTop < 200 && newPosts) setNewPosts(0); }}
          className="min-h-0 flex-1 overflow-y-auto pb-24 pt-11 sm:pb-0 sm:pt-0"
        >{renderCenter()}</div>
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
                className="w-full rounded-full border border-white/[0.06] bg-white/[0.06] py-2.5 pl-11 pr-4 text-[15px] text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-[#1d9bf0]/70 focus:shadow-[0_0_0_3px_rgba(29,155,240,0.15)]"
              />
            </div>
          )}

          {/* Market snapshot */}
          <div className="x-rise overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.015] shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[19px] font-black">Market snapshot</span>
              <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-black", marketPulse.avg >= 0 ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400")}>
                {marketPulse.avg >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {marketPulse.avg >= 0 ? "+" : ""}{marketPulse.avg.toFixed(1)}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-px bg-white/[0.06]">
              {([
                { k: "SOL", v: marketPulse.sol?.priceUsd != null ? "$" + marketPulse.sol.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—", c: "text-white" },
                { k: "Gainers", v: String(marketPulse.gainers), c: "text-emerald-400" },
                { k: "Losers", v: String(marketPulse.losers), c: "text-rose-400" },
              ]).map((cell) => (
                <div key={cell.k} className="bg-[#0b0d12] px-3 py-2.5">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-white/35">{cell.k}</div>
                  <div className={cn("text-[14px] font-black", cell.c)}>{cell.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="x-rise overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.015] shadow-[0_8px_24px_rgba(0,0,0,0.35)]" style={{ animationDelay: "80ms" }}>
            <div className="flex items-center gap-2 px-4 py-3"><span>🔥</span><span className="text-[19px] font-black">What's happening</span></div>
            {ticker.length === 0 ? (
              <div className="space-y-2.5 px-4 pb-3 pt-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="x-shim h-3 w-24 rounded-full" />
                    <div className="x-shim h-3 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : ticker.slice(0, 5).map((t, i) => <TrendRow key={t.mint} t={t} i={i} />)}
            <button type="button" onClick={() => setTab("explore")} className="w-full px-4 py-3 text-left text-[14px] font-bold text-[#1d9bf0] transition hover:bg-white/[0.03]">
              Show more
            </button>
          </div>

          <div className="x-rise overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.015] shadow-[0_8px_24px_rgba(0,0,0,0.35)]" style={{ animationDelay: "160ms" }}>
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

      {/* ── Mobile slim top bar (brand + Hub escape; no tab duplicates) ── */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-black/80 px-4 py-2 backdrop-blur-xl sm:hidden">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#1d9bf0] to-[#9945FF] text-[13px] font-black text-white">O</span>
          <span className="text-[15px] font-black tracking-tight text-white">OrbitX</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { setTab("notifications"); setMoreOpen(false); }}
            aria-label="Notifications"
            className={cn("relative rounded-full p-2 transition", tab === "notifications" ? "text-[#1d9bf0]" : "text-white/40 hover:text-white")}
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#1d9bf0] px-1 text-[9px] font-black text-white ring-2 ring-black">{unread > 9 ? "9+" : unread}</span>
            )}
          </button>
          <a href="/settings" className="rounded-full p-2 text-white/40 transition hover:text-white"><Settings className="h-4 w-4" /></a>
          <a href="/app" className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-white/60 transition hover:bg-white/[0.06] hover:text-white">Hub</a>
        </div>
      </div>

      {/* ── Mobile bottom nav: floating centered rounded slider pill ── */}
      <nav className="pointer-events-none fixed inset-x-0 bottom-3 z-30 flex justify-center sm:hidden">
        <div className="pointer-events-auto relative flex items-center rounded-full border border-white/[0.12] bg-gradient-to-b from-[#16181c]/95 to-black/95 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.03),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl">
          {/* sliding active indicator */}
          {PILL_INDEX >= 0 && (
            <span
              className="absolute top-1.5 h-10 w-12 rounded-full bg-gradient-to-br from-[#1d9bf0]/30 to-[#9945FF]/20 ring-1 ring-[#1d9bf0]/50 shadow-[0_0_14px_rgba(29,155,240,0.4)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              style={{ transform: `translateX(${PILL_INDEX * 48}px)` }}
            />
          )}
          {CORE_TABS.map((id) => {
            const n = NAV.find((x) => x.id === id)!;
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn("relative z-10 grid h-10 w-12 place-items-center rounded-full transition-colors", on ? "text-[#1d9bf0]" : "text-white/45 hover:text-white/75")}
              >
                <n.Icon className={cn("h-[22px] w-[22px]", on && "stroke-[2.5]")} />
              </button>
            );
          })}
          <button
            key="more"
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            className="relative z-10 grid h-10 w-12 place-items-center rounded-full transition-colors text-white/45 hover:text-white/75"
          >
            <MoreHorizontal className="h-[22px] w-[22px]" />
          </button>
        </div>
      </nav>

      {/* ── More sheet (Chat / Rooms / Spaces / Communities) ── */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="x-fade-in absolute inset-x-3 bottom-20 rounded-3xl border border-white/[0.1] bg-gradient-to-b from-[#14171b]/98 to-[#0b0d10]/98 p-3 shadow-[0_16px_48px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-2">
              {MORE_TABS.map((id) => {
                const n = NAV.find((x) => x.id === id)!;
                const on = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setTab(id); setMoreOpen(false); }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 transition",
                      on ? "bg-[#1d9bf0]/15 text-[#1d9bf0]" : "text-white/60 hover:bg-white/[0.05] hover:text-white",
                    )}
                  >
                    <n.Icon className="h-6 w-6" />
                    <span className="text-[11px] font-bold">{n.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile compose FAB ── */}
      {tab === "home" && (
        <button
          type="button"
          onClick={() => { setComposeOpen(true); setTimeout(() => modalRef.current?.focus(), 60); }}
          className="fixed bottom-[4.7rem] right-4 z-30 grid h-[52px] w-[52px] place-items-center rounded-full bg-gradient-to-br from-[#1d9bf0] to-[#0f7ac4] text-white shadow-[0_8px_28px_rgba(29,155,240,0.5)] ring-1 ring-white/10 transition-all active:scale-90 sm:hidden"
        >
          <Feather className="h-6 w-6" />
        </button>
      )}

      {/* ── Compose modal ── */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#5b7083]/40 p-4 pt-[8vh]" onClick={() => setComposeOpen(false)}>
          <div className="x-fade-in w-full max-w-[600px] rounded-2xl border border-white/[0.1] bg-gradient-to-b from-[#101214] to-black shadow-[0_24px_64px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.06]" onClick={(e) => e.stopPropagation()}>
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
