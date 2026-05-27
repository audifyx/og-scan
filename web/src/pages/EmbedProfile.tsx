/**
 * EmbedProfile — ogscan.fun/embed/profile/:username
 *
 * Embeddable full-profile widget. No auth, no chrome.
 * Designed to be pasted as an <iframe> on any external website.
 *
 * Shows: banner · avatar (live ring if live) · display name · bio
 *        social links · LIVE space card (when live, auto-updates)
 *        last 5 past spaces · OGScan CTA footer
 *
 * Realtime: Supabase channels update live/offline state with no refresh.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Radio, Headphones, Mic, Loader2, Globe, Twitter,
  MessageSquare, Clock, ExternalLink, Play, Users,
  Calendar, ArrowRight, Bell, TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { safeAvatarUrl, cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

/* ─── Types ─────────────────────────────────────────────── */
interface Profile {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  twitter_handle: string | null;
  discord_handle: string | null;
  website_url: string | null;
  page_accent: string | null;
  followers_count: number;
}

interface Space {
  id: string;
  title: string;
  topic: string | null;
  is_live: boolean;
  listener_count: number;
  ended_at: string | null;
  scheduled_for: string | null;
  peak_listeners: number | null;
  duration_seconds: number | null;
}

function Countdown({ target }: { target: string }) {
  const [label, setLabel] = React.useState("");
  React.useEffect(() => {
    const update = () => {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) { setLabel("Starting soon"); return; }
      const h = Math.floor(diff / 3.6e6), m = Math.floor((diff % 3.6e6) / 6e4), s = Math.floor((diff % 6e4) / 1e3);
      setLabel(h > 0 ? `in ${h}h ${m}m` : m > 0 ? `in ${m}m ${s}s` : `in ${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [target]);
  return <span>{label}</span>;
}

/* ─── Accent palette ─────────────────────────────────────── */
const ACCENT: Record<string, {
  gradient: string; ring: string; dot: string; btn: string;
  text: string; badge: string; subtleBg: string;
}> = {
  violet:  { gradient: "from-violet-900/60 via-violet-800/30 to-transparent", ring: "border-violet-500", dot: "bg-violet-400", btn: "bg-violet-600 hover:bg-violet-500", text: "text-violet-400", badge: "bg-violet-500/20 text-violet-300 border-violet-500/40", subtleBg: "bg-violet-500/10" },
  sky:     { gradient: "from-sky-900/60 via-sky-800/30 to-transparent",       ring: "border-sky-500",     dot: "bg-sky-400",     btn: "bg-sky-600 hover:bg-sky-500",     text: "text-sky-400",     badge: "bg-sky-500/20 text-sky-300 border-sky-500/40",     subtleBg: "bg-sky-500/10" },
  emerald: { gradient: "from-emerald-900/60 via-emerald-800/30 to-transparent",ring: "border-emerald-500",dot: "bg-emerald-400",btn: "bg-emerald-600 hover:bg-emerald-500",text: "text-emerald-400",badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",subtleBg:"bg-emerald-500/10" },
  amber:   { gradient: "from-amber-900/60 via-amber-800/30 to-transparent",    ring: "border-amber-500",   dot: "bg-amber-400",   btn: "bg-amber-600 hover:bg-amber-500",   text: "text-amber-400",   badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",   subtleBg: "bg-amber-500/10" },
  rose:    { gradient: "from-rose-900/60 via-rose-800/30 to-transparent",      ring: "border-rose-500",    dot: "bg-rose-400",    btn: "bg-rose-600 hover:bg-rose-500",    text: "text-rose-400",    badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",    subtleBg: "bg-rose-500/10" },
  cyan:    { gradient: "from-cyan-900/60 via-cyan-800/30 to-transparent",      ring: "border-cyan-500",    dot: "bg-cyan-400",    btn: "bg-cyan-600 hover:bg-cyan-500",    text: "text-cyan-400",    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",    subtleBg: "bg-cyan-500/10" },
  pink:    { gradient: "from-pink-900/60 via-pink-800/30 to-transparent",      ring: "border-pink-500",    dot: "bg-pink-400",    btn: "bg-pink-600 hover:bg-pink-500",    text: "text-pink-400",    badge: "bg-pink-500/20 text-pink-300 border-pink-500/40",    subtleBg: "bg-pink-500/10" },
  indigo:  { gradient: "from-indigo-900/60 via-indigo-800/30 to-transparent",  ring: "border-indigo-500",  dot: "bg-indigo-400",  btn: "bg-indigo-600 hover:bg-indigo-500",text: "text-indigo-400",  badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",subtleBg:"bg-indigo-500/10" },
};
const getA = (k: string | null | undefined) => ACCENT[k ?? "violet"] ?? ACCENT.violet;

function LiveDot({ color = "bg-red-400" }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", color)} />
      <span className={cn("relative inline-flex rounded-full h-2 w-2", color)} />
    </span>
  );
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ─── Component ─────────────────────────────────────────── */
export default function EmbedProfile() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [liveSpace, setLiveSpace] = useState<Space | null>(null);
  const [pastSpaces, setPastSpaces] = useState<Space[]>([]);
  const [upcomingSpaces, setUpcomingSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!username) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, banner_url, bio, twitter_handle, discord_handle, website_url, page_accent, followers_count")
      .eq("username", username)
      .single();

    if (!p) { setLoading(false); return; }
    setProfile(p as Profile);

    const { data: live } = await supabase
      .from("spaces")
      .select("id, title, topic, is_live, listener_count, ended_at, scheduled_for, peak_listeners, duration_seconds")
      .eq("host_id", p.user_id)
      .eq("is_live", true)
      .limit(1)
      .maybeSingle();

    setLiveSpace(live as Space || null);

    const { data: past } = await supabase
      .from("spaces")
      .select("id, title, topic, is_live, listener_count, ended_at, scheduled_for, peak_listeners, duration_seconds")
      .eq("host_id", p.user_id)
      .eq("is_live", false)
      .not("ended_at", "is", null)
      .order("ended_at", { ascending: false })
      .limit(5);

    setPastSpaces((past as Space[]) || []);

    const { data: upcom } = await supabase
      .from("spaces")
      .select("id, title, topic, is_live, listener_count, ended_at, scheduled_for, peak_listeners, duration_seconds")
      .eq("host_id", p.user_id)
      .eq("is_live", false)
      .is("ended_at", null)
      .not("scheduled_for", "is", null)
      .gt("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(3);

    setUpcomingSpaces((upcom as Space[]) || []);
    setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);

  /* Realtime space updates */
  useEffect(() => {
    if (!profile) return;
    const ch = supabase
      .channel(`embed-profile-${profile.user_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spaces", filter: `host_id=eq.${profile.user_id}` }, async payload => {
        const sp = payload.new as Space;
        if (sp.is_live) {
          setLiveSpace(sp);
        } else {
          setLiveSpace(null);
          setPastSpaces(prev => [sp, ...prev.filter(s => s.id !== sp.id)].slice(0, 5));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.user_id]);

  /* Realtime listener count */
  useEffect(() => {
    if (!liveSpace) return;
    const ch = supabase
      .channel(`embed-profile-lc-${liveSpace.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "spaces", filter: `id=eq.${liveSpace.id}` }, p => {
        setLiveSpace(prev => prev ? { ...prev, listener_count: (p.new as Space).listener_count } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [liveSpace?.id]);

  const a = getA(profile?.page_accent);
  const displayName = profile?.display_name || profile?.username || username || "Host";
  const profileUrl = `https://ogscan.fun/u/${username}`;
  const joinUrl = liveSpace ? `https://ogscan.fun/space/${liveSpace.id}` : profileUrl;

  if (loading) {
    return (
      <div className="w-full min-h-[420px] bg-[#07090f] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="w-full min-h-[420px] bg-[#07090f] flex items-center justify-center p-6">
        <div className="text-center">
          <Radio className="h-8 w-8 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">@{username} not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#07090f] font-sans text-white overflow-hidden select-none" style={{ fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07090f; overflow-x: hidden; }
        a { text-decoration: none; color: inherit; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 2px; }
        @keyframes pulse-ring { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.5; transform:scale(1.05); } }
        @keyframes ping { 75%,100% { transform:scale(2); opacity:0; } }
        .animate-ping { animation: ping 1s cubic-bezier(0,0,.2,1) infinite; }
        .live-ring { animation: pulse-ring 2s ease-in-out infinite; }
      `}</style>

      {/* ── Banner ───────────────────────────────────────── */}
      <div className="relative h-28 overflow-hidden">
        {profile.banner_url ? (
          <img src={profile.banner_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={cn("w-full h-full bg-gradient-to-br", a.gradient, "bg-[#0d1021]")} />
        )}
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#07090f] via-[#07090f]/20 to-transparent" />

        {/* LIVE badge — only shows when live */}
        {liveSpace && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500/90 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-lg">
            <LiveDot color="bg-white" />
            LIVE
          </div>
        )}
      </div>

      {/* ── Avatar + Identity ────────────────────────────── */}
      <div className="px-4 pb-3">
        {/* Avatar — overlaps banner */}
        <div className="relative -mt-10 mb-3 flex items-end justify-between">
          <div className="relative">
            <div className={cn("h-16 w-16 rounded-full overflow-hidden border-3 border-[#07090f]", liveSpace ? "live-ring" : "")}>
              <img
                src={safeAvatarUrl(profile.avatar_url)}
                alt={displayName}
                className="w-full h-full object-cover"
                onError={e => {
                  (e.target as HTMLImageElement).src =
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=111827&color=888&size=64`;
                }}
              />
            </div>
            {liveSpace && (
              <div className={cn("absolute -inset-1 rounded-full border-2 live-ring", a.ring)} />
            )}
          </div>

          {/* Follower count */}
          <div className="flex items-center gap-1 text-white/30 text-xs">
            <Users className="h-3 w-3" />
            <span>{profile.followers_count ?? 0} followers</span>
          </div>
        </div>

        {/* Name + handle */}
        <div className="mb-2">
          <h1 className="text-base font-bold text-white leading-tight">{displayName}</h1>
          <p className="text-xs text-white/35 mt-0.5">@{profile.username}</p>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-xs text-white/55 leading-relaxed mb-3 line-clamp-3">{profile.bio}</p>
        )}

        {/* Social links */}
        {(profile.twitter_handle || profile.discord_handle || profile.website_url) && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {profile.twitter_handle && (
              <a href={`https://x.com/${profile.twitter_handle}`} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-1 text-[11px] transition-colors", a.text)}>
                <Twitter className="h-3 w-3" />
                @{profile.twitter_handle}
              </a>
            )}
            {profile.discord_handle && (
              <span className="flex items-center gap-1 text-[11px] text-white/35">
                <MessageSquare className="h-3 w-3" />
                {profile.discord_handle}
              </span>
            )}
            {profile.website_url && (
              <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/60 transition-colors">
                <Globe className="h-3 w-3" />
                {profile.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
          </div>
        )}

        {/* ── LIVE Space Card ──────────────────────────── */}
        {liveSpace && (
          <a href={joinUrl} target="_blank" rel="noopener noreferrer">
            <div className={cn("rounded-xl border p-3.5 mb-4 cursor-pointer transition-all hover:opacity-90", a.badge, "border-current/20")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <LiveDot color={a.dot} />
                    <span className={cn("text-[10px] font-black uppercase tracking-widest", a.text)}>Live Now</span>
                  </div>
                  <p className="text-sm font-bold text-white line-clamp-2 leading-snug">{liveSpace.title}</p>
                  {liveSpace.topic && (
                    <p className={cn("text-[11px] mt-1", a.text)}>{liveSpace.topic}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-white/40">
                    <Headphones className="h-2.5 w-2.5" />
                    <span>{liveSpace.listener_count} listening</span>
                  </div>
                </div>
                <div className={cn("flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5", a.btn, "text-white")}>
                  <Play className="h-3 w-3 fill-current" />
                  Join
                </div>
              </div>
            </div>
          </a>
        )}

        {/* ── Past Spaces ──────────────────────────────── */}
        {pastSpaces.length > 0 && (
          {/* ── Upcoming spaces ── */}
          {upcomingSpaces.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Bell className="h-3 w-3 text-white/25" />
                <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">Upcoming Spaces</p>
              </div>
              <div className="space-y-2">
                {upcomingSpaces.map(sp => (
                  <a
                    key={sp.id}
                    href={`https://ogscan.fun/u/${username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2.5 rounded-lg bg-violet-500/[0.06] border border-violet-500/20 hover:bg-violet-500/[0.1] transition-all"
                  >
                    <p className="text-xs font-medium text-white/75 line-clamp-1">{sp.title}</p>
                    {sp.topic && <p className="text-[10px] text-violet-400/70 mt-0.5">{sp.topic}</p>}
                    {sp.scheduled_for && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-white/30">
                        <Calendar className="h-2.5 w-2.5" />
                        <span className="text-violet-400 font-semibold"><Countdown target={sp.scheduled_for} /></span>
                        <span>·</span>
                        <span>{format(new Date(sp.scheduled_for), "MMM d, h:mm a")}</span>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Clock className="h-3 w-3 text-white/25" />
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">Past Spaces</p>
            </div>
            <div className="space-y-2">
              {pastSpaces.map(sp => (
                <a
                  key={sp.id}
                  href={`https://ogscan.fun/listen/${sp.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/70 group-hover:text-white/90 transition-colors line-clamp-1">{sp.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-white/25">
                      {sp.ended_at && (
                        <span>{formatDistanceToNow(new Date(sp.ended_at), { addSuffix: true })}</span>
                      )}
                      {sp.listener_count > 0 && (
                        <>
                          <span>·</span>
                          <span>{sp.peak_listeners ?? sp.listener_count} peak</span>
                        </>
                      )}
                      {sp.duration_seconds && (
                        <>
                          <span>·</span>
                          <span>{formatDuration(sp.duration_seconds)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Play className="h-3 w-3 text-white/20 group-hover:text-white/50 flex-shrink-0 mt-0.5 transition-colors" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── No content state ─────────────────────────── */}
        {!liveSpace && pastSpaces.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 mb-4">
            <Mic className="h-8 w-8 text-white/8" />
            <p className="text-[11px] text-white/20 text-center">No spaces hosted yet</p>
          </div>
        )}
      </div>

      {/* ── Footer CTA ───────────────────────────────────── */}
      <div className="px-4 pb-4 pt-2 border-t border-white/[0.06]">
        <a href={profileUrl} target="_blank" rel="noopener noreferrer">
          <div className={cn(
            "flex items-center justify-between px-4 py-2.5 rounded-xl border border-white/[0.08]",
            "bg-white/[0.03] hover:bg-white/[0.07] transition-all cursor-pointer group"
          )}>
            <div className="flex items-center gap-2">
              <Radio className={cn("h-3.5 w-3.5", a.text)} />
              <span className="text-xs text-white/40 group-hover:text-white/70 transition-colors">
                Follow @{profile.username} on OGScan
              </span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 transition-all group-hover:translate-x-0.5" />
          </div>
        </a>

        {/* OGScan branding */}
        <div className="flex items-center justify-center gap-1 mt-3">
          <Radio className="h-2 w-2 text-violet-400/40" />
          <span className="text-[9px] text-white/15 tracking-wider">Powered by ogscan.fun</span>
        </div>
      </div>
    </div>
  );
}
