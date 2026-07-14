import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, Search, RefreshCw, Feather, TrendingUp, Flame, Droplets,
  Copy, Check, ExternalLink, ArrowUpRight, ArrowDownRight, Users, Clock, Layers,
} from "lucide-react";
import { getScreener, Row, fmtUsd, short } from "../lib/api";

type SortKey = "volume" | "mcap" | "liquidity" | "change" | "holders" | "newest" | "gainers" | "losers";
type CapKey = "all" | "low" | "mid" | "high";
const SORTS: { key: SortKey; label: string; icon: any }[] = [
  { key: "volume",    label: "Volume",    icon: Flame },
  { key: "mcap",      label: "Market cap", icon: TrendingUp },
  { key: "liquidity", label: "Liquidity", icon: Droplets },
  { key: "change",    label: "24h %",     icon: ArrowUpRight },
  { key: "gainers",   label: "Gainers",   icon: ArrowUpRight },
  { key: "losers",    label: "Losers",    icon: ArrowDownRight },
  { key: "holders",   label: "Holders",   icon: Users },
  { key: "newest",    label: "Newest",    icon: Clock },
];
const CAPS: { key: CapKey; label: string }[] = [
  { key: "all", label: "All caps" },
  { key: "low", label: "Low cap (<$100K)" },
  { key: "mid", label: "Mid cap ($100K–$1M)" },
  { key: "high", label: "High cap (>$1M)" },
];

// GeckoTerminal link for the Robinhood chain (see web/src/lib/chains.ts)
const GT = (pool: string) => `https://www.geckoterminal.com/robinhood/pools/${pool}`;

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).then(() => {
      setCopied(v); setTimeout(() => setCopied((c) => (c === v ? null : c)), 1200);
    }).catch(() => {});
  };
  return { copied, copy };
}

function Change({ v }: { v?: number | null }) {
  if (v == null || !isFinite(v)) return <span className="text-muted">—</span>;
  const up = v >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-bold ${up ? "text-up" : "text-down"}`}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(v).toFixed(1)}%
    </span>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-panel2/60 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted/70">{label}</div>
      <div className={`text-xs font-bold ${accent ? "text-accent" : "text-white"}`}>{value}</div>
    </div>
  );
}

/**
 * Robinhood — a dedicated live feed of meme coins on the Robinhood chain,
 * mirroring the Launchpad feed. Market data (price / market cap / 24h volume /
 * liquidity / change) comes from GeckoTerminal via /api/ogdex/screener?chain=robinhood.
 * Honeypot/rug/holder analysis isn't shown here yet — no security provider
 * indexes the Robinhood chain, so that data doesn't exist for it today.
 */
export default function Robinhood() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("volume");
  const [cap, setCap] = useState<CapKey>("all");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { copied, copy } = useCopy();

  const load = (manual = false) => {
    if (manual) setRefreshing(true);
    getScreener("trending", "24h", 120, "robinhood")
      .then((d) => { setRows(d.rows || []); setErr(d.error || null); setUpdatedAt(Date.now()); })
      .catch((e) => setErr(String(e?.message || e)))
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => {
    load();
    timer.current = setInterval(() => load(), 30_000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const totalVol = useMemo(() => rows.reduce((s, r) => s + (r.volume || 0), 0), [rows]);
  const gainers = useMemo(() => rows.filter((r) => (r.change24h || 0) > 0).length, [rows]);
  const avgChange = useMemo(() => rows.length ? rows.reduce((s, r) => s + (r.change24h || 0), 0) / rows.length : 0, [rows]);

  const view = useMemo(() => {
    const s = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (s && !((r.name || "").toLowerCase().includes(s) ||
        (r.symbol || "").toLowerCase().includes(s) ||
        (r.mint || "").toLowerCase().includes(s))) return false;
      const mc = r.mcap || 0;
      if (cap === "low") return mc > 0 && mc < 100_000;
      if (cap === "mid") return mc >= 100_000 && mc <= 1_000_000;
      if (cap === "high") return mc > 1_000_000;
      return true;
    });
    const num = (n?: number | null) => (typeof n === "number" && isFinite(n) ? n : -Infinity);
    const ts = (r: Row) => (r.createdAt ? new Date(r.createdAt).getTime() : (r.ageDays != null ? Date.now() - r.ageDays * 86400000 : 0));
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "mcap":      return num(b.mcap) - num(a.mcap);
        case "liquidity": return num(b.liquidity) - num(a.liquidity);
        case "change":
        case "gainers":   return num(b.change24h) - num(a.change24h);
        case "losers":    return num(a.change24h) - num(b.change24h);
        case "holders":   return num(b.holderCount) - num(a.holderCount);
        case "newest":    return ts(b) - ts(a);
        default:          return num(b.volume) - num(a.volume);
      }
    });
    return out;
  }, [rows, q, sort, cap]);

  return (
    <div className="max-w-6xl mx-auto px-3 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: "linear-gradient(135deg,#00C805,#0a3d15)" }}>
            <Feather className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              Robinhood Chain
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-up/70" /><span className="relative inline-flex rounded-full h-2 w-2 bg-up" /></span>
            </h1>
            <div className="text-xs text-muted">Live meme coins on the Robinhood chain</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill bg-accent/15 text-accent text-[10px] font-bold">{rows.length} coins</span>
          {totalVol > 0 && <span className="pill bg-up/10 text-up text-[10px] font-bold">{fmtUsd(totalVol, { compact: true })} 24h vol</span>}
          <button onClick={() => load(true)} className="btn bg-panel2 text-muted hover:text-white text-[11px] inline-flex items-center gap-1.5 py-1.5 px-3">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />refresh
          </button>
        </div>
      </div>

      {/* Market overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="card p-3"><div className="text-[10px] uppercase text-muted/60">Coins</div><div className="text-lg font-black text-accent">{rows.length}</div></div>
        <div className="card p-3"><div className="text-[10px] uppercase text-muted/60">24h Volume</div><div className="text-lg font-black">{fmtUsd(totalVol, { compact: true })}</div></div>
        <div className="card p-3"><div className="text-[10px] uppercase text-muted/60">Gainers</div><div className="text-lg font-black text-up">{gainers}<span className="text-xs text-muted">/{rows.length}</span></div></div>
        <div className="card p-3"><div className="text-[10px] uppercase text-muted/60">Avg 24h</div><div className={`text-lg font-black ${avgChange >= 0 ? "text-up" : "text-down"}`}>{avgChange >= 0 ? "+" : ""}{avgChange.toFixed(1)}%</div></div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ticker, CA…"
            className="bg-panel2 border border-line rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-muted/60 focus:outline-none focus:border-accent/50 w-56" />
        </div>
        <div className="flex items-center gap-1 bg-panel2 border border-line rounded-lg p-0.5">
          {SORTS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setSort(key)}
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${sort === key ? "bg-accent/20 text-accent" : "text-muted hover:text-white"}`}>
              <Icon className="w-3 h-3" />{label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {CAPS.map(({ key, label }) => (
            <button key={key} onClick={() => setCap(key)}
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${cap === key ? "bg-accent/20 text-accent border-accent/40" : "bg-panel2 text-muted border-line hover:text-white"}`}>
              {key === "all" && <Layers className="w-3 h-3" />}{label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-muted bg-panel2/50 rounded-lg px-3 py-2 border border-line">
        Market data (price, market cap, volume, liquidity) is live via GeckoTerminal. Honeypot / rug / holder analysis isn't available for the Robinhood chain yet — no security provider indexes it. Always DYOR.
      </div>

      {err && !rows.length && <div className="card p-4 text-center text-sm text-yellow-400">Couldn't load Robinhood coins right now — retrying automatically.</div>}

      {loading ? (
        <div className="py-20 grid place-items-center text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : view.length === 0 ? (
        <div className="card p-10 text-center space-y-2">
          <Feather className="w-8 h-8 text-muted mx-auto" />
          <div className="font-semibold">{q ? "No coins match" : "No Robinhood coins found right now"}</div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {view.map((t) => (
            <div key={t.mint} className="card p-4 space-y-3 transition-colors hover:border-accent/40">
              <Link to={`/token/${t.mint}?chain=robinhood`} className="flex items-center gap-3 group">
                {t.icon
                  ? <img src={t.icon} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  : <div className="w-10 h-10 rounded-full bg-panel2 grid place-items-center text-accent font-bold shrink-0">{(t.symbol || "?").slice(0, 2)}</div>}
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm truncate group-hover:text-accent transition-colors">{t.name || short(t.mint)}</div>
                  <div className="text-xs text-muted font-mono truncate">${t.symbol || "—"}</div>
                </div>
                <div className="text-xs"><Change v={t.change24h} /></div>
              </Link>

              <div className="grid grid-cols-2 gap-1.5">
                <Stat label="Market cap" value={t.mcap ? fmtUsd(t.mcap, { compact: true }) : "—"} accent />
                <Stat label="Price" value={fmtUsd(t.priceUsd)} />
                <Stat label="24h vol" value={t.volume ? fmtUsd(t.volume, { compact: true }) : "—"} />
                <Stat label="Liquidity" value={t.liquidity ? fmtUsd(t.liquidity, { compact: true }) : "—"} />
              </div>

              <button onClick={() => copy(t.mint)} title="Copy contract address"
                className="group inline-flex items-center gap-1 font-mono text-[10px] text-muted/80 hover:text-white transition-colors">
                <span>{short(t.mint)}</span>
                {copied === t.mint ? <Check className="w-3 h-3 text-up" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <Link to={`/token/${t.mint}?chain=robinhood`} className="btn bg-accent/15 text-accent text-[11px] inline-flex items-center justify-center gap-1 py-1.5 font-bold">View data <ArrowUpRight className="w-3 h-3" /></Link>
                <a href={t.poolAddress ? GT(t.poolAddress) : "#"} target="_blank" rel="noreferrer" className="btn bg-panel2 text-white text-[11px] inline-flex items-center justify-center gap-1 py-1.5">Chart <ExternalLink className="w-3 h-3" /></a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
