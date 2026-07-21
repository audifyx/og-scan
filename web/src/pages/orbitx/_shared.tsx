// Shared bits for Orbitx Launchpad pages — classic pump.fun (2023) look.
// Exports are unchanged (shortAddr, timeAgo, SectionLabel, StatTile, TokenCard)
// so LaunchpadHome / Profile / Token / About keep working without edits.
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, ShieldAlert, Droplets, Flame } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OrbitxToken } from "@/lib/orbitx/registry";

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
export const GRADUATION_MC_USD = 69_000;

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
export function TokenCard({ t, mc }: { t: OrbitxToken; mc?: number | null }) {
  const graduated = !!(t?.lp_pool_address);
  const pct = graduated
    ? 100
    : typeof mc === "number" && mc > 0
      ? Math.max(2, Math.min(99, Math.round((mc / GRADUATION_MC_USD) * 100)))
      : 3;

  return (
    <Link
      to={`/orbitxlaunch/token/${t.mint_address}`}
      className="pf-card group flex flex-col gap-3 p-3"
    >
      {/* header: logo + name/ticker + status badge */}
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg))]">
          {t.logo_url ? (
            <img src={t.logo_url} alt={t.ticker} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-black text-[hsl(var(--pf-muted))]">
              {t.ticker?.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-black text-[hsl(var(--pf-ink))]">{t.name}</span>
            <span className="pf-mono shrink-0 rounded-full bg-[hsl(var(--pf-ink))/0.06] px-1.5 py-0.5 text-[10px] font-bold text-[hsl(var(--pf-green-dark))]">
              ${t.ticker}
            </span>
          </div>
          <div className="pf-mono mt-0.5 text-xs font-bold text-[hsl(var(--pf-ink))]">{fmtMc(mc)}</div>
        </div>
        {graduated ? (
          <Pill tone="lime"><Droplets className="h-3 w-3" /> Graduated</Pill>
        ) : (
          <Pill tone="cyan"><Flame className="h-3 w-3" /> Fresh</Pill>
        )}
      </div>

      {/* graduation progress */}
      <div>
        <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--pf-muted))]">
          <span>Bonding curve</span>
          <span className={graduated ? "text-[hsl(var(--pf-gold))]" : "text-[hsl(var(--pf-green-dark))]"}>{pct}%</span>
        </div>
        <div className="pf-progress">
          <div className={`pf-progress-fill ${graduated ? "is-complete" : ""}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* footer: CA + lane + vamp status + age */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="pf-mono text-[11px] text-[hsl(var(--pf-muted))]">{shortAddr(t.mint_address, 5)}</span>
        <Pill tone={t.launch_type === "pump" ? "cyan" : "gold"}>{t.launch_type === "pump" ? "Pump" : "Custom"}</Pill>
        {t.is_vamp ? (
          <Pill tone="blood"><ShieldAlert className="h-3 w-3" /> Vamp</Pill>
        ) : (
          <Pill tone="muted"><ShieldCheck className="h-3 w-3" /> Unique</Pill>
        )}
        <span className="pf-mono ml-auto text-[10px] text-[hsl(var(--pf-muted))]">{timeAgo(t.created_at)}</span>
      </div>
    </Link>
  );
}
