/**
 * OrbitX Social — profile analytics summary card.
 *
 * Fetches GET /api/social/analytics/profile/:userId (accepts a uuid or a
 * username) and renders total views, reach (unique viewers), engagement,
 * follower counts, a 14-day daily bar chart and the top 10 posts by views.
 * Counts only — the API never returns viewer identities.
 */
import React, { useEffect, useState } from "react";
import { BarChart3, Eye, Heart, Loader2, MessageCircle, Quote, Repeat2, TrendingUp, UserPlus, Users } from "lucide-react";
import { formatCount } from "./PostAnalytics";

interface DailyBucket {
  day: string;
  views: number;
  viewers: number;
}

interface TopPost {
  id: string;
  content: string;
  created_at: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
}

interface ProfileAnalyticsResp {
  ok: boolean;
  user_id: string;
  post_count: number;
  total_views: number;
  reach: number;
  total_likes: number;
  total_replies: number;
  total_reposts: number;
  total_quotes: number;
  total_bookmarks: number;
  followers: number;
  following: number;
  engagement: number;
  daily: DailyBucket[];
  top_posts: TopPost[];
  error?: string;
}

export function ProfileAnalyticsCard({ userId }: { userId: string }) {
  const [data, setData] = useState<ProfileAnalyticsResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/social/analytics/profile/${encodeURIComponent(userId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d as ProfileAnalyticsResp | null);
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
  }, [userId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-[13px] text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading profile analytics…
        </div>
      </div>
    );
  }
  if (!data?.ok) return null;

  const days = (data.daily || []).slice(-14);
  const maxDay = Math.max(1, ...days.map((d) => d.views));
  const totals = [
    { icon: Eye, label: "Total views", value: data.total_views },
    { icon: Users, label: "Reach", value: data.reach },
    { icon: TrendingUp, label: "Engagement", value: data.engagement },
    { icon: Heart, label: "Likes", value: data.total_likes },
    { icon: UserPlus, label: "Followers", value: data.followers },
    { icon: MessageCircle, label: "Replies", value: data.total_replies },
    { icon: Repeat2, label: "Reposts", value: data.total_reposts },
    { icon: Quote, label: "Quotes", value: data.total_quotes },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[#e8b84a]" />
        <span className="text-[13px] font-extrabold text-white">Profile analytics</span>
        <span className="ml-auto text-[11px] text-white/30">
          {formatCount(data.post_count)} posts · counts only
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {totals.map((t) => (
          <div key={t.label} className="rounded-xl bg-black/40 px-2 py-2 text-center">
            <t.icon className="mx-auto mb-1 h-3.5 w-3.5 text-[#e8b84a]" />
            <div className="text-[15px] font-extrabold leading-none text-white">{formatCount(t.value)}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/40">{t.label}</div>
          </div>
        ))}
      </div>

      {days.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/40">Views · last 14 days</div>
          <div className="flex h-14 items-end gap-1">
            {days.map((d) => (
              <div
                key={d.day}
                className="flex-1 rounded-t-sm bg-[#e8b84a]/80"
                style={{ height: `${Math.max(8, (d.views / maxDay) * 100)}%` }}
                title={`${d.day}: ${formatCount(d.views)} views · ${formatCount(d.viewers)} viewers`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-white/30">
            <span>{days[0]?.day?.slice(5) || ""}</span>
            <span>{days[days.length - 1]?.day?.slice(5) || ""}</span>
          </div>
        </div>
      )}

      {(data.top_posts || []).length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">Top posts by views</div>
          <ul className="space-y-2">
            {data.top_posts.slice(0, 10).map((p, i) => (
              <li key={p.id} className="flex items-start gap-2 rounded-xl bg-black/40 px-3 py-2">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#e8b84a]/15 text-[11px] font-extrabold text-[#e8b84a]">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-white/90">{p.content || "(no text)"}</span>
                  <span className="mt-0.5 block text-[11px] text-white/40">
                    {formatCount(p.views)} views · {formatCount(p.likes)} likes · {formatCount(p.replies)} replies ·{" "}
                    {formatCount(p.reposts)} reposts
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ProfileAnalyticsCard;
