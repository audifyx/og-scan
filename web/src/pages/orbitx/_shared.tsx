// Shared bits for Orbitx Launchpad pages — V3 terminal/cyberpunk aesthetic.
// Exports are unchanged (shortAddr, timeAgo, SectionLabel, StatTile, TokenCard)
// so LaunchpadHome / Profile / Token / About keep working without edits.
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

/* ── Terminal-style section heading ── */
export function SectionLabel({ children, accent = "gold" }: { children: React.ReactNode; accent?: "gold" | "cyan" | "lime" }) {
  const c = accent === "cyan" ? "og-cyan" : accent === "lime" ? "og-lime" : "og-gold";
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={`h-3 w-1 rounded-full bg-[hsl(var(--${c}))] shadow-[0_0_8px_hsl(var(--${c})/0.8)]`} />
      <span className={`font-mono text-[10px] text-[hsl(var(--${c}))]`}>{"//"}</span>
      <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-foreground">{children}</h2>
    </div>
  );
}

/* ── Terminal stat tile (optional neon icon) ── */
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
  const color = accent ? `text-[hsl(var(--og-${accent}))]` : "text-foreground";
  return (
    <div className="stat-tile relative overflow-hidden">
      {accent && (
        <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--og-${accent}))]/60 to-transparent`} />
      )}
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}
        {label}
      </div>
      <div className={`mt-1 font-display text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

/* ── Pill primitives ── */
function Pill({ children, tone }: { children: React.ReactNode; tone: "gold" | "cyan" | "lime" | "blood" | "muted" }) {
  const map: Record<string, string> = {
    gold: "bg-[hsl(var(--og-gold))]/12 text-[hsl(var(--og-gold))] border-[hsl(var(--og-gold))]/25",
    cyan: "bg-[hsl(var(--og-cyan))]/12 text-[hsl(var(--og-cyan))] border-[hsl(var(--og-cyan))]/25",
    lime: "bg-[hsl(var(--og-lime))]/12 text-[hsl(var(--og-lime))] border-[hsl(var(--og-lime))]/25",
    blood: "bg-[hsl(var(--og-blood))]/12 text-[hsl(var(--og-blood))] border-[hsl(var(--og-blood))]/25",
    muted: "bg-white/5 text-muted-foreground border-white/10",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${map[tone]}`}>
      {children}
    </span>
  );
}

/**
 * V3 token card — logo, graduated badge, name + ticker, market cap,
 * graduation progress bar, short CA, time since launch, glow-on-hover.
 * `mc` (live market cap, USD) is optional and purely presentational.
 */
export function TokenCard({ t, mc }: { t: OrbitxToken; mc?: number | null }) {
  const graduated = !!t.lp_pool_address;
  const pct = graduated
    ? 100
    : typeof mc === "number" && mc > 0
      ? Math.max(2, Math.min(99, Math.round((mc / GRADUATION_MC_USD) * 100)))
      : 3;

  return (
    <Link
      to={`/orbitxlaunch/token/${t.mint_address}`}
      className="og-glass-card lp-card group flex flex-col gap-3 p-4"
    >
      {/* header: logo + name/ticker + status badge */}
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/12 bg-white/5 shadow-[0_0_18px_-8px_hsl(var(--og-gold)/0.6)]">
          {t.logo_url ? (
            <img src={t.logo_url} alt={t.ticker} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-sm font-bold text-muted-foreground">
              {t.ticker?.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-sm font-bold text-foreground">{t.name}</span>
            <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-[hsl(var(--og-gold))]">${t.ticker}</span>
          </div>
          <div className="mt-0.5 font-mono text-xs font-bold text-[hsl(var(--og-cyan))]">{fmtMc(mc)}</div>
        </div>
        {graduated ? (
          <Pill tone="lime"><Droplets className="h-3 w-3" /> Graduated</Pill>
        ) : (
          <Pill tone="cyan"><Flame className="h-3 w-3" /> Fresh</Pill>
        )}
      </div>

      {/* graduation progress */}
      <div>
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Graduation</span>
          <span className={graduated ? "text-[hsl(var(--og-lime))]" : "text-[hsl(var(--og-gold))]"}>{pct}%</span>
        </div>
        <div className="lp-progress">
          <div className={`lp-progress-fill ${graduated ? "is-complete" : ""}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* footer: CA + lane + vamp status + age */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">{shortAddr(t.mint_address, 5)}</span>
        <Pill tone={t.launch_type === "pump" ? "cyan" : "gold"}>{t.launch_type === "pump" ? "Pump" : "Custom"}</Pill>
        {t.is_vamp ? (
          <Pill tone="blood"><ShieldAlert className="h-3 w-3" /> Vamp</Pill>
        ) : (
          <Pill tone="muted"><ShieldCheck className="h-3 w-3" /> Unique</Pill>
        )}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{timeAgo(t.created_at)}</span>
      </div>
    </Link>
  );
}
