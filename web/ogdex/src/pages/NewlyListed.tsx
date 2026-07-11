import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Rocket, ExternalLink, Loader2, Sparkles, ShieldOff, ArrowRight } from "lucide-react";
import { getLaunches, LaunchedToken, fmtUsd, short } from "../lib/api";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NewlyListed() {
  const [rows, setRows] = useState<LaunchedToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    getLaunches(60).then((d) => { if (on) { setRows(d.rows || []); setLoading(false); } })
      .catch(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, []);

  return (
    <div className="max-w-[1100px] mx-auto py-6 px-4 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-accent" />
            <div className="term text-[11px]" style={{ color: "#66707E" }}><span style={{ color: "#00FFA3" }}>orbitx@dex</span>:~$ launches --fresh --live</div>
            <h1 className="text-2xl font-black">NEW_LISTINGS</h1>
          </div>
          <p className="text-muted text-sm">Fresh tokens launched through OrbitX DEX. Unverified and unboosted — do your own research.</p>
        </div>
        <Link to="/launch" className="btn bg-accent text-black font-bold inline-flex items-center gap-1.5 px-4 py-2">
          <Rocket className="w-4 h-4" /> Launch a Token
        </Link>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted bg-panel2/50 rounded-lg px-3 py-2 border border-line">
        <ShieldOff className="w-3.5 h-3.5 text-yellow-400" />
        Launched tokens are <span className="text-white">not verified</span> and receive <span className="text-white">no boosts</span>. Want featured placement? <Link to="/store" className="text-accent hover:underline">Visit the Store</Link>.
      </div>

      {loading ? (
        <div className="py-20 grid place-items-center text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <Rocket className="w-8 h-8 text-muted mx-auto" />
          <div className="font-semibold">No tokens launched yet</div>
          <p className="text-sm text-muted">Be the first to launch a token on OrbitX DEX.</p>
          <Link to="/launch" className="btn bg-accent text-black font-bold inline-flex items-center gap-1.5 px-4 py-2 mt-1">
            Launch now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => (
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
