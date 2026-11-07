/**
 * OrbitX Social — per-post analytics card.
 *
 * Small card showing a post's views/impressions + engagement, fetched from
 * GET /api/social/analytics/post/:id (counts only — the API never returns
 * viewer identities). Renders nothing while loading fails; shows a compact
 * loading shimmer while fetching.
 */
import React, { useEffect, useState } from "react";
import { BarChart3, Bookmark, Eye, Heart, Loader2, MessageCircle, Quote, Repeat2, Users } from "lucide-react";

export function formatCount(v: number): string {
  if (!Number.isFinite(v)) return "0";
  if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(v));
}

interface DailyBucket {
  day: string;
  views: number;
  viewers: number;
}

interface PostAnalyticsResp {
  ok: boolean;
  post_id: string;
  views: number;
  unique_viewers: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  bookmarks: number;
  daily: DailyBucket[];
  error?: string;
}

function DailyBars({ daily }: { daily: DailyBucket[] }) {
  const days = (daily || []).slice(-14);
  if (!days.length) return null;
  const max = Math.max(1, ...days.map((d) => d.views));
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/40">Views · last 14 days</div>
      <div className="flex h-12 items-end gap-1">
        {days.map((d) => (
          <div
            key={d.day}
            className="flex-1 rounded-t-sm bg-[#e8b84a]/80"
            style={{ height: `${Math.max(8, (d.views / max) * 100)}%` }}
            title={`${d.day}: ${formatCount(d.views)} views · ${formatCount(d.viewers)} viewers`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-white/30">
        <span>{days[0]?.day?.slice(5) || ""}</span>
        <span>{days[days.length - 1]?.day?.slice(5) || ""}</span>
      </div>
    </div>
  );
}

export function PostAnalytics({ postId }: { postId: string }) {
  const [data, setData] = useState<PostAnalyticsResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/social/analytics/post/${encodeURIComponent(postId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d as PostAnalyticsResp | null);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-[13px] text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading post analytics…
        </div>
      </div>
    );
  }
  if (!data?.ok) return null;

  const stats = [
    { icon: Eye, label: "Views", value: data.views },
    { icon: Users, label: "Viewers", value: data.unique_viewers },
    { icon: Heart, label: "Likes", value: data.likes },
    { icon: MessageCircle, label: "Replies", value: data.replies },
    { icon: Repeat2, label: "Reposts", value: data.reposts },
    { icon: Quote, label: "Quotes", value: data.quotes },
    { icon: Bookmark, label: "Saved", value: data.bookmarks },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[#e8b84a]" />
        <span className="text-[13px] font-extrabold text-white">Post analytics</span>
        <span className="ml-auto text-[11px] text-white/30">counts only · no viewer identities</span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-black/40 px-2 py-2 text-center">
            <s.icon className="mx-auto mb-1 h-3.5 w-3.5 text-[#e8b84a]" />
            <div className="text-[15px] font-extrabold leading-none text-white">{formatCount(s.value)}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/40">{s.label}</div>
          </div>
        ))}
      </div>
      <DailyBars daily={data.daily} />
    </div>
  );
}

export default PostAnalytics;
