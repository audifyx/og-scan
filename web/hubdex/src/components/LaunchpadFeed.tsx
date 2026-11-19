import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ExternalLink, Loader2, Rocket, Search, ShieldOff, Sparkles,
  Copy, Check, RefreshCw, Flame, TrendingUp, Droplets, Clock, User,
} from "lucide-react";
import { getLaunches, LaunchedToken, fmtUsd, short } from "../lib/api";
import { getChain } from "../lib/chains";
import { VANITY_SUFFIX, isVanityAddress } from "../lib/vanity-mint";

type SortKey = "new" | "mcap" | "volume" | "liquidity";
const SORTS: { key: SortKey; label: string; icon: any }[] = [
  { key: "new",       label: "Newest",    icon: Clock },
  { key: "mcap",      label: "Market cap", icon: TrendingUp },
  { key: "volume",    label: "Volume",    icon: Flame },
  { key: "liquidity", label: "Liquidity", icon: Droplets },
];

const FRESH_MS = 10 * 60 * 1000; // "fresh" = launched in the last 10 minutes
const NEW_MS = 5 * 60 * 1000;    // pulse badge for the first 5 minutes

function ageMs(iso: string) { return Date.now() - new Date(iso).getTime(); }
function timeAgo(iso: string): string {
  const s = Math.floor(ageMs(iso) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).then(() => {
      setCopied(v);
      setTimeout(() => setCopied((c) => (c === v ? null : c)), 1200);
    }).catch(() => {});
  };
  return { copied, copy };
}

/** Highlight the trailing vanity suffix of a CA so the "…obx" brand is obvious. */
function CaBadge({ mint, copied, onCopy }: { mint: string; copied: string | null; onCopy: (v: string) => void }) {
  const vanity = isVanityAddress(mint);
  return (
    <button
      onClick={() => onCopy(mint)}
      title="Copy contract address"
      className="group inline-flex items-center gap-1 font-mono text-[10px] text-muted/80 hover:text-white transition-colors"
    >
      <span>{short(mint)}</span>
      {vanity && <span className="text-accent font-bold uppercase">·{VANITY_SUFFIX}</span>}
      {copied === mint
        ? <Check className="w-3 h-3 text-up" />
        : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
    </button>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-panel2/60 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted/70">{label}</div>
      <div className={`text-xs font-bold ${accent ? "text-accent" : "text-white"}`}>{value}</div>
    </div>
  );
}

/**
 * The Launchpad coin feed — a live, pump.fun-style board of ONLY the tokens
 * launched through the OrbitX Launchpad (sourced from /api/ogdex/launches,
 * i.e. the ogdex_launches table). Auto-refreshes so fresh launches surface
 * without a reload, with search, sorting and a "fresh" filter.
 */
export default function LaunchpadFeed() {
  const [rows, setRows] = useState<LaunchedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [freshOnly, setFreshOnly] = useState(false);
  const [, forceTick] = useState(0); // re-render so relative ages stay live
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { copied, copy } = useCopy();

  const load = (manual = false) => {
    if (manual) setRefreshing(true);
    getLaunches(120)
      .then((d) => {
        setRows(d.rows || []);
        setErr(d.error || null);
        setUpdatedAt(Date.now());
      })
      .catch((e) => setErr(String(e?.message || e)))
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => {
    load();
    timer.current = setInterval(() => load(), 20_000); // live refresh
    const tick = setInterval(() => forceTick((n) => n + 1), 1000); // live ages
    return () => { if (timer.current) clearInterval(timer.current); clearInterval(tick); };
  }, []);

  const totalMcap = useMemo(
    () => rows.reduce((sum, t) => sum + (t.mcap || 0), 0),
    [rows]
  );
  const freshCount = useMemo(
    () => rows.filter((t) => ageMs(t.created_at) < FRESH_MS).length,
    [rows, updatedAt]
  );

  const view = useMemo(() => {
    const s = q.trim().toLowerCase();
    let out = rows.filter((t) => {
      if (freshOnly && ageMs(t.created_at) >= FRESH_MS) return false;
      if (!s) return true;
      return (
        (t.name || "").toLowerCase().includes(s) ||
        (t.symbol || "").toLowerCase().includes(s) ||
        t.mint.toLowerCase().includes(s)
      );
    });
    const num = (n?: number | null) => (typeof n === "number" && isFinite(n) ? n : -1);
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "mcap":      return num(b.mcap) - num(a.mcap);
        case "volume":    return num(b.volume24h) - num(a.volume24h);
        case "liquidity": return num(b.liquidity) - num(a.liquidity);
        default:          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return out;
  }, [rows, q, sort, freshOnly, updatedAt]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-up/70" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-up" />
          </span>
          <Sparkles className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-black tracking-tight">LIVE&nbsp;FEED</h2>
          <span className="pill bg-accent/15 text-accent text-[10px] font-bold">{rows.length} launched</span>
          {totalMcap > 0 && (
            <span className="pill bg-up/10 text-up text-[10px] font-bold">{fmtUsd(totalMcap, { compact: true })} total MC</span>
          )}
        </div>
        <button
          onClick={() => load(true)}
          className="btn bg-panel2 text-muted hover:text-white text-[11px] inline-flex items-center gap-1.5 py-1.5 px-3"
          title="Refresh now"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {updatedAt ? `updated ${timeAgo(new Date(updatedAt).toISOString())} ago` : "refresh"}
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, ticker, CA…"
            className="bg-panel2 border border-line rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-muted/60 focus:outline-none focus:border-accent/50 w-56"
          />
        </div>
        <div className="flex items-center gap-1 bg-panel2 border border-line rounded-lg p-0.5">
          {SORTS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
                sort === key ? "bg-accent/20 text-accent" : "text-muted hover:text-white"
              }`}
            >
              <Icon className="w-3 h-3" />{label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setFreshOnly((v) => !v)}
          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
            freshOnly ? "border-up/40 bg-up/10 text-up" : "border-line bg-panel2 text-muted hover:text-white"
          }`}
        >
          <Flame className="w-3 h-3" />Fresh {freshCount > 0 && <span className="opacity-80">({freshCount})</span>}
        </button>
      </div>

      {/* Disclaimer */}
      <div className="flex items-center gap-2 text-[11px] text-muted bg-panel2/50 rounded-lg px-3 py-2 border border-line">
        <ShieldOff className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
        Only coins launched on the OrbitX Launchpad appear here. They're
        <span className="text-white">&nbsp;unverified&nbsp;</span>and unboosted — always do your own research. Open any coin for full holder &amp; rug analysis.
      </div>

      {err && !rows.length && (
        <div className="card p-4 text-center text-sm text-yellow-400">Couldn't load the feed right now — retrying automatically.</div>
      )}

      {/* Body */}
      {loading ? (
        <div className="py-20 grid place-items-center text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : view.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <Rocket className="w-8 h-8 text-muted mx-auto" />
          <div className="font-semibold">{q || freshOnly ? "No coins match" : "No coins launched yet"}</div>
          <p className="text-sm text-muted">
            {q || freshOnly ? "Try clearing your search or filter." : `Be the first to launch a coin with a custom …${VANITY_SUFFIX} address.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {view.map((t) => {
            const isNew = ageMs(t.created_at) < NEW_MS;
            return (
              <div key={t.mint} className={`card p-4 space-y-3 transition-colors hover:border-accent/40 ${isNew ? "ring-1 ring-up/40" : ""}`}>
                <div className="flex items-center gap-3">
                  {t.icon
                    ? <img src={t.icon} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    : <div className="w-10 h-10 rounded-full bg-panel2 grid place-items-center text-accent font-bold shrink-0">{(t.symbol || "?").slice(0, 2)}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate flex items-center gap-1.5">
                      {t.name || short(t.mint)}
                      {isNew && <span className="pill bg-up/20 text-up text-[8px] font-black animate-pulse">NEW</span>}
                    </div>
                    <div className="text-xs text-muted font-mono truncate flex items-center gap-1">
                      ${t.symbol || "—"}
                      {t.chain && <span className="pill bg-panel2 text-muted/80 text-[8px] font-bold uppercase">{getChain(t.chain).shortName}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted/70 shrink-0"><Clock className="w-3 h-3" />{timeAgo(t.created_at)}</div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <Stat label="Market cap" value={t.mcap ? fmtUsd(t.mcap, { compact: true }) : "—"} accent />
                  <Stat label="Price" value={fmtUsd(t.priceUsd)} />
                  <Stat label="24h vol" value={t.volume24h ? fmtUsd(t.volume24h, { compact: true }) : "—"} />
                  <Stat label="Liquidity" value={t.liquidity ? fmtUsd(t.liquidity, { compact: true }) : "—"} />
                </div>

                <div className="flex items-center justify-between">
                  <CaBadge mint={t.mint} copied={copied} onCopy={copy} />
                  {t.creator_wallet && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted/70 font-mono" title={t.creator_wallet}>
                      <User className="w-3 h-3" />{short(t.creator_wallet)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <Link to={t.chain && t.chain !== "solana" ? `/token/${t.mint}?chain=${t.chain}` : `/token/${t.mint}`} className="btn bg-accent/15 text-accent text-[11px] inline-flex items-center justify-center gap-1 py-1.5">Chart</Link>
                  {t.chain && t.chain !== "solana" ? (
                    <a href={t.links.explorer || "#"} target="_blank" rel="noreferrer" className="btn bg-panel2 text-white text-[11px] inline-flex items-center justify-center gap-1 py-1.5 col-span-2">explorer <ExternalLink className="w-3 h-3" /></a>
                  ) : (
                    <>
                      <a href={t.links.pumpfun || "#"} target="_blank" rel="noreferrer" className="btn bg-panel2 text-white text-[11px] inline-flex items-center justify-center gap-1 py-1.5">pump <ExternalLink className="w-3 h-3" /></a>
                      <a href={t.links.solscan || "#"} target="_blank" rel="noreferrer" className="btn bg-panel2 text-white text-[11px] inline-flex items-center justify-center gap-1 py-1.5">scan <ExternalLink className="w-3 h-3" /></a>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
