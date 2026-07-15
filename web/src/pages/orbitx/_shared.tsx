// Shared bits for Orbitx Launchpad pages — DEX terminal/glass aesthetic.
import { Link } from "react-router-dom";
import { ShieldCheck, ShieldAlert, Droplets, Flame } from "lucide-react";
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

/* ── Terminal-style section heading ── */
export function SectionLabel({ children, accent = "gold" }: { children: React.ReactNode; accent?: "gold" | "cyan" | "lime" }) {
  const c = accent === "cyan" ? "og-cyan" : accent === "lime" ? "og-lime" : "og-gold";
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={`h-3 w-1 rounded-full bg-[hsl(var(--${c}))]`} />
      <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-foreground">{children}</h2>
    </div>
  );
}

/* ── Terminal stat tile ── */
export function StatTile({ label, value, accent }: { label: string; value: React.ReactNode; accent?: "gold" | "cyan" | "lime" | "blood" }) {
  const color = accent ? `text-[hsl(var(--og-${accent}))]` : "text-foreground";
  return (
    <div className="stat-tile">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-base font-bold ${color}`}>{value}</div>
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

export function TokenCard({ t }: { t: OrbitxToken }) {
  const graduated = !!t.lp_pool_address;
  return (
    <Link
      to={`/orbitxlaunch/token/${t.mint_address}`}
      className="og-glass-card lift group flex flex-col gap-3 p-4"
    >
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/12 bg-white/5">
          {t.logo_url ? (
            <img src={t.logo_url} alt={t.ticker} className="h-full w-full object-cover" />
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
          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{shortAddr(t.mint_address, 5)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {graduated ? (
          <Pill tone="lime"><Droplets className="h-3 w-3" /> Graduated</Pill>
        ) : (
          <Pill tone="cyan"><Flame className="h-3 w-3" /> Fresh</Pill>
        )}
        <Pill tone={t.launch_type === "pump" ? "cyan" : "gold"}>{t.launch_type === "pump" ? "Pump" : "Custom"}</Pill>
        {t.is_vamp ? (
          <Pill tone="blood"><ShieldAlert className="h-3 w-3" /> Vamp</Pill>
        ) : (
          <Pill tone="muted"><ShieldCheck className="h-3 w-3" /> Unique</Pill>
        )}
        {t.dex && <Pill tone="muted">{t.dex}</Pill>}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{timeAgo(t.created_at)}</span>
      </div>
    </Link>
  );
}
