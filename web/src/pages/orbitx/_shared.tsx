// Shared bits for Orbitx Launchpad pages.
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

export function TokenCard({ t }: { t: OrbitxToken }) {
  const graduated = !!t.lp_pool_address;
  return (
    <Link
      to={`/orbitxlaunch/token/${t.mint_address}`}
      className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-[hsl(var(--og-gold))]/40 hover:bg-black/50"
    >
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          {t.logo_url ? (
            <img src={t.logo_url} alt={t.ticker} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-black text-muted-foreground">
              {t.ticker?.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-bold text-foreground">{t.name}</span>
            <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">${t.ticker}</span>
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{shortAddr(t.mint_address, 5)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        {graduated ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--og-lime))]/15 px-1.5 py-0.5 font-bold text-[hsl(var(--og-lime))]"><Droplets className="h-3 w-3" /> Graduated</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--og-cyan))]/15 px-1.5 py-0.5 font-bold text-[hsl(var(--og-cyan))]"><Flame className="h-3 w-3" /> Fresh</span>
        )}
        {t.is_vamp ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--og-blood))]/15 px-1.5 py-0.5 font-bold text-[hsl(var(--og-blood))]"><ShieldAlert className="h-3 w-3" /> Flagged vamp</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 font-bold text-muted-foreground"><ShieldCheck className="h-3 w-3" /> Verified unique</span>
        )}
        {t.dex && <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-muted-foreground">{t.dex}</span>}
        <span className="ml-auto text-muted-foreground">{timeAgo(t.created_at)}</span>
      </div>
    </Link>
  );
}
