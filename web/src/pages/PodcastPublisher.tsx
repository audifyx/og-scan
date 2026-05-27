/**
 * PodcastPublisher — ogscan.fun/podcasts
 *
 * RSS feed auto-submission to Spotify Podcasts and Apple Podcasts
 * from Space Shows. Hosts can:
 *  - Generate a podcast-standard RSS feed for any Show
 *  - Preview the feed XML
 *  - Copy the RSS feed URL
 *  - Submit directly to Spotify via their RSS import tool
 *  - Submit directly to Apple Podcasts Connect
 *  - See submission status per platform
 *  - Manage podcast metadata (artwork, description, categories)
 */

import React, { useState, useEffect } from "react";
import {
  Mic, Rss, ExternalLink, Copy, Check, Loader2, AlertCircle,
  Music, Apple, Globe, ChevronRight, Play, Hash, Star,
  Upload, Eye, RefreshCw, X as XIcon, Plus, CheckCircle2,
  Clock, BookOpen, Radio,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Show {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  host_username: string | null;
  category: string | null;
  episode_count: number;
}

interface PlatformStatus {
  platform: "spotify" | "apple";
  status: "not_submitted" | "pending" | "approved" | "rejected";
  submitted_at?: string;
  podcast_url?: string;
}

const PODCAST_CATEGORIES = [
  "Business", "Technology", "Health & Fitness", "Finance", "Education",
  "Society & Culture", "News", "Sports", "Music", "Comedy", "Science",
  "Arts", "Government", "History", "Cryptocurrency",
];

// ─────────────────────────────────────────────────────────────────────────────
// RSS Feed Generator
// ─────────────────────────────────────────────────────────────────────────────

function generateRSSXML(show: Show, episodes: any[]): string {
  const now = new Date().toUTCString();
  const episodeItems = episodes
    .map(
      (ep: any) => `    <item>
      <title><![CDATA[${ep.title ?? "Episode"}]]></title>
      <description><![CDATA[${ep.description ?? ""}]]></description>
      <pubDate>${new Date(ep.created_at).toUTCString()}</pubDate>
      <guid>https://ogscan.fun/episode/${ep.id}</guid>
      <link>https://ogscan.fun/episode/${ep.id}</link>
      ${ep.recording_url ? `<enclosure url="${ep.recording_url}" length="0" type="audio/mpeg"/>` : ""}
      <itunes:duration>${Math.floor((ep.duration_seconds ?? 0) / 60)}:${String((ep.duration_seconds ?? 0) % 60).padStart(2, "0")}</itunes:duration>
      <itunes:episode>${ep.episode_number ?? 1}</itunes:episode>
      <itunes:episodeType>full</itunes:episodeType>
    </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${show.title}]]></title>
    <link>https://ogscan.fun/shows/${show.id}</link>
    <description><![CDATA[${show.description ?? ""}]]></description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="https://ogscan.fun/feed/shows/${show.id}.xml" rel="self" type="application/rss+xml"/>
    ${show.cover_url ? `<image>
      <url>${show.cover_url}</url>
      <title><![CDATA[${show.title}]]></title>
      <link>https://ogscan.fun/shows/${show.id}</link>
    </image>` : ""}
    <itunes:author><![CDATA[${show.host_username ?? "OGScan Host"}]]></itunes:author>
    <itunes:summary><![CDATA[${show.description ?? ""}]]></itunes:summary>
    <itunes:category text="${show.category ?? "Technology"}"/>
    <itunes:explicit>no</itunes:explicit>
    ${show.cover_url ? `<itunes:image href="${show.cover_url}"/>` : ""}
    <itunes:type>episodic</itunes:type>
${episodeItems}
  </channel>
</rss>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform Submission Card
// ─────────────────────────────────────────────────────────────────────────────

function PlatformCard({
  platform,
  status,
  rssUrl,
  onSubmit,
}: {
  platform: "spotify" | "apple";
  status: PlatformStatus;
  rssUrl: string;
  onSubmit: () => void;
}) {
  const isSpotify = platform === "spotify";
  const icon = isSpotify ? Music : Apple;
  const Icon = icon;
  const name = isSpotify ? "Spotify Podcasts" : "Apple Podcasts";
  const color = isSpotify ? "text-green-400" : "text-white";
  const bg = isSpotify ? "bg-green-500/10 border-green-500/20" : "bg-white/[0.04] border-white/10";
  const btnBg = isSpotify ? "bg-green-600 hover:bg-green-500" : "bg-white/20 hover:bg-white/30";
  const submitUrl = isSpotify
    ? `https://podcasters.spotify.com/pod/show/s/import?rss=${encodeURIComponent(rssUrl)}`
    : `https://podcastsconnect.apple.com/my-podcasts/new-feed?submitfeed=${encodeURIComponent(rssUrl)}`;

  const statusConfig = {
    not_submitted: { label: "Not Submitted", color: "text-white/35", bg: "bg-white/[0.06]" },
    pending: { label: "Pending Review", color: "text-amber-300", bg: "bg-amber-500/10" },
    approved: { label: "Live ✓", color: "text-emerald-300", bg: "bg-emerald-500/10" },
    rejected: { label: "Rejected", color: "text-red-300", bg: "bg-red-500/10" },
  }[status.status];

  return (
    <div className={cn("rounded-2xl border p-5", bg)}>
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", bg)}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>
        <div>
          <p className="text-sm font-bold text-white">{name}</p>
          <span className={cn("text-[10px] font-bold rounded-full px-2 py-0.5", statusConfig.bg, statusConfig.color)}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {status.status === "approved" && status.podcast_url ? (
        <a
          href={status.podcast_url}
          target="_blank"
          rel="noreferrer"
          className="mb-3 flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition"
        >
          <ExternalLink className="h-3 w-3" />
          View on {name}
        </a>
      ) : null}

      <p className="text-xs text-white/40 mb-4 leading-relaxed">
        {isSpotify
          ? "Submit your RSS feed to Spotify for Podcasters. Approval typically takes 3–5 days."
          : "Submit via Apple Podcasts Connect. Approval takes 1–5 business days."}
      </p>

      <button
        onClick={() => {
          window.open(submitUrl, "_blank");
          onSubmit();
        }}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-white transition",
          btnBg
        )}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {status.status === "not_submitted" ? `Submit to ${isSpotify ? "Spotify" : "Apple"}` : "Re-submit / Update"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function PodcastPublisher() {
  const { user } = useAuth();
  const [shows, setShows] = useState<Show[]>([]);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<PlatformStatus[]>([
    { platform: "spotify", status: "not_submitted" },
    { platform: "apple", status: "not_submitted" },
  ]);
  const [loading, setLoading] = useState(true);
  const [showXML, setShowXML] = useState(false);
  const [copiedFeed, setCopiedFeed] = useState(false);
  const [tab, setTab] = useState<"shows" | "submit" | "rss">("shows");

  useEffect(() => {
    if (!user) return;
    loadShows();
  }, [user]);

  useEffect(() => {
    if (!selectedShow) return;
    loadEpisodes(selectedShow.id);
    loadStatuses(selectedShow.id);
  }, [selectedShow]);

  async function loadShows() {
    setLoading(true);
    if (!user) return;
    const { data } = await supabase
      .from("shows")
      .select("id, title, description, cover_url, host_username, category, episode_count")
      .eq("host_id", user.id)
      .order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setShows(data as Show[]);
      setSelectedShow(data[0] as Show);
    }
    setLoading(false);
  }

  async function loadEpisodes(showId: string) {
    const { data } = await supabase
      .from("show_episodes")
      .select("*")
      .eq("show_id", showId)
      .eq("status", "ended")
      .order("episode_number", { ascending: false });
    if (data) setEpisodes(data);
  }

  async function loadStatuses(showId: string) {
    const { data } = await supabase
      .from("podcast_submissions")
      .select("*")
      .eq("show_id", showId);
    if (data && data.length > 0) {
      const mapped: PlatformStatus[] = ["spotify", "apple"].map((p) => {
        const found = data.find((d: any) => d.platform === p);
        return found
          ? { platform: p as any, status: found.status, submitted_at: found.submitted_at, podcast_url: found.podcast_url }
          : { platform: p as any, status: "not_submitted" };
      });
      setStatuses(mapped);
    }
  }

  async function handleSubmit(platform: "spotify" | "apple") {
    if (!selectedShow || !user) return;
    await supabase.from("podcast_submissions").upsert({
      show_id: selectedShow.id,
      user_id: user.id,
      platform,
      status: "pending",
      submitted_at: new Date().toISOString(),
    });
    setStatuses((prev) =>
      prev.map((s) =>
        s.platform === platform ? { ...s, status: "pending", submitted_at: new Date().toISOString() } : s
      )
    );
    toast.success(`Submitted to ${platform === "spotify" ? "Spotify" : "Apple Podcasts"}!`);
  }

  const rssUrl = selectedShow
    ? `https://ogscan.fun/feed/shows/${selectedShow.id}.xml`
    : "";
  const rssXML = selectedShow ? generateRSSXML(selectedShow, episodes) : "";

  function copyFeed() {
    navigator.clipboard.writeText(rssUrl);
    setCopiedFeed(true);
    setTimeout(() => setCopiedFeed(false), 2000);
    toast.success("RSS URL copied!");
  }

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="border-b border-white/[0.07] bg-[#0a0a14] px-4 py-5">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10">
              <Mic className="h-4.5 w-4.5 text-rose-400" style={{ height: 18, width: 18 }} />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Podcast Publisher</h1>
              <p className="text-xs text-white/40">Auto-publish your Shows to Spotify & Apple Podcasts via RSS</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {[
              { key: "shows", label: "My Shows", icon: Mic },
              { key: "submit", label: "Submit", icon: ExternalLink },
              { key: "rss", label: "RSS Feed", icon: Rss },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key as typeof tab)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  tab === key
                    ? "bg-white/[0.08] text-white"
                    : "text-white/45 hover:bg-white/[0.04] hover:text-white/70"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          </div>
        ) : shows.length === 0 ? (
          <div className="py-20 text-center">
            <Mic className="mx-auto mb-3 h-10 w-10 text-white/10" />
            <p className="text-sm font-bold text-white/50">No shows yet</p>
            <p className="mt-1 text-xs text-white/30">Create a Show first at /shows, then publish it as a podcast.</p>
            <a
              href="/shows"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-rose-600/20 border border-rose-500/30 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-600/30 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Create a Show
            </a>
          </div>
        ) : (
          <>
            {/* ── Shows Tab ── */}
            {tab === "shows" && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shows.map((show) => (
                  <button
                    key={show.id}
                    onClick={() => setSelectedShow(show)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition",
                      selectedShow?.id === show.id
                        ? "border-rose-500/30 bg-rose-500/[0.07]"
                        : "border-white/[0.07] bg-white/[0.03] hover:border-white/15"
                    )}
                  >
                    {show.cover_url ? (
                      <img
                        src={show.cover_url}
                        alt={show.title}
                        className="mb-3 h-16 w-16 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-xl bg-rose-500/20">
                        <Mic className="h-7 w-7 text-rose-400" />
                      </div>
                    )}
                    <p className="text-sm font-bold text-white">{show.title}</p>
                    <p className="text-xs text-white/40 mt-0.5">{show.episode_count} episodes</p>
                    {show.category && (
                      <span className="mt-2 inline-block rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/40">
                        {show.category}
                      </span>
                    )}
                    {selectedShow?.id === show.id && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-rose-400 font-semibold">
                        <CheckCircle2 className="h-3 w-3" />
                        Selected
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* ── Submit Tab ── */}
            {tab === "submit" && selectedShow && (
              <div className="space-y-5">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 flex items-center gap-3 mb-6">
                  {selectedShow.cover_url ? (
                    <img src={selectedShow.cover_url} alt={selectedShow.title} className="h-12 w-12 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/20 shrink-0">
                      <Mic className="h-6 w-6 text-rose-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-white">{selectedShow.title}</p>
                    <p className="text-xs text-white/40">{episodes.length} published episodes</p>
                  </div>
                </div>

                {/* RSS feed URL */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Rss className="h-4 w-4 text-orange-400" />
                    <span className="text-xs font-bold text-white">Your RSS Feed URL</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 rounded-lg bg-white/[0.05] px-3 py-2 font-mono text-[11px] text-white/50 truncate border border-white/[0.07]">
                      {rssUrl}
                    </div>
                    <button
                      onClick={copyFeed}
                      className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-white hover:border-white/20 transition"
                    >
                      {copiedFeed ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Platform cards */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {statuses.map((s) => (
                    <PlatformCard
                      key={s.platform}
                      platform={s.platform}
                      status={s}
                      rssUrl={rssUrl}
                      onSubmit={() => handleSubmit(s.platform)}
                    />
                  ))}
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                    <div className="text-xs text-white/40 leading-relaxed">
                      <strong className="text-white/60">How it works:</strong> Your episodes from
                      this Show are published in a podcast-standard RSS 2.0 feed with iTunes
                      extensions. Both Spotify and Apple Podcasts support RSS import. Once approved,
                      new episodes publish automatically. Episodes need a recording URL (from spaces
                      with recordings enabled) to appear as playable audio.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── RSS Tab ── */}
            {tab === "rss" && selectedShow && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white/70">RSS Feed Preview</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={copyFeed}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/50 hover:text-white hover:border-white/20 transition"
                    >
                      {copiedFeed ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      Copy URL
                    </button>
                    <button
                      onClick={() => setShowXML(!showXML)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/50 hover:text-white hover:border-white/20 transition"
                    >
                      <Eye className="h-3 w-3" />
                      {showXML ? "Hide XML" : "View XML"}
                    </button>
                  </div>
                </div>

                {showXML && (
                  <div className="max-h-96 overflow-auto rounded-xl border border-white/10 bg-[#0a0a14] p-4">
                    <pre className="text-[10px] text-white/60 leading-relaxed whitespace-pre-wrap font-mono">
                      {rssXML}
                    </pre>
                  </div>
                )}

                {/* Episode list */}
                <div className="space-y-2">
                  <p className="text-xs text-white/40 font-semibold mb-3">
                    {episodes.length} episode{episodes.length !== 1 ? "s" : ""} in feed
                  </p>
                  {episodes.length === 0 ? (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-10 text-center">
                      <Play className="mx-auto mb-2 h-6 w-6 text-white/15" />
                      <p className="text-xs text-white/30">No published episodes yet</p>
                      <p className="text-[11px] text-white/20 mt-0.5">
                        Completed spaces in this show will appear here.
                      </p>
                    </div>
                  ) : (
                    episodes.map((ep) => (
                      <div key={ep.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 shrink-0">
                          <span className="text-[10px] font-black text-rose-400">#{ep.episode_number ?? 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{ep.title}</p>
                          <p className="text-[10px] text-white/35">
                            {ep.duration_seconds ? `${Math.floor(ep.duration_seconds / 60)} min` : "No recording"} ·{" "}
                            {ep.listener_count ?? 0} listeners
                          </p>
                        </div>
                        {ep.recording_url ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-400/50 shrink-0" title="No recording URL" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
