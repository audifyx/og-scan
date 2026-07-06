import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Heart, MessageCircle, Repeat2, Share, ImageIcon, Sparkles, Radio,
  Users, Search, Loader2, BadgeCheck, TrendingUp, MoreHorizontal, Trash2, Copy, Flag,
  Flame, Star, UserPlus, Check, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

const FEED_CHANNEL = "social-general";
const MAX_LEN = 500;

interface Post {
  id: string; user_id: string; username: string | null; avatar_url: string | null;
  content: string; likes_count: number | null; liked_by: string[] | null; created_at: string;
}
interface Suggestion { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null; is_official_account?: boolean | null; bio?: string | null; }
interface Ticker { mint: string; symbol: string | null; priceUsd: number | null; change24h: number | null; }

const dicebear = (seed: string) => `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(seed || "og")}`;

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (isNaN(s) || s < 0) return "now";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const MINT_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
function renderContent(text: string, onMint?: (m: string) => void) {
  const parts: (string | JSX.Element)[] = [];
  const tokenRe = /(\$[A-Za-z][A-Za-z0-9]{1,14}|@[A-Za-z0-9_]{2,20}|https?:\/\/[^\s]+|[1-9A-HJ-NP-Za-km-z]{32,44})/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("$") || tok.startsWith("@")) parts.push(<span key={i++} className="font-semibold text-primary">{tok}</span>);
    else if (tok.startsWith("http")) parts.push(<a key={i++} href={tok} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">{tok}</a>);
    else if (MINT_RE.test(tok)) parts.push(<button key={i++} type="button" onClick={() => onMint?.(tok)} className="font-mono text-[12px] text-secondary hover:underline">{tok.slice(0, 4)}…{tok.slice(-4)}</button>);
    else parts.push(tok);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

type Tab = "foryou" | "top" | "following";

export default function SocialHome({ onSwitchTab, onSelectMint }: { onSwitchTab?: (t: string) => void; onSelectMint?: (m: string) => void; }) {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("foryou");
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ticker, setTicker] = useState<Ticker[]>([]);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const displayName = profile?.display_name || profile?.username || "You";

  /* ── Feed ── */
  const load = useCallback(async () => {
    const { data } = await supabase
      .from("social_messages")
      .select("id,user_id,username,avatar_url,content,likes_count,liked_by,created_at")
      .eq("channel", FEED_CHANNEL).order("created_at", { ascending: false }).limit(80);
    if (data) setPosts(data as Post[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!menuId) return; const h = () => setMenuId(null); document.addEventListener("click", h); return () => document.removeEventListener("click", h); }, [menuId]);

  useEffect(() => {
    const ch = supabase.channel("home-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_messages", filter: `channel=eq.${FEED_CHANNEL}` },
        (p) => { const row = p.new as Post; setPosts((prev) => prev.some((x) => x.id === row.id) ? prev : [row, ...prev]); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "social_messages", filter: `channel=eq.${FEED_CHANNEL}` },
        (p) => { const row = p.new as Post; setPosts((prev) => prev.map((x) => x.id === row.id ? { ...x, likes_count: row.likes_count, liked_by: row.liked_by, content: row.content } : x)); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  /* ── Following + who-to-follow ── */
  useEffect(() => {
    if (!user) return;
    supabase.from("followers").select("followee_id").eq("follower_id", user.id)
      .then(({ data }) => { if (data) setFollowingSet(new Set(data.map((r: any) => r.followee_id))); });
  }, [user]);

  useEffect(() => {
    supabase.from("profiles").select("user_id,username,display_name,avatar_url,is_official_account,bio")
      .not("username", "is", null).order("is_official_account", { ascending: false }).order("created_at", { ascending: false }).limit(24)
      .then(({ data }) => { if (data) setSuggestions(data as Suggestion[]); });
  }, []);

  /* ── Live market ticker (cross-app) ── */
  useEffect(() => {
    let on = true;
    const fetchTicker = () => fetch("/api/ogdex/screener?type=trending&interval=24h&limit=16")
      .then((r) => r.json()).then((d) => { if (on && d?.rows) setTicker(d.rows.filter((x: any) => x.symbol).slice(0, 16)); }).catch(() => {});
    fetchTicker();
    const id = setInterval(fetchTicker, 30000);
    return () => { on = false; clearInterval(id); };
  }, []);

  const follow = async (uid: string) => {
    if (!user) { toast.error("Sign in to follow"); return; }
    setFollowingSet((prev) => new Set(prev).add(uid));
    const { error } = await supabase.from("followers").insert({ follower_id: user.id, followee_id: uid });
    if (error) setFollowingSet((prev) => { const n = new Set(prev); n.delete(uid); return n; });
  };

  const submit = async () => {
    const content = text.trim();
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

  const deletePost = async (p: Post) => {
    if (!user || p.user_id !== user.id) return;
    setMenuId(null);
    setPosts((prev) => prev.filter((x) => x.id !== p.id));
    if (!p.id.startsWith("tmp-")) { const { error } = await supabase.from("social_messages").delete().eq("id", p.id).eq("user_id", user.id); if (error) toast.error("Could not delete post"); }
  };
  const copyLink = async (_p: Post) => { setMenuId(null); try { await navigator.clipboard.writeText(`${window.location.origin}/social`); toast.success("Link copied"); } catch { toast.error("Copy failed"); } };
  const reportPost = (_p: Post) => { setMenuId(null); toast.success("Thanks — this post has been reported."); };
  const replyTo = (p: Post) => { setText((t) => t.startsWith(`@${p.username} `) ? t : `@${p.username || "anon"} ${t}`); composerRef.current?.focus(); };
  const share = async (p: Post) => { try { await navigator.clipboard.writeText(`${p.content}\n\n${window.location.origin}/social`); toast.success("Copied to clipboard"); } catch { toast.error("Copy failed"); } };

  /* ── Derived feed by tab ── */
  const shown = useMemo(() => {
    if (tab === "top") return [...posts].sort((a, b) => (b.likes_count ?? 0) - (a.likes_count ?? 0));
    if (tab === "following") return posts.filter((p) => followingSet.has(p.user_id) || (user && p.user_id === user.id));
    return posts;
  }, [posts, tab, followingSet, user]);

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) for (const t of (p.content.match(/\$[A-Za-z][A-Za-z0-9]{1,14}/g) || [])) counts.set(t.toUpperCase(), (counts.get(t.toUpperCase()) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [posts]);

  const suggested = suggestions.filter((s) => s.user_id !== user?.id && !followingSet.has(s.user_id)).slice(0, 4);

  const TABS: { id: Tab; label: string }[] = [{ id: "foryou", label: "For You" }, { id: "top", label: "Top" }, { id: "following", label: "Following" }];

  return (
    <div className="relative grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <style>{`
        @keyframes shFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .sh-fade { animation: shFadeIn .3s ease both; }
      `}</style>
      {/* ── Timeline ── */}
      <div className="min-w-0">
        {/* Market ticker */}
        {ticker.length > 0 && (
          <div className="mb-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.015] shadow-[0_8px_24px_-16px_rgba(0,0,0,0.7)]">
            <div className="flex items-center gap-2 px-3.5 pt-2.5 text-[10px] font-bold uppercase tracking-widest text-white/35">
              <Flame className="h-3 w-3 text-primary" /> Trending now
              <span className="ml-auto inline-flex items-center gap-1 text-[9.5px] normal-case tracking-normal text-emerald-300/70"><span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" /> live</span>
            </div>
            <div className="flex gap-2 overflow-x-auto px-3 py-2.5 scrollbar-none">
              {ticker.map((t) => {
                const up = (t.change24h ?? 0) >= 0;
                return (
                  <button
                    key={t.mint}
                    onClick={() => { onSelectMint?.(t.mint); onSwitchTab?.("scanner"); }}
                    className="group flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/[0.06] hover:shadow-[0_6px_18px_-8px_rgba(47,128,255,0.4)]"
                  >
                    <span className="text-[12px] font-black text-white">${t.symbol}</span>
                    {t.priceUsd != null && (
                      <span className="text-[10.5px] font-medium text-white/40">
                        ${t.priceUsd < 0.01 ? t.priceUsd.toExponential(1) : t.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </span>
                    )}
                    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-bold", up ? "text-emerald-400" : "text-rose-400")}>
                      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(t.change24h ?? 0).toFixed(0)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Header + tabs */}
        <div className="sticky top-0 z-10 -mx-1 mb-3 bg-background/85 px-1 pt-2 backdrop-blur-md">
          <div className="mb-2 flex items-end justify-between gap-2">
            <div>
              <h1 className="bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-[22px] font-black tracking-tight text-transparent">Home</h1>
              <p className="text-[11.5px] text-white/35">Welcome back, {displayName} — here's what's moving.</p>
            </div>
            <span className="mb-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-[10.5px] font-bold text-emerald-300/90">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> {posts.length} live post{posts.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex gap-1 border-b border-white/[0.06]">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn("relative px-4 py-2.5 text-[13px] font-bold transition", tab === t.id ? "text-white" : "text-white/40 hover:text-white/70")}>
                {t.label}
                {tab === t.id && <span className="absolute bottom-0 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-[#9945FF] shadow-[0_0_10px_rgba(47,128,255,0.6)]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Composer */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-3.5 shadow-[0_8px_28px_-16px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-all duration-200 focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_rgba(47,128,255,0.1)]">
          <div className="flex gap-3">
            <img src={profile?.avatar_url || dicebear(displayName)} alt="" className="h-10 w-10 shrink-0 rounded-full border border-white/10 object-cover" />
            <div className="min-w-0 flex-1">
              <textarea ref={composerRef} value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }} placeholder="What's happening on-chain?" rows={2} disabled={!user}
                className="w-full resize-none bg-transparent text-[15px] text-white placeholder:text-white/30 outline-none" />
              <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2.5">
                <div className="flex items-center gap-1 text-primary/70"><ImageIcon className="h-4 w-4" /><Sparkles className="h-4 w-4" /></div>
                <div className="flex items-center gap-2.5">
                  <span className={cn("text-[11px] font-mono", text.length > MAX_LEN - 40 ? "text-og-gold" : "text-white/30")}>{text.length}/{MAX_LEN}</span>
                  <button type="button" onClick={submit} disabled={!text.trim() || posting || !user} className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-black text-primary-foreground transition hover:brightness-110 active:scale-95 disabled:opacity-40">
                    {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                  </button>
                </div>
              </div>
              {!user && <p className="mt-1 text-[11px] text-white/35">Sign in to join the conversation.</p>}
            </div>
          </div>
        </div>

        {/* Feed */}
        <div className="mt-3 space-y-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.01] shadow-[0_12px_40px_-24px_rgba(0,0,0,0.8)]">
          {loading ? (
            <div className="grid place-items-center py-20 text-white/30"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : shown.length === 0 ? (
            <div className="py-20 text-center">
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-white/20" />
              <p className="text-sm font-semibold text-white/60">{tab === "following" ? "No posts from people you follow yet" : "No posts yet"}</p>
              <p className="mt-1 text-[12px] text-white/30">{tab === "following" ? "Follow people to fill this feed." : "Be the first to share something."}</p>
            </div>
          ) : shown.map((p) => {
            const liked = !!(user && (p.liked_by || []).includes(user.id));
            return (
              <article key={p.id} className="sh-fade flex gap-3 border-b border-white/[0.05] bg-white/[0.015] px-4 py-3.5 transition last:border-0 hover:bg-white/[0.035]">
                <img src={p.avatar_url || dicebear(p.username || p.user_id)} alt="" className="h-10 w-10 shrink-0 rounded-full border border-white/10 object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = dicebear(p.username || "og"); }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13px]">
                    <span className="truncate font-bold text-white">{p.username || "Anon"}</span>
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate text-white/35">@{(p.username || "anon").toLowerCase()}</span>
                    <span className="text-white/25">·</span>
                    <span className="shrink-0 text-white/35">{timeAgo(p.created_at)}</span>
                    <div className="relative ml-auto" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => setMenuId(menuId === p.id ? null : p.id)} className="rounded-full p-1 text-white/25 transition hover:bg-white/[0.06] hover:text-white/70"><MoreHorizontal className="h-4 w-4" /></button>
                      {menuId === p.id && (
                        <div className="absolute right-0 top-7 z-20 min-w-[150px] overflow-hidden rounded-xl border border-white/10 bg-[#0d1320] py-1 shadow-2xl">
                          <button type="button" onClick={() => copyLink(p)} className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-white/70 transition hover:bg-white/[0.05] hover:text-white"><Copy className="h-3.5 w-3.5" /> Copy link</button>
                          {user && p.user_id === user.id ? (
                            <button type="button" onClick={() => deletePost(p)} className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-rose-400/80 transition hover:bg-rose-500/10 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                          ) : (
                            <button type="button" onClick={() => reportPost(p)} className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-white/70 transition hover:bg-white/[0.05] hover:text-white"><Flag className="h-3.5 w-3.5" /> Report</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-white/90">{renderContent(p.content, (m) => { onSelectMint?.(m); onSwitchTab?.("scanner"); })}</p>
                  <div className="mt-2 flex max-w-md items-center justify-between text-white/40">
                    <button type="button" onClick={() => replyTo(p)} className="group flex items-center gap-1.5 text-[12px] transition hover:text-primary"><MessageCircle className="h-4 w-4" /></button>
                    <button type="button" className="group flex items-center gap-1.5 text-[12px] transition hover:text-og-lime"><Repeat2 className="h-4 w-4" /></button>
                    <button type="button" onClick={() => toggleLike(p)} className={cn("group flex items-center gap-1.5 text-[12px] transition hover:text-rose-400", liked && "text-rose-500")}>
                      <Heart className={cn("h-4 w-4", liked && "fill-current")} />{(p.likes_count ?? 0) > 0 && <span className="font-semibold">{p.likes_count}</span>}
                    </button>
                    <button type="button" onClick={() => share(p)} className="group flex items-center gap-1.5 text-[12px] transition hover:text-secondary"><Share className="h-4 w-4" /></button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* ── Right rail ── */}
      <aside className="hidden space-y-4 lg:block">
        {/* Who to follow */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-4 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.7)]">
          <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-black text-white"><Users className="h-4 w-4 text-primary" /> Who to follow</h3>
          {suggested.length === 0 ? (
            <p className="text-[12px] text-white/35">You're following everyone we'd suggest. 🎉</p>
          ) : (
            <div className="space-y-3">
              {suggested.map((s) => (
                <div key={s.user_id} className="flex items-center gap-2.5">
                  <img src={s.avatar_url || dicebear(s.username || s.user_id)} alt="" className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-[13px] font-bold text-white truncate">{s.display_name || s.username}{s.is_official_account && <BadgeCheck className="h-3 w-3 shrink-0 text-primary" />}</div>
                    <div className="truncate text-[11px] text-white/35">@{(s.username || "anon").toLowerCase()}</div>
                  </div>
                  <button onClick={() => follow(s.user_id)} className="shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-black text-black transition hover:bg-white/90">Follow</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trending cashtags */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-4 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.7)]">
          <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-black text-white"><TrendingUp className="h-4 w-4 text-primary" /> Trending cashtags</h3>
          {trendingTags.length === 0 ? <p className="text-[12px] text-white/35">Cashtags people mention will trend here.</p> : (
            <div className="space-y-2.5">
              {trendingTags.map(([tag, n], i) => (
                <button key={tag} type="button" onClick={() => onSwitchTab?.("feed")} className="flex w-full items-center justify-between text-left">
                  <div><div className="text-[10px] text-white/30">#{i + 1} · Trending</div><div className="text-[14px] font-bold text-primary">{tag}</div></div>
                  <div className="text-[11px] text-white/35">{n} post{n > 1 ? "s" : ""}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Jump in */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-4 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.7)]">
          <h3 className="mb-3 text-[13px] font-black text-white">Jump in</h3>
          <div className="space-y-1.5">
            {[
              { label: "Spaces", desc: "Live voice rooms", Icon: Radio, t: "community" },
              { label: "Communities", desc: "Token groups", Icon: Users, t: "communities" },
              { label: "Discover", desc: "Find people", Icon: Sparkles, t: "discover" },
              { label: "Scanner", desc: "Check a token", Icon: Search, t: "scanner" },
            ].map((l) => (
              <button key={l.label} type="button" onClick={() => onSwitchTab?.(l.t)} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-white/[0.12] hover:bg-white/[0.05]">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><l.Icon className="h-4 w-4" /></span>
                <span className="min-w-0"><span className="block text-[13px] font-bold text-white">{l.label}</span><span className="block text-[11px] text-white/35">{l.desc}</span></span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
