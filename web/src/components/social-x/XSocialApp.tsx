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
  ArrowDownRight, Users, Bookmark, LogOut, LayoutGrid, Settings, Coins, Image as ImageIcon, Smile,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn, safeAvatarUrl } from "@/lib/utils";
import { PlatformLinks } from "@/components/theme/PlatformDock";
import "./x-social.css";

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
  | "chat" | "rooms" | "spaces" | "communities" | "profile" | "bookmarks";

interface Post {
  id: string; user_id: string; username: string | null; avatar_url: string | null;
  content: string; likes_count: number | null; liked_by: string[] | null; created_at: string; reply_to?: string | null; repost_of?: string | null;
}
interface Suggestion { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null; is_official_account?: boolean | null; bio?: string | null; }
interface Ticker { mint: string; symbol: string | null; priceUsd: number | null; change24h: number | null; }
interface NotifRow { id: string; type: string; title: string; message: string; is_read: boolean; created_at: string; }
interface CommunityLite { id: string; name: string; description: string | null; member_count: number | null; avatar_url?: string | null; icon?: string | null; category?: string | null; }

const FEED_CHANNEL = "social-general";
const MAX_LEN = 500;
const BOOKMARKS_KEY = "orbitx-x-bookmarks";
const DRAFT_KEY = "orbitx-x-draft";
const EMOJIS = ["🔥", "🚀", "💎", "📈", "📉", "🐂", "🐻", "🤝", "💰", "🎯", "👀", "🙌", "😂", "😅", "😎", "🤔", "🫡", "🧠", "⚡", "✨", "🌙", "☀️", "💯", "🏆", "👑", "🥳", "😤", "🤯", "🫠", "💀", "🤡", "🧢", "🐋", "🦍", "🍀", "⏰", "📊", "❤️", "🎉", "🙏"];

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
    if (tok.startsWith("$") || tok.startsWith("@") || tok.startsWith("#")) parts.push(<span key={i++} className="text-[#ffffff] hover:underline cursor-pointer">{tok}</span>);
    else if (tok.startsWith("http")) parts.push(<a key={i++} href={tok} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#ffffff] hover:underline break-all">{tok}</a>);
    else if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(tok)) parts.push(<button key={i++} type="button" onClick={(e) => { e.stopPropagation(); onMint?.(tok); }} className="font-mono text-[12px] text-[#ffffff] hover:underline">{tok.slice(0, 4)}…{tok.slice(-4)}</button>);
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
  { id: "bookmarks", label: "Bookmarks", Icon: Bookmark },
];

/* Mobile dock: 5 core tabs; overflow + Notifications in More sheet (bell also opens Notifications). */
const CORE_TABS: XTab[] = ["home", "explore", "communities", "messages", "profile"];
const MORE_TABS: XTab[] = ["notifications", "chat", "rooms", "spaces", "bookmarks"];

const TAB_SHORT: Partial<Record<XTab, string>> = {
  home: "Home",
  explore: "Explore",
  communities: "Communities",
  messages: "Messages",
  profile: "Profile",
  notifications: "Alerts",
  chat: "Chat",
  rooms: "Rooms",
  spaces: "Spaces",
  bookmarks: "Saved",
};

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
const NARROW_TABS: XTab[] = ["home", "explore", "notifications", "bookmarks"];

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
  const [text, setText] = useState(() => { try { return localStorage.getItem(DRAFT_KEY) || ""; } catch { return ""; } });
  const [posting, setPosting] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [detailReplies, setDetailReplies] = useState<Post[]>([]);
  const [detailParent, setDetailParent] = useState<{ id: string; username: string | null } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [repostOriginals, setRepostOriginals] = useState<Record<string, Post>>({});
  const [, setClockTick] = useState(0);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ticker, setTicker] = useState<Ticker[]>([]);
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(loadBookmarks);
  const [bookmarkPosts, setBookmarkPosts] = useState<Post[]>([]);
  const [bmLoading, setBmLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchScope, setSearchScope] = useState<"all" | "people" | "coins" | "communities">("all");
  const [foundProfiles, setFoundProfiles] = useState<Suggestion[]>([]);
  const [foundComms, setFoundComms] = useState<CommunityLite[]>([]);
  const [foundDexCoins, setFoundDexCoins] = useState<Ticker[]>([]);
  const [topComms, setTopComms] = useState<CommunityLite[]>([]);
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
  // Keep relative timestamps ("2m", "1h") fresh without a reload.
  useEffect(() => {
    const id = window.setInterval(() => setClockTick((t) => (t + 1) % 1000000), 60000);
    return () => window.clearInterval(id);
  }, []);
  // Draft autosave: persist the composer text so it survives refresh/navigation
  // (matches the "Drafts save automatically" hint in the compose modal).
  useEffect(() => {
    try { if (text.trim()) localStorage.setItem(DRAFT_KEY, text); else localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }, [text]);
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
  const composerFileRef = useRef<HTMLInputElement>(null);
  const exploreSearchRef = useRef<HTMLInputElement>(null);

  const displayName = profile?.display_name || profile?.username || "You";
  const handle = profile?.username || "anon";
  const myAvatar = avatarOf(profile?.avatar_url, user?.id || "me");

  /* ── Feed data ── */
  const load = useCallback(async () => {
    const { data } = await supabase
      .from("social_messages")
      .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at,repost_of")
      .eq("channel", FEED_CHANNEL).is("reply_to", null).order("created_at", { ascending: false }).limit(100);
    if (data) setPosts(data as Post[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("x-home-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_messages", filter: `channel=eq.${FEED_CHANNEL}` },
        (p) => { const row = p.new as Post; if (row.reply_to) return; setPosts((prev) => prev.some((x) => x.id === row.id) ? prev : [row, ...prev]); if (tabRef.current === "home" && row.user_id !== uidRef.current && (feedScrollRef.current?.scrollTop ?? 0) > 300) setNewPosts((n) => n + 1); })
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

  useEffect(() => {
    supabase.from("communities").select("id,name,description,member_count,avatar_url,icon,category").order("member_count", { ascending: false }).limit(6)
      .then(({ data }) => { if (data) setTopComms(data as CommunityLite[]); });
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

  /* ── Bookmarks: fetch saved posts by id when the tab is open ── */
  useEffect(() => {
    if (tab !== "bookmarks") return;
    const ids = [...bookmarks].filter((id) => !id.startsWith("tmp-"));
    if (ids.length === 0) { setBookmarkPosts([]); return; }
    setBmLoading(true);
    supabase.from("social_messages")
      .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at")
      .in("id", ids)
      .then(({ data }) => {
        const rows = ((data as Post[]) || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setBookmarkPosts(rows);
        setBmLoading(false);
      });
  }, [tab, bookmarks]);

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
  const notify = async (recipientId: string | null | undefined, type: string, title: string, message: string, targetId?: string) => {
    if (!recipientId || !user || recipientId === user.id) return;
    try {
      await supabase.from("notifications").insert({
        user_id: recipientId, type, title, message,
        is_read: false, read: false, actor_id: user.id, kind: type,
        target_type: "post", target_id: targetId ?? null, created_at: new Date().toISOString(),
      });
    } catch { /* best-effort */ }
  };

  const follow = async (uid: string) => {
    if (!user) { toast.error("Sign in to follow"); return; }
    setFollowingSet((prev) => new Set(prev).add(uid));
    const { error } = await supabase.from("followers").insert({ follower_id: user.id, followee_id: uid });
    if (error) setFollowingSet((prev) => { const n = new Set(prev); n.delete(uid); return n; });
    else void notify(uid, "follow", "New follower", `@${handle} followed you`);
  };

  const uploadComposerImage = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploadingImg(true);
    try {
      for (const file of Array.from(files).slice(0, 4)) {
        if (!file.type.startsWith("image/")) continue;
        const ext = (file.name.split(".").pop() || "png").toLowerCase();
        const path = `posts/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("profile-media").upload(path, file, { contentType: file.type, upsert: false });
        if (error) { toast.error("Image upload failed"); continue; }
        const { data } = supabase.storage.from("profile-media").getPublicUrl(path);
        if (data?.publicUrl) setPendingImages((prev) => [...prev, data.publicUrl].slice(0, 4));
      }
    } finally { setUploadingImg(false); }
  };

  const submit = async (raw?: string) => {
    const base = (raw ?? text).trim();
    const media = pendingImages.length ? pendingImages.join("\n") : "";
    const content = [base, media].filter(Boolean).join("\n").trim();
    if (!content || !user || posting) return;
    setPosting(true); setText("");
    const imgsSnapshot = pendingImages;
    setPendingImages([]);
    const optimistic: Post = { id: `tmp-${Date.now()}`, user_id: user.id, username: profile?.username || "Anon", avatar_url: profile?.avatar_url || null, content, likes_count: 0, liked_by: [], created_at: new Date().toISOString() };
    setPosts((prev) => [optimistic, ...prev]);
    const { data, error } = await supabase.from("social_messages")
      .insert({ channel: FEED_CHANNEL, user_id: user.id, username: profile?.username || "Anon", avatar_url: profile?.avatar_url, content, likes_count: 0, liked_by: [] })
      .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at").single();
    if (error) { toast.error("Could not post. Try again."); setPosts((prev) => prev.filter((p) => p.id !== optimistic.id)); setText(base); setPendingImages(imgsSnapshot); }
    else if (data) setPosts((prev) => prev.map((p) => p.id === optimistic.id ? (data as Post) : p));
    setPosting(false);
    setComposeOpen(false);
  };

  useEffect(() => {
    if (!openPostId) { setDetailPost(null); setDetailReplies([]); setDetailParent(null); return; }
    const existing = posts.find((p) => p.id === openPostId) || null;
    setDetailPost(existing);
    setDetailParent(null);
    setDetailLoading(true);
    let cancelled = false;
    (async () => {
      let thePost = existing;
      if (!thePost) {
        const { data } = await supabase.from("social_messages").select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at,reply_to").eq("id", openPostId).single();
        if (!cancelled && data) { thePost = data as Post; setDetailPost(data as Post); }
      }
      if (thePost?.reply_to) {
        const { data: par } = await supabase.from("social_messages").select("id,username").eq("id", thePost.reply_to).single();
        if (!cancelled && par) setDetailParent({ id: (par as { id: string }).id, username: (par as { username: string | null }).username });
      }
      const { data: reps } = await supabase.from("social_messages").select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at,reply_to").eq("reply_to", openPostId).order("created_at", { ascending: true }).limit(100);
      if (!cancelled) { setDetailReplies((reps as Post[]) || []); setDetailLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [openPostId, posts]);

  const submitReply = async () => {
    const content = replyText.trim();
    if (!content || !user || !openPostId || replyPosting) return;
    const parentId = openPostId;
    setReplyPosting(true); setReplyText("");
    const { data, error } = await supabase.from("social_messages")
      .insert({ channel: FEED_CHANNEL, user_id: user.id, username: profile?.username || "Anon", avatar_url: profile?.avatar_url, content, likes_count: 0, liked_by: [], reply_to: parentId })
      .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at").single();
    if (error) { toast.error("Could not reply. Try again."); setReplyText(content); }
    else if (data) { setDetailReplies((prev) => [...prev, data as Post]); setReplyCounts((prev) => ({ ...prev, [parentId]: (prev[parentId] || 0) + 1 })); void notify(detailPost?.user_id, "reply", "New reply", `@${handle} replied: ${content.slice(0, 80)}`, parentId); }
    setReplyPosting(false);
  };

  const feedIdsKey = useMemo(() => posts.map((p) => p.id).join(","), [posts]);
  useEffect(() => {
    const ids = feedIdsKey ? feedIdsKey.split(",") : [];
    if (ids.length === 0) { setReplyCounts({}); return; }
    let cancelled = false;
    supabase.from("social_messages").select("reply_to").in("reply_to", ids).limit(2000)
      .then(({ data }) => {
        if (cancelled) return;
        const m: Record<string, number> = {};
        ((data as Array<{ reply_to: string | null }>) || []).forEach((r) => { if (r.reply_to) m[r.reply_to] = (m[r.reply_to] || 0) + 1; });
        setReplyCounts(m);
      });
    return () => { cancelled = true; };
  }, [feedIdsKey]);

  useEffect(() => {
    const ids = [...new Set(posts.filter((p) => p.repost_of).map((p) => p.repost_of as string))].filter((id) => !repostOriginals[id]);
    if (ids.length === 0) return;
    let cancelled = false;
    supabase.from("social_messages").select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at,repost_of").in("id", ids)
      .then(({ data }) => {
        if (cancelled) return;
        const m: Record<string, Post> = {};
        ((data as Post[]) || []).forEach((pp) => { m[pp.id] = pp; });
        setRepostOriginals((prev) => ({ ...prev, ...m }));
      });
    return () => { cancelled = true; };
  }, [posts]);

  useEffect(() => {
    if (!openPostId) return;
    const parentId = openPostId;
    const ch = supabase.channel(`x-thread-${parentId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_messages", filter: `reply_to=eq.${parentId}` },
        (p) => {
          const row = p.new as Post;
          setDetailReplies((prev) => prev.some((x) => x.id === row.id) ? prev : [...prev, row]);
          if (row.user_id !== uidRef.current) setReplyCounts((prev) => ({ ...prev, [parentId]: (prev[parentId] || 0) + 1 }));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [openPostId]);

  const toggleLike = async (post: Post) => {
    if (!user) { toast.error("Sign in to like"); return; }
    if (post.id.startsWith("tmp-")) return;
    const likedBy = post.liked_by || [];
    const liked = likedBy.includes(user.id);
    if (!liked) void notify(post.user_id, "like", "New like", `@${handle} liked your post`, post.id);
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

  const repost = async (p: Post) => {
    if (!user) { toast.error("Sign in to repost"); return; }
    const target = p.repost_of ? p.repost_of : p.id;
    const orig = p.repost_of ? repostOriginals[p.repost_of] : p;
    const optimistic: Post = { id: `tmp-${Date.now()}`, user_id: user.id, username: profile?.username || "Anon", avatar_url: profile?.avatar_url || null, content: "", likes_count: 0, liked_by: [], created_at: new Date().toISOString(), repost_of: target };
    setPosts((prev) => [optimistic, ...prev]);
    if (orig) setRepostOriginals((prev) => ({ ...prev, [target]: prev[target] ?? orig }));
    const { data, error } = await supabase.from("social_messages")
      .insert({ channel: FEED_CHANNEL, user_id: user.id, username: profile?.username || "Anon", avatar_url: profile?.avatar_url, content: "", likes_count: 0, liked_by: [], repost_of: target })
      .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at,repost_of").single();
    if (error) { toast.error("Could not repost. Try again."); setPosts((prev) => prev.filter((x) => x.id !== optimistic.id)); }
    else if (data) { setPosts((prev) => prev.map((x) => x.id === optimistic.id ? (data as Post) : x)); void notify((orig ?? p).user_id, "repost", "New repost", `@${handle} reposted your post`, target); toast.success("Reposted"); }
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
  const unread = notifs.filter((n) => !n.is_read).length;
  const tabLabel = NAV.find((n) => n.id === tab)?.label ?? "Social";
  const dockOnMore = MORE_TABS.includes(tab) || moreOpen;

  /* ═══════════ Sub-renderers ═══════════ */

  const Composer = ({ inline, refEl }: { inline?: boolean; refEl: React.RefObject<HTMLTextAreaElement> }) => (
    <div className={cn("flex gap-3", inline && "oxs-composer px-4 py-3")}>
      <img src={myAvatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <textarea
          ref={refEl}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
          placeholder="What’s happening?"
          rows={inline ? 2 : 4}
          className="w-full resize-none bg-transparent text-[20px] leading-snug text-white placeholder:text-white/50 outline-none"
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
        />
        {pendingImages.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {pendingImages.map((url) => (
              <div key={url} className="relative h-16 w-16 overflow-hidden rounded-xl ring-1 ring-white/10">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setPendingImages((prev) => prev.filter((u) => u !== url))} className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-white/80 transition hover:text-white" aria-label="Remove image">
                  <XIcon className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between border-t border-white/[0.08] pt-2.5">
          <span className="relative flex items-center gap-0.5">
            <button type="button" onClick={() => composerFileRef.current?.click()} disabled={uploadingImg} className="grid h-9 w-9 place-items-center rounded-full text-[#ffffff] transition hover:bg-[#ffffff]/10 disabled:opacity-50" title="Add image">
              {uploadingImg ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <ImageIcon className="h-[18px] w-[18px]" />}
            </button>
            <button type="button" onClick={() => setEmojiOpen((v) => !v)} className="grid h-9 w-9 place-items-center rounded-full text-[#ffffff] transition hover:bg-[#ffffff]/10" title="Add emoji">
              <Smile className="h-[18px] w-[18px]" />
            </button>
            {emojiOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setEmojiOpen(false)} />
                <div className="absolute bottom-10 left-0 z-30 w-[248px] rounded-2xl border border-white/10 bg-[#16181c] p-2 shadow-2xl">
                  <div className="grid grid-cols-8 gap-0.5">
                    {EMOJIS.map((e) => (
                      <button key={e} type="button" onClick={() => { setText((t) => (t + e).slice(0, MAX_LEN)); setEmojiOpen(false); }} className="rounded-md p-1 text-[18px] leading-none transition hover:bg-white/10">{e}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {text.length > MAX_LEN - 40 && (
              <span className="ml-1 text-[12px] font-bold text-orange-400">{MAX_LEN - text.length}</span>
            )}
          </span>
          <button
            type="button"
            disabled={(!text.trim() && pendingImages.length === 0) || posting}
            onClick={() => submit()}
            className={cn(
              "rounded-full px-4 py-1.5 text-[14px] font-bold transition active:scale-95",
              (text.trim() || pendingImages.length > 0) && !posting
                ? "bg-[#ffffff] text-black hover:bg-[#d4d4d4]"
                : "bg-[#ffffff]/40 text-white/60",
            )}
          >
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
          </button>
        </div>
      </div>
    </div>
  );

  const PostCard = ({ p: raw, onOpen }: { p: Post; onOpen?: (id: string) => void }) => {
    const isRepost = Boolean(raw.repost_of);
    const original = isRepost ? repostOriginals[raw.repost_of as string] : raw;
    if (isRepost && !original) {
      return (
        <article className="flex gap-3 border-b border-white/[0.06] px-4 py-3.5 text-[13px] text-white/40">
          <Repeat2 className="mt-0.5 h-4 w-4" /> @{raw.username || "someone"} reposted · loading…
        </article>
      );
    }
    const p = (original ?? raw) as Post;
    const liked = Boolean(user && (p.liked_by || []).includes(user.id));
    const marked = bookmarks.has(p.id);
    const own = user && p.user_id === user.id;
    return (
      <article onClick={() => onOpen?.(p.id)} className={cn("x-fade-in group/post relative flex gap-3 px-4 py-3", onOpen && "cursor-pointer")}>
        <img src={avatarOf(p.avatar_url, p.user_id)} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/10 transition group-hover/post:ring-[#ffffff]/40" />
        <div className="min-w-0 flex-1">
          {isRepost && <div className="mb-0.5 flex items-center gap-1.5 text-[12px] font-bold text-white/40"><Repeat2 className="h-3.5 w-3.5" /> @{raw.username || "someone"} reposted</div>}
          <div className="flex items-baseline gap-1 text-[14px] leading-5">
            <span className="truncate font-black text-white hover:underline">{p.username || "Anon"}</span>
            {officialIds.has(p.user_id) && <BadgeCheck className="h-4 w-4 shrink-0 self-center text-[#ffffff]" />}
            <span className="truncate text-white/35">@{(p.username || "anon").toLowerCase().replace(/\s+/g, "")}</span>
            <span className="text-white/30">·</span>
            <span className="shrink-0 text-white/35 hover:underline">{timeAgo(p.created_at)}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id); }} className="ml-auto rounded-full p-1.5 text-white/30 transition hover:bg-[#ffffff]/10 hover:text-[#ffffff]">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
          {(() => { const { text: body, imgs } = splitMedia(p.content); return (
            <>
              {body && <div className="whitespace-pre-wrap break-words text-[15px] leading-snug text-white">{renderContent(body, onSelectMint)}</div>}
              {imgs.length > 0 && (
                <div className={cn("mt-2 grid gap-1.5 overflow-hidden rounded-2xl", imgs.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                  {imgs.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="block overflow-hidden">
                      <img src={u} alt="" loading="lazy" className={cn("w-full object-cover ring-1 ring-white/[0.08] transition duration-300 hover:scale-[1.02]", imgs.length > 1 ? "h-40" : "max-h-[380px]")} />
                    </a>
                  ))}
                </div>
              )}
            </>
          ); })()}
          <div className="mt-2 flex max-w-md items-center justify-between text-white/35">
            <button type="button" onClick={(e) => { e.stopPropagation(); onOpen ? onOpen(p.id) : replyTo(p); }} className="group flex items-center gap-1.5 transition active:scale-90 hover:text-[#ffffff]">
              <span className="rounded-full p-1.5 transition group-hover:bg-[#ffffff]/10"><MessageCircle className="h-4 w-4" /></span>
              {(replyCounts[p.id] ?? 0) > 0 && <span className="text-[12px] font-bold">{replyCounts[p.id]}</span>}
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); repost(p); }} className="group flex items-center gap-1.5 transition active:scale-90 hover:text-white">
              <span className="rounded-full p-1.5 transition group-hover:bg-white/10"><Repeat2 className="h-4 w-4" /></span>
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); toggleLike(p); }} className={cn("group flex items-center gap-1.5 transition active:scale-90 hover:text-pink-500", liked && "text-pink-500")}>
              <span className="rounded-full p-1.5 transition group-hover:bg-pink-500/10"><Heart className={cn("h-4 w-4", liked && "x-like-pop fill-current")} /></span>
              {(p.likes_count ?? 0) > 0 && <span className="text-[12px] font-bold">{p.likes_count}</span>}
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); toggleBookmark(p); }} className={cn("group flex items-center gap-1.5 transition active:scale-90 hover:text-[#ffffff]", marked && "text-[#ffffff]")}>
              <span className="rounded-full p-1.5 transition group-hover:bg-[#ffffff]/10"><Bookmark className={cn("h-4 w-4", marked && "fill-current")} /></span>
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); share(p); }} className="group flex items-center gap-1.5 transition active:scale-90 hover:text-[#ffffff]">
              <span className="rounded-full p-1.5 transition group-hover:bg-[#ffffff]/10"><Share className="h-4 w-4" /></span>
            </button>
          </div>
        </div>
        {menuId === p.id && (
          <div className="absolute right-3 top-10 z-20 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#16181c] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {own && (
              <button type="button" onClick={() => deletePost(p)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-bold text-white/55 transition hover:bg-white/[0.04]">
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
          {s.is_official_account && <BadgeCheck className="h-4 w-4 shrink-0 text-[#ffffff]" />}
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
        <span className={cn("mt-1 inline-flex items-center gap-0.5 text-[12px] font-bold", up ? "text-white" : "text-white/55")}>
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
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#ffffff]/25 to-[#a3a3a3]/20 text-[18px] ring-1 ring-white/[0.1]">
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
            {/* Sticky For you / Following — Twitter-style header */}
            <div className="oxs-sticky">
              <div className="flex">
                {([["foryou", "For you"], ["following", "Following"]] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFeedMode(id)}
                    className="relative flex-1 py-3 text-[15px] font-bold text-white/50 transition hover:bg-white/[0.03]"
                  >
                    <span className={cn(feedMode === id && "font-black text-white")}>{label}</span>
                    {feedMode === id && (
                      <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-[#ffffff]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="oxs-composer-sticky">
              <Composer inline refEl={composerRef} />
            </div>

            {loading ? (
              <div>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 border-b border-white/[0.08] px-4 py-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-white/[0.06]" />
                    <div className="flex-1 space-y-2.5 py-1">
                      <div className="h-3 w-40 rounded-full bg-white/[0.06]" />
                      <div className="h-3 w-full rounded-full bg-white/[0.04]" />
                      <div className="h-3 w-3/5 rounded-full bg-white/[0.04]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : shownPosts.length === 0 ? (
              <div className="px-8 py-16 text-center">
                <div className="text-[20px] font-black text-white">
                  {feedMode === "following" ? "Nothing here yet" : "Welcome to OrbitX"}
                </div>
                <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-white/40">
                  {feedMode === "following"
                    ? "Follow people to see their posts in your timeline."
                    : "Share what’s happening — your first post kicks off the feed."}
                </p>
                {feedMode === "foryou" && (
                  <button
                    type="button"
                    onClick={() => composerRef.current?.focus()}
                    className="mt-5 rounded-full bg-[#ffffff] px-5 py-2 text-[14px] font-bold text-black transition hover:bg-[#d4d4d4]"
                  >
                    Write a post
                  </button>
                )}
              </div>
            ) : (
              <>
                {shownPosts.map((p, i) => (
                  <React.Fragment key={p.id}>
                    <PostCard p={p} onOpen={setOpenPostId} />
                    {/* One quiet “Who to follow” card, Twitter-style — not a carousel wall */}
                    {i === 3 && feedMode === "foryou" && whoToFollow.length > 0 && (
                      <section className="border-b border-white/[0.08] py-1">
                        <div className="px-4 py-3 text-[18px] font-black text-white">Who to follow</div>
                        {whoToFollow.slice(0, 3).map((s) => (
                          <FollowCard key={s.user_id} s={s} />
                        ))}
                        <button
                          type="button"
                          onClick={() => setTab("explore")}
                          className="w-full px-4 py-3.5 text-left text-[14px] text-[#ffffff] transition hover:bg-white/[0.03]"
                        >
                          Show more
                        </button>
                      </section>
                    )}
                  </React.Fragment>
                ))}
              </>
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
                    className="w-full rounded-full border border-white/[0.06] bg-white/[0.06] py-2.5 pl-11 pr-10 text-[15px] text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-[#ffffff]/70 focus:bg-black focus:shadow-[0_0_0_3px_rgba(255,255,255,0.15)]"
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
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-[#ffffff] to-[#a3a3a3]" />
                  </div>
                )}
                {showPeople && (
                  <section className="border-b border-white/[0.06] pb-2">
                    <div className="flex items-center gap-2 px-4 pb-1 pt-5">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#ffffff]/20 to-[#a3a3a3]/15 ring-1 ring-white/[0.08]"><Users className="h-3.5 w-3.5 text-[#ffffff]" /></span>
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
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#ffffff]/20 to-[#a3a3a3]/15 ring-1 ring-white/[0.08]"><Coins className="h-3.5 w-3.5 text-[#ffffff]" /></span>
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
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#ffffff]/20 to-[#a3a3a3]/15 ring-1 ring-white/[0.08]"><Globe className="h-3.5 w-3.5 text-[#ffffff]" /></span>
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
                  <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-[#ffffff]/20 blur-[70px]" />
                  <div className="pointer-events-none absolute -left-16 top-6 h-40 w-40 rounded-full bg-[#a3a3a3]/15 blur-[80px]" />
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
                          <c.Icon className="h-5 w-5 text-white/70 transition group-hover:text-[#ffffff]" />
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
                      <button key={tag} type="button" onClick={() => setSearchQ(tag)} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12.5px] font-bold text-[#ffffff]/90 transition hover:border-[#ffffff]/40 hover:bg-[#ffffff]/10 active:scale-95">{tag}</button>
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
                            <span className={cn("shrink-0 text-[12px] font-black", up ? "text-white" : "text-white/55")}>{up ? "▲" : "▼"}{Math.abs(t.change24h ?? 0).toFixed(1)}%</span>
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
                          <div className="text-[14px] font-black text-[#ffffff]">{tag}</div>
                          <div className="text-[11px] text-white/35">{count} post{count > 1 ? "s" : ""}</div>
                        </div>
                        <TrendingUp className="h-4 w-4 text-white/25" />
                      </button>
                    ))}
                  </div>
                )}

                {topComms.length > 0 && (
                  <div className="x-rise border-b border-white/[0.06] pb-2" style={{ animationDelay: "200ms" }}>
                    <div className="px-4 pt-4 text-[15px] font-black text-white">Communities to explore</div>
                    {topComms.map((c) => <CommunityRow key={c.id} c={c} />)}
                  </div>
                )}

                <div className="x-rise pb-2" style={{ animationDelay: "260ms" }}>
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
                  {unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#ffffff] px-1.5 text-[11px] font-black text-black">{unread > 99 ? "99+" : unread}</span>}
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
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#ffffff]/15 to-[#a3a3a3]/10 ring-1 ring-white/[0.08]">
                  <Bell className="h-6 w-6 text-[#ffffff]/70" />
                </div>
                <div className="mt-3 text-[17px] font-black text-white">{notifFilter === "all" ? "Nothing yet" : "You\u2019re all caught up"}</div>
                <div className="mt-1 text-[13px] text-white/40">{notifFilter === "all" ? "Likes, follows and alerts will show up here." : `No ${notifFilter} notifications.`}</div>
              </div>
            ) : (
              shownNotifs.map((n) => (
                <div key={n.id} className={cn("x-fade-in flex gap-3 border-b border-white/[0.06] px-4 py-3.5 transition-colors hover:bg-white/[0.02]", !n.is_read && "bg-[#ffffff]/[0.05] shadow-[inset_2px_0_0_#ffffff]")}>
                  {(() => {
                    const ty = (n.type || "").toLowerCase();
                    const [Ic, tone, ring] = ty.includes("like") ? [Heart, "text-pink-500", "from-pink-500/20 to-rose-500/10 ring-pink-500/25"] as const
                      : ty.includes("follow") ? [User, "text-white", "from-white/20 to-white/10 ring-white/25"] as const
                      : ty.includes("repl") || ty.includes("mention") || ty.includes("comment") ? [MessageCircle, "text-[#ffffff]", "from-[#ffffff]/20 to-[#a3a3a3]/15 ring-[#ffffff]/25"] as const
                      : ty.includes("alert") || ty.includes("price") ? [TrendingUp, "text-amber-400", "from-amber-400/20 to-orange-500/10 ring-amber-400/25"] as const
                      : [Bell, "text-[#ffffff]", "from-[#ffffff]/20 to-[#a3a3a3]/15 ring-[#ffffff]/25"] as const;
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

      case "bookmarks":
        return (
          <>
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/[0.06] bg-black/55 px-4 py-3.5 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl">
              <span className="text-[19px] font-black text-white">Bookmarks</span>
              <span className="text-[13px] font-bold text-white/40">{bookmarks.size}</span>
            </div>
            {bmLoading ? (
              <div>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex animate-pulse gap-3 border-b border-white/[0.06] px-4 py-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-white/[0.07]" />
                    <div className="flex-1 space-y-2 py-1"><div className="h-3 w-36 rounded-full bg-white/[0.07]" /><div className="h-3 w-full rounded-full bg-white/[0.05]" /></div>
                  </div>
                ))}
              </div>
            ) : bookmarkPosts.length === 0 ? (
              <div className="px-8 py-16 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#ffffff]/15 to-[#a3a3a3]/10 ring-1 ring-white/[0.08]"><Bookmark className="h-6 w-6 text-[#ffffff]/70" /></div>
                <div className="mt-3 text-[17px] font-black text-white">No bookmarks yet</div>
                <div className="mt-1 text-[13px] text-white/40">Tap the bookmark icon on any post to save it here.</div>
              </div>
            ) : (
              bookmarkPosts.map((p) => <PostCard key={p.id} p={p} onOpen={setOpenPostId} />)
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
    <div className="oxs-shell ox-x-social">
      <div className="oxs-shell__atmosphere" aria-hidden>
        <div className="oxs-shell__blob oxs-shell__blob--a" />
        <div className="oxs-shell__blob oxs-shell__blob--b" />
      </div>

      {/* ── Mobile header ── */}
      <header className="oxs-header">
        <div className="oxs-header__bg" />
        <div className="oxs-header__brand">
          {!CORE_TABS.includes(tab) ? (
            <button
              type="button"
              className="oxs-header__back"
              onClick={() => { setTab("home"); setMoreOpen(false); }}
            >
              <span className="oxs-header__back-ico" aria-hidden>‹</span>
              {tabLabel}
            </button>
          ) : (
            <>
              <img src="/favicon.png" alt="" width={30} height={30} className="oxs-header__mark" decoding="async" />
              <div className="oxs-header__text">
                <p className="oxs-header__name">OrbitX</p>
                <p className="oxs-header__sub">{tabLabel}</p>
              </div>
            </>
          )}
        </div>
        <div className="oxs-header__trail">
          <button
            type="button"
            onClick={() => { setTab("notifications"); setMoreOpen(false); }}
            aria-label="Notifications"
            className={cn("oxs-header__bell", tab === "notifications" && "oxs-header__bell--on")}
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="oxs-header__badge">{unread > 9 ? "9+" : unread}</span>
            )}
          </button>
          <a href="/app" className="oxs-header__hub">Hub</a>
        </div>
      </header>

      {/* ── Left nav rail (desktop) ── */}
      <header className="oxs-rail">
        <div>
          <div className="oxs-rail__brand">
            <span className="oxs-rail__brand-mark">O</span>
            <span className="oxs-rail__brand-name">OrbitX</span>
            <a href="/app" className="oxs-rail__hub">Hub</a>
          </div>
          <div className="mb-2 hidden px-2 xl:block">
            <PlatformLinks className="ox-platform-links--compact" />
          </div>
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => { if (tab === n.id) feedScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); else setTab(n.id); }}
              className={cn("oxs-rail__link", tab === n.id && "oxs-rail__link--on")}
            >
              <span className="relative">
                <n.Icon className="oxs-rail__ico h-6 w-6" />
                {n.id === "notifications" && unread > 0 && (
                  <span className="absolute -right-1.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#ffffff] px-1 text-[9px] font-black text-black">{unread > 9 ? "9+" : unread}</span>
                )}
              </span>
              <span className="oxs-rail__label">{n.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setComposeOpen(true); setTimeout(() => modalRef.current?.focus(), 60); }}
            className="oxs-rail__post"
          >
            <Feather className="oxs-rail__post-ico h-5 w-5" />
            <span className="oxs-rail__post-label">Post</span>
          </button>
        </div>

        <div className="oxs-rail__user">
          <img src={myAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
          <div className="oxs-rail__user-meta">
            <div className="truncate text-[14px] font-black">{displayName}</div>
            <div className="truncate text-[12px] text-white/35">@{handle}</div>
          </div>
          <a href="/settings" title="Settings" className="oxs-rail__user-action">
            <Settings className="h-4 w-4" />
          </a>
          <button type="button" title="Log out" onClick={() => signOut?.()} className="oxs-rail__user-action oxs-rail__user-action--danger">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Center column ── */}
      <main className={cn("oxs-main", !isNarrow && "oxs-main--wide")}>
        {tab === "home" && newPosts > 0 && (
          <button
            type="button"
            onClick={() => { feedScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); setNewPosts(0); }}
            className="x-rise absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#ffffff] to-[#a3a3a3] px-4 py-2 text-[13px] font-black text-black shadow-[0_8px_24px_rgba(255,255,255,0.45)] transition hover:brightness-110 active:scale-95 sm:top-3"
          >
            ▲ {newPosts} new post{newPosts > 1 ? "s" : ""}
          </button>
        )}
        <div
          ref={feedScrollRef}
          onScroll={(e) => { if (e.currentTarget.scrollTop < 200 && newPosts) setNewPosts(0); }}
          className="oxs-main__scroll"
        >
          {renderCenter()}
        </div>
      </main>

      {/* ── Right rail ── */}
      {isNarrow && (
        <aside className="oxs-aside">
          {tab !== "explore" && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); if (e.target.value.trim()) setTab("explore"); }}
                placeholder="Search"
                className="w-full rounded-full border border-white/[0.06] bg-white/[0.06] py-2.5 pl-11 pr-4 text-[15px] text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-[#ffffff]/70 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.15)]"
              />
            </div>
          )}

          <div className="oxs-aside__card x-rise">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[19px] font-black">Market snapshot</span>
              <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-black", marketPulse.avg >= 0 ? "bg-white/10 text-white" : "bg-white/10 text-white/55")}>
                {marketPulse.avg >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {marketPulse.avg >= 0 ? "+" : ""}{marketPulse.avg.toFixed(1)}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-px bg-white/[0.06]">
              {([
                { k: "SOL", v: marketPulse.sol?.priceUsd != null ? "$" + marketPulse.sol.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—", c: "text-white" },
                { k: "Gainers", v: String(marketPulse.gainers), c: "text-white" },
                { k: "Losers", v: String(marketPulse.losers), c: "text-white/55" },
              ]).map((cell) => (
                <div key={cell.k} className="bg-[#0b0d12] px-3 py-2.5">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-white/35">{cell.k}</div>
                  <div className={cn("text-[14px] font-black", cell.c)}>{cell.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="oxs-aside__card x-rise" style={{ animationDelay: "80ms" }}>
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
            <button type="button" onClick={() => setTab("explore")} className="w-full px-4 py-3 text-left text-[14px] font-bold text-[#ffffff] transition hover:bg-white/[0.03]">
              Show more
            </button>
          </div>

          <div className="oxs-aside__card x-rise" style={{ animationDelay: "160ms" }}>
            <div className="px-4 py-3 text-[19px] font-black">Who to follow</div>
            {whoToFollow.slice(0, 3).map((s) => <FollowCard key={s.user_id} s={s} />)}
            <button type="button" onClick={() => setTab("explore")} className="w-full px-4 py-3 text-left text-[14px] font-bold text-[#ffffff] transition hover:bg-white/[0.03]">
              Show more
            </button>
          </div>

          <div className="px-2 text-[11px] leading-relaxed text-white/25">
            OrbitX Social · Beta · Built for the trenches
          </div>
        </aside>
      )}

      {/* ── Mobile liquid-glass dock ── */}
      <nav className="oxs-dock-wrap" aria-label="Social navigation">
        <div className="oxs-dock">
          {CORE_TABS.map((id) => {
            const n = NAV.find((x) => x.id === id)!;
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  if (tab === id) feedScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                  else setTab(id);
                }}
                className="oxs-dock__item"
                aria-current={on ? "page" : undefined}
              >
                <span className={cn("oxs-dock__icon", on && "oxs-dock__icon--on")}>
                  <n.Icon className="h-[18px] w-[18px]" strokeWidth={on ? 2.4 : 2} />
                </span>
                <span className={cn("oxs-dock__label", on && "oxs-dock__label--on")}>
                  {TAB_SHORT[id] ?? n.label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="oxs-dock__item"
            aria-expanded={moreOpen}
            aria-label="More"
          >
            <span className={cn("oxs-dock__icon", dockOnMore && "oxs-dock__icon--on")}>
              <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={dockOnMore ? 2.4 : 2} />
            </span>
            <span className={cn("oxs-dock__label", dockOnMore && "oxs-dock__label--on")}>More</span>
          </button>
        </div>
      </nav>

      {/* ── More sheet ── */}
      {moreOpen && (
        <div className="oxs-more" onClick={() => setMoreOpen(false)}>
          <div className="oxs-more__backdrop" />
          <div className="oxs-more__panel x-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="oxs-more__title">More</div>
            <div className="oxs-more__grid">
              {MORE_TABS.map((id) => {
                const n = NAV.find((x) => x.id === id)!;
                const on = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setTab(id); setMoreOpen(false); }}
                    className={cn("oxs-more__item", on && "oxs-more__item--on")}
                  >
                    <n.Icon className="h-6 w-6" />
                    <span>{n.label}</span>
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
          className="oxs-compose-fab"
          aria-label="Compose post"
        >
          <Feather className="h-6 w-6" />
        </button>
      )}

      <input ref={composerFileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void uploadComposerImage(e.target.files); e.currentTarget.value = ""; }} />
      {/* ── Post detail / thread ── */}
      {openPostId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[6vh] backdrop-blur-sm" onClick={() => setOpenPostId(null)}>
          <div className="flex max-h-[86vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_24px_64px_rgba(0,0,0,0.8)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <button type="button" onClick={() => setOpenPostId(null)} className="rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"><XIcon className="h-5 w-5" /></button>
              <span className="text-[17px] font-black text-white">Post</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {detailParent && (
                <button type="button" onClick={() => setOpenPostId(detailParent.id)} className="flex w-full items-center gap-1.5 border-b border-white/[0.06] px-4 py-2.5 text-left text-[13px] text-white/45 transition hover:bg-white/[0.03]">
                  <span className="text-white/30">↑</span> Replying to <span className="font-bold text-[#ffffff]">@{detailParent.username || "post"}</span>
                </button>
              )}
              {detailPost ? <PostCard p={detailPost} /> : <div className="px-4 py-8 text-center text-sm text-white/40">Loading…</div>}
              {user && (
                <div className="flex gap-3 border-b border-white/10 px-4 py-3">
                  <img src={myAvatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
                  <div className="flex-1">
                    <textarea value={replyText} onChange={(e) => setReplyText(e.target.value.slice(0, MAX_LEN))} placeholder="Post your reply" rows={2} className="w-full resize-none bg-transparent text-[15px] text-white placeholder:text-white/30 outline-none" />
                    <div className="mt-1 flex justify-end">
                      <button type="button" disabled={!replyText.trim() || replyPosting} onClick={submitReply} className={cn("rounded-full px-4 py-1.5 text-[13px] font-black transition active:scale-95", replyText.trim() && !replyPosting ? "bg-gradient-to-r from-[#ffffff] to-[#f5f5f5] text-black" : "bg-[#ffffff]/40 text-white/50")}>{replyPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reply"}</button>
                    </div>
                  </div>
                </div>
              )}
              {detailLoading ? (
                <div className="px-4 py-6 text-center text-sm text-white/40">Loading replies…</div>
              ) : detailReplies.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-white/40">No replies yet. Be the first.</div>
              ) : detailReplies.map((r) => <PostCard key={r.id} p={r} onOpen={setOpenPostId} />)}
            </div>
          </div>
        </div>
      )}
      {/* ── Compose modal ── */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 p-4 pt-[8vh] backdrop-blur-sm" onClick={() => setComposeOpen(false)}>
          <div className="x-fade-in w-full max-w-[600px] rounded-2xl border border-white/[0.1] bg-gradient-to-b from-[#101214] to-black shadow-[0_24px_64px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.06]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3">
              <button type="button" onClick={() => setComposeOpen(false)} className="rounded-full p-2 text-white/60 transition hover:bg-white/[0.07] hover:text-white">
                <XIcon className="h-5 w-5" />
              </button>
              <span className="text-[13px] font-bold text-[#ffffff]">Drafts save automatically</span>
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
