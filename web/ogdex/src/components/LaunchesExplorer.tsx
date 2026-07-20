import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Rocket, ExternalLink, Loader2, Search, RefreshCw, Star, Copy, Check, ShieldCheck, Flame, ArrowRight } from "lucide-react";
import { getLaunches, LaunchedToken, fmtUsd, short } from "../lib/api";

type Sort = "new" | "mcap" | "volume";
type FilterT = "all" | "verified" | "boosted" | "favorites";
const FAV_KEY = "orbitx.launchpad.favs";
const SORTS: { id: Sort; label: string }[] = [
  { id: "new", label: "Newest" }, { id: "mcap", label: "Top MC" }, { id: "volume", label: "Top Vol" },
];
const FILTERS: { id: FilterT; label: string }[] = [
  { id: "all", label: "All" }, { id: "verified", label: "Verified" }, { id: "boosted", label: "Boosted" }, { id: "favorites", label: "★ Saved" },
];

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`;
}

export default function LaunchesExplorer() {
  const [rows, setRows] = useState<LaunchedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const [filter, setFilter] = useState<FilterT>("all");
  const [favs, setFavs] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch { return new Set(); }
  });
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => { setLoading(true); getLaunches(100).then((d) => { setRows(d.rows || []); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const toggleFav = (mint: string) => setFavs((prev) => {
    const n = new Set(prev); n.has(mint) ? n.delete(mint) : n.add(mint);
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...n])); } catch { /* ignore */ }
    return n;
  });
  const copy = (mint: string) => { try { navigator.clipboard.writeText(mint); } catch { /* ignore */ } setCopied(mint); setTimeout(() => setCopied(null), 1200); };

  const shown = useMemo(() => {
    let r = [...rows];
    if (q.trim()) { const s = q.toLowerCase(); r = r.filter((t) => (t.name || "").toLowerCase().includes(s) || (t.symbol || "").toLowerCase().includes(s) || t.mint.toLowerCase().includes(s)); }
    if (filter === "verified") r = r.filter((t) => t.verified);
    else if (filter === "boosted") r = r.filter((t) => t.boosted);
    else if (filter === "favorites") r = r.filter((t) => favs.has(t.mint));
    if (sort === "mcap") r.sort((a, b) => (b.mcap || 0) - (a.mcap || 0));
    else if (sort === "volume") r.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    else r.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return r;
  }, [rows, q, sort, filter, favs]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, symbol, or CA…"
            className="w-full bg-panel2 border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-muted/60 focus:border-accent/50 outline-none" />
        </div>
        <div className="flex gap-1">{SORTS.map((s) => (
          <button key={s.id} onClick={() => setSort(s.id)}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${sort === s.id ? "bg-accent text-black" : "bg-panel2 text-muted hover:text-white"}`}>{s.label}</button>
        ))}</div>
        <button onClick={load} className="p-2 rounded-lg bg-panel2 text-muted hover:text-white" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">{FILTERS.map((f) => (
        <button key={f.id} onClick={() => setFilter(f.id)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${filter === f.id ? "bg-accent/20 text-accent border border-accent/40" : "bg-panel2 text-muted border border-line hover:text-white"}`}>{f.label}</button>
      ))}
        <span className="ml-auto self-center text-[11px] text-muted">{shown.length} tokens</span>
      </div>

      {loading ? (
        <div className="py-20 grid place-items-center text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : shown.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <Rocket className="w-8 h-8 text-muted mx-auto" />
          <div className="font-semibold">{q || filter !== "all" ? "No matches" : "No tokens launched yet"}</div>
          <p className="text-sm text-muted">{q || filter !== "all" ? "Try clearing filters." : "Be the first to launch a token on OrbitX."}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => (
            <div key={t.mint} className="card p-4 space-y-3 hover:border-accent/40 transition-colors group">
              <div className="flex items-center gap-3">
                {t.icon
                  ? <img src={t.icon} className="w-11 h-11 rounded-full object-cover" />
                  : <div className="w-11 h-11 rounded-full bg-panel2 grid place-items-center text-accent font-bold">{(t.symbol || "?").slice(0, 2)}</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm truncate">{t.name || short(t.mint)}</span>
                    {t.verified && <ShieldCheck className="w-3.5 h-3.5 text-up shrink-0" />}
                    {t.boosted && <Flame className="w-3.5 h-3.5 text-accent shrink-0" />}
                  </div>
                  <div className="text-xs text-muted font-mono">${t.symbol || "—"} · {t.chain || "solana"}</div>
                </div>
                <button onClick={() => toggleFav(t.mint)} title="Save" className="p-1 -m-1">
                  <Star className={`w-4 h-4 transition-colors ${favs.has(t.mint) ? "text-yellow-400 fill-yellow-400" : "text-muted hover:text-yellow-400"}`} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-[9px] uppercase text-muted/60">MC</div><div className="text-xs font-semibold">{t.mcap ? fmtUsd(t.mcap, { compact: true }) : "—"}</div></div>
                <div><div className="text-[9px] uppercase text-muted/60">Vol 24h</div><div className="text-xs font-semibold">{t.volume24h ? fmtUsd(t.volume24h, { compact: true }) : "—"}</div></div>
                <div><div className="text-[9px] uppercase text-muted/60">Liq</div><div className="text-xs font-semibold">{t.liquidity ? fmtUsd(t.liquidity, { compact: true }) : "—"}</div></div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted">
                <button onClick={() => copy(t.mint)} className="inline-flex items-center gap-1 font-mono hover:text-white">
                  {copied === t.mint ? <Check className="w-3 h-3 text-up" /> : <Copy className="w-3 h-3" />} {short(t.mint)}
                </button>
                <span>{timeAgo(t.created_at)} ago</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <Link to={`/launchpad/token/${t.mint}`} className="btn bg-accent/15 text-accent text-[11px] inline-flex items-center justify-center gap-1 py-1.5">Details</Link>
                <a href={t.links.pumpfun || t.links.explorer || "#"} target="_blank" rel="noreferrer" className="btn bg-panel2 text-white text-[11px] inline-flex items-center justify-center gap-1 py-1.5">pump <ExternalLink className="w-3 h-3" /></a>
                <a href={t.links.solscan || t.links.explorer || "#"} target="_blank" rel="noreferrer" className="btn bg-panel2 text-white text-[11px] inline-flex items-center justify-center gap-1 py-1.5">scan <ExternalLink className="w-3 h-3" /></a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
