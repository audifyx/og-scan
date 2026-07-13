import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Rocket, Search, ShieldOff, Sparkles } from "lucide-react";
import { getLaunches, LaunchedToken, fmtUsd, short } from "../lib/api";
import { VANITY_SUFFIX, isVanityAddress } from "../lib/vanity-mint";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Highlight the trailing vanity suffix of a CA so the "…orb" brand is obvious. */
function CaBadge({ mint }: { mint: string }) {
  const vanity = isVanityAddress(mint);
  const tail = mint.slice(-6);
  return (
    <span className="font-mono text-[10px] text-muted/80">
      {short(mint)}
      {vanity && (
        <span className="ml-1 text-accent font-bold uppercase">·{VANITY_SUFFIX}</span>
      )}
    </span>
  );
}

/**
 * The Launchpad coin feed — a live, pump.fun-style grid of ONLY the tokens
 * launched through the OrbitX Launchpad (sourced from /api/ogdex/launches,
 * i.e. the ogdex_launches table). Auto-refreshes so fresh launches surface
 * without a reload.
 */
export default function LaunchpadFeed() {
  const [rows, setRows] = useState<LaunchedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    getLaunches(80)
      .then((d) => { setRows(d.rows || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    timer.current = setInterval(load, 20_000); // live refresh
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const filtered = rows.filter((t) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (
      (t.name || "").toLowerCase().includes(s) ||
      (t.symbol || "").toLowerCase().includes(s) ||
      t.mint.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-black tracking-tight">LIVE&nbsp;FEED</h2>
          <span className="pill bg-accent/15 text-accent text-[10px] font-bold">
            {rows.length} launched
          </span>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, ticker, CA…"
            className="bg-panel2 border border-line rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-muted/60 focus:outline-none focus:border-accent/50 w-52"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted bg-panel2/50 rounded-lg px-3 py-2 border border-line">
        <ShieldOff className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
        Only coins launched on the OrbitX Launchpad appear here. They're
        <span className="text-white">&nbsp;unverified&nbsp;</span> and unboosted — always do your own research.
      </div>

      {loading ? (
        <div className="py-20 grid place-items-center text-muted">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <Rocket className="w-8 h-8 text-muted mx-auto" />
          <div className="font-semibold">{q ? "No coins match your search" : "No coins launched yet"}</div>
          <p className="text-sm text-muted">
            {q ? "Try a different name or ticker." : `Be the first to launch a coin with a custom …${VANITY_SUFFIX} address.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.mint} className="card p-4 space-y-3 hover:border-accent/40 transition-colors">
              <div className="flex items-center gap-3">
                {t.icon
                  ? <img src={t.icon} className="w-10 h-10 rounded-full object-cover" />
                  : <div className="w-10 h-10 rounded-full bg-panel2 grid place-items-center text-accent font-bold">{(t.symbol || "?").slice(0, 2)}</div>}
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm truncate">{t.name || short(t.mint)}</div>
                  <div className="text-xs text-muted font-mono">${t.symbol || "—"}</div>
                </div>
                <span className="pill bg-yellow-500/15 text-yellow-400 text-[9px] font-bold">UNVERIFIED</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t.mcap ? `${fmtUsd(t.mcap, { compact: true })} MC` : "New"}</span>
                <span className="text-muted/70">{timeAgo(t.created_at)}</span>
              </div>

              <div className="flex items-center justify-between">
                <CaBadge mint={t.mint} />
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <Link to={`/token/${t.mint}`} className="btn bg-accent/15 text-accent text-[11px] inline-flex items-center justify-center gap-1 py-1.5">Chart</Link>
                <a href={t.links.pumpfun} target="_blank" rel="noreferrer" className="btn bg-panel2 text-white text-[11px] inline-flex items-center justify-center gap-1 py-1.5">pump <ExternalLink className="w-3 h-3" /></a>
                <a href={t.links.solscan} target="_blank" rel="noreferrer" className="btn bg-panel2 text-white text-[11px] inline-flex items-center justify-center gap-1 py-1.5">scan <ExternalLink className="w-3 h-3" /></a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
