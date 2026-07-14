/* ══════════════════════════════════════════════════════════════
   Admin · Advanced Analytics
   Trading / Token / Launchpad / Scanner analytics, wired to live tables.
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { TrendingUp, Coins, Rocket, Crosshair, RefreshCw, Loader2 } from "lucide-react";

type Tab = "trading" | "token" | "launchpad" | "scanner";
const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "trading",   label: "Trading",   icon: TrendingUp },
  { id: "token",     label: "Token",     icon: Coins },
  { id: "launchpad", label: "Launchpad", icon: Rocket },
  { id: "scanner",   label: "Scanner",   icon: Crosshair },
];

const since24 = () => new Date(Date.now() - 86_400_000).toISOString();
const fmtNum = (n: any) => (typeof n === "number" ? n.toLocaleString() : "—");
const fmtUsd = (n: any) => (typeof n === "number" ? "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—");

async function count(table: string, timeCol?: string, since?: string, extra?: (q: any) => any) {
  let q: any = supabase.from(table).select("*", { count: "exact", head: true });
  if (timeCol && since) q = q.gte(timeCol, since);
  if (extra) q = extra(q);
  const { count } = await q;
  return count || 0;
}
async function recent(table: string, timeCol: string, cols = "*", limit = 8) {
  const { data } = await supabase.from(table).select(cols).order(timeCol, { ascending: false }).limit(limit);
  return data || [];
}

const Stat = ({ label, value, tone = "text-cyan-200" }: { label: string; value: any; tone?: string }) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={`mt-1 text-xl font-bold ${tone}`}>{value}</div>
  </div>
);

const Row = ({ cells }: { cells: (string | number | null | undefined)[] }) => (
  <div className="grid grid-cols-4 gap-2 border-b border-white/5 py-1.5 text-[12px]">
    {cells.map((c, i) => <div key={i} className={`truncate ${i === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>{c ?? "—"}</div>)}
  </div>
);

export const AdvancedAnalytics = () => {
  const [tab, setTab] = useState<Tab>("trading");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [lists, setLists] = useState<Record<string, any[]>>({});

  const load = async () => {
    setLoading(true);
    const s = since24();
    const [tradesTotal, trades24, tradeWins, swapsTotal, swaps24,
           tokenSnaps, tokenEv24, launchTotal, launch24, launchFeat, launchRev,
           scansTotal, scans24, ogiScans] = await Promise.all([
      count("trade_history", "created_at"),
      count("trade_history", "created_at", s),
      count("trade_history", undefined, undefined, (q: any) => q.eq("is_winner", true)),
      count("wallet_trades", "created_at"),
      count("wallet_trades", "created_at", s),
      count("token_analytics"),
      count("token_events", "created_at", s),
      count("launchpad_active", "created_at"),
      count("launchpad_active", "created_at", s),
      count("launchpad_active", undefined, undefined, (q: any) => q.eq("is_featured", true)),
      count("ogdex_launches"),
      count("scan_log", "created_at"),
      count("scan_log", "created_at", s),
      count("ogi_scan_log", "created_at"),
    ]);
    setStats({ tradesTotal, trades24, tradeWins, swapsTotal, swaps24, tokenSnaps, tokenEv24,
               launchTotal, launch24, launchFeat, launchRev, scansTotal, scans24, ogiScans });
    const [trh, lp, tev, sc, lb] = await Promise.all([
      recent("trade_history", "created_at", "token_symbol,trade_type,total_usd,roi_percent,is_winner,created_at"),
      recent("launchpad_active", "created_at", "token_name,symbol,status,market_cap,volume_24h_usd,holders,created_at"),
      recent("token_events", "created_at", "symbol:mint,event_type,title,created_at"),
      recent("scan_log", "created_at", "symbol,og_score,peak_multiple,market_cap,created_at"),
      supabase.from("ogi_scanner_leaderboard").select("*").order("total_scans", { ascending: false }).limit(8).then((r: any) => r.data || []),
    ]);
    setLists({ trh, lp, tev, sc, lb });
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <Button key={t.id} size="sm" variant={tab === t.id ? "default" : "outline"} onClick={() => setTab(t.id)}>
              <t.icon className="mr-1 h-3.5 w-3.5" /> {t.label}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          {tab === "trading" && (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="Total trades" value={fmtNum(stats.tradesTotal)} />
                <Stat label="Trades 24h" value={fmtNum(stats.trades24)} tone="text-emerald-300" />
                <Stat label="Winning trades" value={fmtNum(stats.tradeWins)} tone="text-violet-300" />
                <Stat label="Swaps (all)" value={fmtNum(stats.swapsTotal)} tone="text-amber-300" />
              </div>
              <Card><CardHeader><CardTitle className="text-sm">Recent trades</CardTitle></CardHeader>
                <CardContent><ScrollArea className="max-h-72"><div className="grid grid-cols-4 gap-2 pb-1 text-[10px] uppercase text-muted-foreground/60"><div>Token</div><div>Type</div><div>Total</div><div>ROI %</div></div>
                  {lists.trh?.map((r: any, i: number) => <Row key={i} cells={[r.token_symbol, r.trade_type, fmtUsd(r.total_usd), r.roi_percent != null ? r.roi_percent + "%" : "—"]} />)}
                </ScrollArea></CardContent></Card>
            </>
          )}
          {tab === "token" && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Analytics snapshots" value={fmtNum(stats.tokenSnaps)} />
                <Stat label="Token events 24h" value={fmtNum(stats.tokenEv24)} tone="text-emerald-300" />
                <Stat label="Swaps 24h" value={fmtNum(stats.swaps24)} tone="text-amber-300" />
              </div>
              <Card><CardHeader><CardTitle className="text-sm">Recent token events</CardTitle></CardHeader>
                <CardContent><ScrollArea className="max-h-72"><div className="grid grid-cols-4 gap-2 pb-1 text-[10px] uppercase text-muted-foreground/60"><div>Mint</div><div>Type</div><div>Title</div><div>When</div></div>
                  {lists.tev?.map((r: any, i: number) => <Row key={i} cells={[(r.symbol || "").slice(0, 10), r.event_type, r.title, formatDistanceToNow(new Date(r.created_at), { addSuffix: true })]} />)}
                </ScrollArea></CardContent></Card>
            </>
          )}
          {tab === "launchpad" && (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="Active launches" value={fmtNum(stats.launchTotal)} />
                <Stat label="Launches 24h" value={fmtNum(stats.launch24)} tone="text-emerald-300" />
                <Stat label="Featured" value={fmtNum(stats.launchFeat)} tone="text-violet-300" />
                <Stat label="DEX launches" value={fmtNum(stats.launchRev)} tone="text-amber-300" />
              </div>
              <Card><CardHeader><CardTitle className="text-sm">Recent launches</CardTitle></CardHeader>
                <CardContent><ScrollArea className="max-h-72"><div className="grid grid-cols-4 gap-2 pb-1 text-[10px] uppercase text-muted-foreground/60"><div>Token</div><div>Status</div><div>Mkt cap</div><div>Holders</div></div>
                  {lists.lp?.map((r: any, i: number) => <Row key={i} cells={[r.token_name || r.symbol, r.status, fmtUsd(r.market_cap), fmtNum(r.holders)]} />)}
                </ScrollArea></CardContent></Card>
            </>
          )}
          {tab === "scanner" && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Total scans" value={fmtNum(stats.scansTotal)} />
                <Stat label="Scans 24h" value={fmtNum(stats.scans24)} tone="text-emerald-300" />
                <Stat label="OGI forensic scans" value={fmtNum(stats.ogiScans)} tone="text-violet-300" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card><CardHeader><CardTitle className="text-sm">Recent scans</CardTitle></CardHeader>
                  <CardContent><ScrollArea className="max-h-72"><div className="grid grid-cols-4 gap-2 pb-1 text-[10px] uppercase text-muted-foreground/60"><div>Symbol</div><div>OG score</div><div>Peak x</div><div>Mkt cap</div></div>
                    {lists.sc?.map((r: any, i: number) => <Row key={i} cells={[r.symbol, r.og_score, r.peak_multiple != null ? r.peak_multiple + "x" : "—", fmtUsd(r.market_cap)]} />)}
                  </ScrollArea></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">Top scanners</CardTitle></CardHeader>
                  <CardContent><ScrollArea className="max-h-72"><div className="grid grid-cols-4 gap-2 pb-1 text-[10px] uppercase text-muted-foreground/60"><div>Handle</div><div>Scans</div><div>OG finds</div><div>Tokens</div></div>
                    {lists.lb?.map((r: any, i: number) => <Row key={i} cells={[r.handle, fmtNum(r.total_scans), fmtNum(r.og_finds), fmtNum(r.unique_tokens)]} />)}
                  </ScrollArea></CardContent></Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
export default AdvancedAnalytics;
