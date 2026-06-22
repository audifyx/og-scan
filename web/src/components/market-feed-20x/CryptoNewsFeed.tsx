/**
 * CryptoNewsFeed — reliable crypto news, read straight from the public
 * `crypto_news` table (populated server-side by the news-fetcher edge fn).
 * No browser CORS proxies, so it actually loads.
 */
import { useEffect, useMemo, useState } from "react";
import { Newspaper, ExternalLink, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface NewsRow {
  id: string;
  title: string;
  description: string | null;
  source: string | null;
  source_url: string | null;
  image_url: string | null;
  sentiment: "bullish" | "bearish" | "neutral" | null;
  coins: string[] | null;
  published_at: string;
}

const timeAgo = (iso: string): string => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

const sentimentMeta = {
  bullish: { cls: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300", Icon: TrendingUp, label: "Bullish" },
  bearish: { cls: "border-red-400/40 bg-red-500/10 text-red-400", Icon: TrendingDown, label: "Bearish" },
  neutral: { cls: "border-white/15 bg-white/[0.04] text-white/45", Icon: Minus, label: "Neutral" },
};

type Filter = "all" | "bullish" | "bearish";

export const CryptoNewsFeed = () => {
  const [rows, setRows] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const load = () => {
    setLoading(true);
    supabase
      .from("crypto_news")
      .select("id,title,description,source,source_url,image_url,sentiment,coins,published_at")
      .order("published_at", { ascending: false })
      .limit(60)
      .then(({ data }) => {
        if (data) setRows(data as NewsRow[]);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    const iv = window.setInterval(load, 120_000);
    return () => window.clearInterval(iv);
  }, []);

  const filtered = useMemo(() => filter === "all" ? rows : rows.filter((r) => r.sentiment === filter), [rows, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-white/70">
          <Newspaper className="h-4 w-4 text-emerald-300" /> {rows.length} stories
        </span>
        {(["all", "bullish", "bearish"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={cn("shrink-0 rounded-xl border px-3 py-1.5 text-[11px] font-bold capitalize transition",
              filter === f ? "border-emerald-400/50 bg-emerald-500/[0.08] text-emerald-300" : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70")}>
            {f}
          </button>
        ))}
        <button type="button" onClick={load} className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/55 transition hover:border-emerald-400/40 hover:text-emerald-300">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <div className="grid min-h-[200px] place-items-center rounded-2xl border border-dashed border-white/12 text-emerald-300"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 p-8 text-center text-xs uppercase tracking-widest text-white/40">No news right now</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const sm = sentimentMeta[n.sentiment ?? "neutral"];
            return (
              <a key={n.id} href={n.source_url ?? "#"} target="_blank" rel="noreferrer"
                className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-emerald-400/40 hover:bg-white/[0.05]">
                {n.image_url ? (
                  <img src={n.image_url} alt="" loading="lazy" className="h-16 w-16 flex-none rounded-xl object-cover" />
                ) : (
                  <div className="grid h-16 w-16 flex-none place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-emerald-300"><Newspaper className="h-5 w-5" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest", sm.cls)}>
                      <sm.Icon className="h-2.5 w-2.5" /> {sm.label}
                    </span>
                    <span className="truncate text-[10px] font-semibold uppercase tracking-widest text-white/35">{n.source}</span>
                    <span className="ml-auto flex-none text-[10px] text-white/30">{timeAgo(n.published_at)} ago</span>
                  </div>
                  <h4 className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-white">{n.title}</h4>
                  {n.description && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/40">{n.description}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {(n.coins ?? []).slice(0, 4).map((c) => (
                      <span key={c} className="rounded-full border border-emerald-400/25 bg-emerald-500/[0.06] px-1.5 py-0.5 text-[9px] font-bold text-emerald-300/80">${c}</span>
                    ))}
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-white/30">Read <ExternalLink className="h-2.5 w-2.5" /></span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CryptoNewsFeed;
