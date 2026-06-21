import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Loader2, RefreshCw, Trophy, Target, Flame, Skull, Users } from "lucide-react";

type Bucket = { avg_peak: number; win_rate_2x: number; count: number };
type Best = { symbol: string | null; name: string | null; mint: string; og_score: number | null; market_cap: number | null; peak_market_cap: number | null; mult: number | null; created_at: string };
type Stats = { total_scans: number; tracked: number; overall: Bucket; high_score: Bucket; best: Best[] };

const fmtUsd = (n: any) => {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return "--";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(2);
};
const multColor = (m: number) => m >= 10 ? "text-og-lime" : m >= 3 ? "text-emerald-400" : m >= 1.5 ? "text-cyan-400" : "text-white/60";
const scoreColor = (s: number) => s >= 80 ? "text-og-lime" : s >= 60 ? "text-emerald-400" : s >= 40 ? "text-yellow-400" : "text-red-400";

export default function TrackRecord() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [board, setBoard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data }, lb] = await Promise.all([
        supabase.rpc("grim_track_record_stats"),
        supabase.rpc("grim_leaderboard"),
      ]);
      setStats(data as Stats);
      setBoard(lb.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const hs = stats?.high_score;
  const ov = stats?.overall;

  return (
    <AppLayout>
      <PageHeader title="Grim's Track Record" description="Every token Grim has scanned, scored, and how it actually performed. Receipts, not promises." />
      <div className="px-4 pb-24 max-w-[1000px] mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="text-white/40 text-[12px]">{stats ? `${stats.total_scans.toLocaleString()} scans logged · ${stats.tracked.toLocaleString()} tracked` : "…"}</div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="rounded-xl">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* hero stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="relative overflow-hidden glass-card p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-og-lime/[0.14] to-transparent" />
            <div className="relative">
              <div className="flex items-center gap-1.5 text-og-lime text-[11px] font-bold uppercase tracking-wider"><Skull className="h-3.5 w-3.5" /> Score 80+ calls</div>
              <div className="mt-2 text-4xl font-black text-white">{hs ? `${hs.avg_peak}x` : "--"}</div>
              <div className="text-white/45 text-[12px] mt-1">avg peak multiple · {hs?.count ?? 0} tokens</div>
            </div>
          </Card>
          <Card className="glass-card p-5">
            <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold uppercase tracking-wider"><Target className="h-3.5 w-3.5" /> Hit rate (2x+)</div>
            <div className="mt-2 text-4xl font-black text-white">{hs ? `${hs.win_rate_2x}%` : "--"}</div>
            <div className="text-white/45 text-[12px] mt-1">of 80+ calls did 2x or more</div>
          </Card>
          <Card className="glass-card p-5">
            <div className="flex items-center gap-1.5 text-cyan-400 text-[11px] font-bold uppercase tracking-wider"><Flame className="h-3.5 w-3.5" /> All scans</div>
            <div className="mt-2 text-4xl font-black text-white">{ov ? `${ov.avg_peak}x` : "--"}</div>
            <div className="text-white/45 text-[12px] mt-1">avg peak · {ov?.win_rate_2x ?? 0}% hit 2x</div>
          </Card>
        </div>

        {/* best calls */}
        <Card className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3"><Trophy className="h-4 w-4 text-og-lime" /><h3 className="font-bold text-white text-[15px]">Grim's best calls</h3></div>
          {loading && !stats ? (
            <div className="flex items-center gap-2 text-white/40 text-[13px]"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : stats?.best?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-white/35 text-[10px] uppercase tracking-wider text-left">
                    <th className="py-2 pr-2">Token</th>
                    <th className="py-2 px-2 text-center">Score</th>
                    <th className="py-2 px-2 text-right">Called at</th>
                    <th className="py-2 px-2 text-right">Peak</th>
                    <th className="py-2 pl-2 text-right">Multiple</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.best.map((b) => (
                    <tr key={b.mint + b.created_at} className="border-t border-white/[0.05]">
                      <td className="py-2.5 pr-2">
                        <a href={`https://dexscreener.com/solana/${b.mint}`} target="_blank" rel="noreferrer" className="font-semibold text-white/90 hover:text-og-lime">${b.symbol || b.mint.slice(0, 6)}</a>
                        {b.name ? <div className="text-white/30 text-[10px] truncate max-w-[160px]">{b.name}</div> : null}
                      </td>
                      <td className={`py-2.5 px-2 text-center font-bold ${scoreColor(b.og_score ?? 0)}`}>{b.og_score ?? "--"}</td>
                      <td className="py-2.5 px-2 text-right text-white/55">{fmtUsd(b.market_cap)}</td>
                      <td className="py-2.5 px-2 text-right text-white/55">{fmtUsd(b.peak_market_cap)}</td>
                      <td className={`py-2.5 pl-2 text-right font-black ${multColor(b.mult ?? 0)}`}>{b.mult != null ? `${b.mult}x` : "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-white/30 text-[13px]">No tracked calls yet. As tokens get scanned and prices update, Grim's record fills in here.</div>
          )}
        </Card>

        {board?.groups?.length ? (
          <Card className="glass-card p-5">
            <div className="flex items-center gap-2 mb-3"><Users className="h-4 w-4 text-og-cyan" /><h3 className="font-bold text-white text-[15px]">Top groups by realized performance</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="text-white/35 text-[10px] uppercase tracking-wider text-left">
                  <th className="py-2 pr-2">#</th><th className="py-2 px-2">Group</th><th className="py-2 px-2 text-center">Calls</th>
                  <th className="py-2 px-2 text-right">Avg peak</th><th className="py-2 px-2 text-right">2x rate</th><th className="py-2 pl-2 text-right">Best</th>
                </tr></thead>
                <tbody>
                  {board.groups.map((g: any, i: number) => (
                    <tr key={i} className="border-t border-white/[0.05]">
                      <td className="py-2.5 pr-2 text-white/40">{i + 1}</td>
                      <td className="py-2.5 px-2 font-semibold text-white/90 truncate max-w-[180px]">{g.title}</td>
                      <td className="py-2.5 px-2 text-center text-white/55">{g.calls}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-og-lime">{g.avg_peak}x</td>
                      <td className="py-2.5 px-2 text-right text-white/55">{g.win_rate}%</td>
                      <td className="py-2.5 pl-2 text-right text-emerald-400 font-bold">{g.best}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-white/30 text-[10px] mt-2">Groups running an OG Scan bot, ranked by the realized peak multiple of the tokens they scanned. Min 3 tracked calls.</div>
          </Card>
        ) : null}

        <div className="text-white/30 text-[11px] text-center">Multiples are peak market cap since the scan vs market cap at scan time. Updated every 30 min. <a href="/app" className="text-og-lime hover:underline">Scan a token →</a></div>
      </div>
    </AppLayout>
  );
}
