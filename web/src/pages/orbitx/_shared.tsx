// Shared bits for Orbitx Launchpad pages — classic pump.fun (2023) look.
// Exports are unchanged (shortAddr, timeAgo, SectionLabel, StatTile, TokenCard)
// so LaunchpadHome / Profile / Token / About keep working without edits.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ShieldCheck, ShieldAlert, Droplets, Flame, Zap, LineChart, TrendingUp, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OrbitxToken } from "@/lib/orbitx/registry";
import { orbitScore, scoreTone } from "./orbitScore";
import { isWatched, toggleWatch } from "./watchlist";

type MarketLite = { mcap?: number | null; liq?: number | null; vol24?: number | null; ch24?: number | null; buys24?: number | null; sells24?: number | null; url?: string | null };

function fmtCompact(v?: number | null): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function OrbitScoreChip({ score }: { score: number }) {
  const tone = scoreTone(score);
  const color = tone === "lime" ? "hsl(var(--pf-green))" : tone === "gold" ? "hsl(var(--pf-gold))" : "hsl(var(--pf-red))";
  return (
    <div className="shrink-0 text-right" title="Orbit Score">
      <div className="pf-mono text-[8px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">Orbit</div>
      <div className="text-lg font-black leading-none" style={{ color }}>{score}</div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] px-2 py-1.5 text-center">
      <div className="pf-mono text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-ink))]">{label}</div>
      <div className={`pf-mono text-[12px] font-black ${tone === "up" ? "text-[hsl(var(--pf-green))]" : tone === "down" ? "text-[hsl(var(--pf-red))]" : "text-[hsl(var(--pf-ink))]"}`}>{value}</div>
    </div>
  );
}

/**
 * Resolves a token image robustly: direct logo URL first, then the token's
 * on-chain metadata JSON `image` (lazy-fetched, cached), then a clean
 * ticker-letters placeholder. Also degrades to the placeholder if the image
 * URL 404s / fails to load, so we never show a broken image box.
 */
export function TokenLogo({ src, metadataUri, symbol, className = "" }: { src?: string | null; metadataUri?: string | null; symbol?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const { data: metaImg } = useQuery({
    queryKey: ["obx-token-logo", metadataUri],
    enabled: !src && !!metadataUri,
    staleTime: 300_000,
    queryFn: async () => {
      try {
        const r = await fetch(metadataUri as string);
        if (!r.ok) return null;
        const j = await r.json();
        return typeof j?.image === "string" ? j.image : null;
      } catch {
        return null;
      }
    },
  });
  const url = src || metaImg || null;
  if (!url || failed) {
    return (
      <div className={`flex items-center justify-center bg-[hsl(var(--pf-bg))] font-black text-[hsl(var(--pf-muted))] ${className}`}>
        {(symbol || "?").slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return <img src={url} alt={symbol || ""} onError={() => setFailed(true)} loading="lazy" draggable={false} className={`h-full w-full object-cover ${className}`} />;
}

export const shortAddr = (a?: string | null, n = 4) =>
  !a ? "—" : a.length <= n * 2 + 1 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** "$0.00000775" style formatting — never exponential notation. */
export function fmtPrice(v?: number | null): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return "—";
  if (v >= 1) return `$${v.toFixed(v >= 100 ? 2 : 4)}`;
  const match = v.toFixed(20).match(/^0\.(0*)(\d+)/);
  if (!match) return `$${v.toPrecision(3)}`;
  const [, zeros, digits] = match;
  return `$0.${zeros}${digits.slice(0, 4)}`;
}

/** Pump-style graduation target used only for the visual progress bar. */
export const GRADUATION_MC_USD = 35_000;

/** "$4.72M MC" style formatting. */
export function fmtMc(v?: number | null): string {
  if (!v || !Number.isFinite(v) || v <= 0) return "— MC";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B MC`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M MC`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K MC`;
  return `$${v.toFixed(0)} MC`;
}

/* ── classic section heading: bold black label, no HUD glow ── */
export function SectionLabel({ children }: { children: React.ReactNode; accent?: "gold" | "cyan" | "lime" }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-sm font-black uppercase tracking-wide text-[hsl(var(--pf-ink))]">{children}</h2>
    </div>
  );
}

/* ── classic stat tile: plain card, big number, small caption ── */
export function StatTile({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  accent?: "gold" | "cyan" | "lime" | "blood";
  icon?: LucideIcon;
}) {
  const color =
    accent === "gold" ? "text-[hsl(var(--pf-gold))]"
    : accent === "blood" ? "text-[hsl(var(--pf-red))]"
    : accent === "cyan" ? "text-[hsl(var(--pf-blue))]"
    : "text-[hsl(var(--pf-green))]";
  return (
    <div className="pf-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--pf-muted))]">
        {Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}
        {label}
      </div>
      <div className={`mt-1 text-xl font-black ${color}`}>{value}</div>
    </div>
  );
}

/**
 * Sets document.title + Open Graph / Twitter meta tags for the duration
 * a component is mounted, restoring the previous values on unmount.
 * Fixes token pages not carrying correct titles/share previews.
 */
export function useDocumentMeta(meta: { title?: string; description?: string; image?: string | null } | null) {
  useEffect(() => {
    if (typeof document === "undefined" || !meta?.title) return;
    const prevTitle = document.title;
    document.title = meta.title;

    const upsert = (attr: "property" | "name", key: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      const existed = !!el;
      const prevContent = el?.content ?? null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.content = content;
      return { el, existed, prevContent };
    };

    const entries = [
      upsert("property", "og:title", meta.title),
      upsert("property", "og:description", meta.description ?? ""),
      upsert("name", "twitter:card", "summary"),
      upsert("name", "description", meta.description ?? ""),
      ...(meta.image ? [upsert("property", "og:image", meta.image)] : []),
    ];

    return () => {
      document.title = prevTitle;
      for (const { el, existed, prevContent } of entries) {
        if (!existed) el.remove();
        else if (prevContent != null) el.content = prevContent;
      }
    };
  }, [meta?.title, meta?.description, meta?.image]);
}

/* ── pill primitives, classic outlined badges ── */
export function Pill({ children, tone }: { children: React.ReactNode; tone: "gold" | "cyan" | "lime" | "blood" | "muted" }) {
  const cls =
    tone === "gold" ? "pf-pill pf-pill--gold"
    : tone === "blood" ? "pf-pill pf-pill--red"
    : tone === "cyan" ? "pf-pill pf-pill--blue"
    : tone === "lime" ? "pf-pill pf-pill--green"
    : "pf-pill";
  return <span className={cls}>{children}</span>;
}

/**
 * Classic pump.fun-style token card — round thumbnail, name + ticker,
 * market cap, bonding-curve progress bar, short CA, age. Light card,
 * black border, green accents, hover lift.
 */
export function TokenCard({ t, mc, market }: { t: OrbitxToken; mc?: number | null; market?: MarketLite | null }) {
  // Hooks must run unconditionally (react-hooks/rules-of-hooks); guard for null t inside the initializer.
  const [watched, setWatched] = useState(() => isWatched(t?.mint_address ?? ""));
  if (!t) return null;
  const mcap = market?.mcap ?? mc ?? null;
  const graduated = !!t.lp_pool_address || !!t.graduated_at || (typeof mcap === "number" && mcap >= GRADUATION_MC_USD);
  const pct = graduated ? 100 : typeof mcap === "number" && mcap > 0 ? Math.max(2, Math.min(99, Math.round((mcap / GRADUATION_MC_USD) * 100))) : 3;
  const buys = market?.buys24 ?? null;
  const sells = market?.sells24 ?? null;
  const tx = (buys ?? 0) + (sells ?? 0);
  const buyPct = tx > 0 ? Math.round(((buys ?? 0) / tx) * 100) : null;
  const os = orbitScore({ liq: market?.liq, mcap, vol24: market?.vol24, buys, sells, ageMs: Date.now() - new Date(t.created_at).getTime(), isVamp: t.is_vamp, graduated });
  const to = `/orbitxlaunch/token/${t.mint_address}`;

  return (
    <div className="pf-card group relative flex flex-col gap-2.5 p-3">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); toggleWatch(t.mint_address); setWatched((w) => !w); }}
        className="absolute right-2 top-2 z-10 rounded-md p-1 text-[hsl(var(--pf-muted))] transition hover:text-[hsl(var(--pf-gold))]"
        title={watched ? "Remove from watchlist" : "Add to watchlist"}
      >
        <Star className={`h-4 w-4 ${watched ? "fill-current text-[hsl(var(--pf-gold))]" : ""}`} />
      </button>
      <Link to={to} className="flex items-start gap-3 pr-6">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg))]">
          <TokenLogo src={t.logo_url} metadataUri={t.metadata_uri} symbol={t.ticker} className="h-full w-full text-sm" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-black text-[hsl(var(--pf-ink))]">{t.name}</span>
            <span className="pf-mono shrink-0 rounded-full bg-[hsl(var(--pf-ink))/0.06] px-1.5 py-0.5 text-[10px] font-bold text-[hsl(var(--pf-green-dark))]">${t.ticker}</span>
          </div>
          <div className="pf-mono mt-0.5 text-xs font-bold text-[hsl(var(--pf-ink))]">{fmtMc(mcap)}</div>
        </div>
        <OrbitScoreChip score={os.score} />
      </Link>

      <div className="grid grid-cols-3 gap-1.5">
        <MiniStat label="Vol 24h" value={fmtCompact(market?.vol24)} />
        <MiniStat label="Liq" value={fmtCompact(market?.liq)} />
        <MiniStat label="Buys" value={buyPct != null ? `${buyPct}%` : "—"} tone={buyPct != null && buyPct >= 50 ? "up" : buyPct != null ? "down" : undefined} />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--pf-muted))]">
          <span>{graduated ? "Graduated" : "Bonding curve"}</span>
          <span className={graduated ? "text-[hsl(var(--pf-gold))]" : "text-[hsl(var(--pf-green-dark))]"}>{pct}%</span>
        </div>
        <div className="pf-progress"><div className={`pf-progress-fill ${graduated ? "is-complete" : ""}`} style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {t.is_vamp
          ? <Pill tone="blood"><ShieldAlert className="h-3 w-3" /> Vamp</Pill>
          : <Pill tone="lime"><ShieldCheck className="h-3 w-3" /> Original</Pill>}
        <Pill tone={t.launch_type === "pump" ? "cyan" : "gold"}>{t.launch_type === "pump" ? "Pump" : "Custom"}</Pill>
        {(market?.vol24 ?? 0) > 2000 && <Pill tone="cyan"><TrendingUp className="h-3 w-3" /> Trending</Pill>}
        {buyPct != null && buyPct >= 70 && (market?.vol24 ?? 0) > 2000 && <Pill tone="blood"><Flame className="h-3 w-3" /> Viral</Pill>}
        {os.score < 40 && <Pill tone="blood"><ShieldAlert className="h-3 w-3" /> High risk</Pill>}
        {graduated && <Pill tone="lime"><Droplets className="h-3 w-3" /> Grad</Pill>}
        <span className="pf-mono ml-auto text-[10px] text-[hsl(var(--pf-muted))]">{timeAgo(t.created_at)}</span>
      </div>

      <div className="mt-0.5 grid grid-cols-2 gap-1.5">
        <Link to={to} className="pf-btn justify-center !py-1.5 text-xs"><Zap className="h-3.5 w-3.5" /> Trade</Link>
        <a href={market?.url || `https://dexscreener.com/solana/${t.mint_address}`} target="_blank" rel="noreferrer" className="pf-btn justify-center !py-1.5 text-xs"><LineChart className="h-3.5 w-3.5" /> Chart</a>
      </div>
    </div>
  );
}
