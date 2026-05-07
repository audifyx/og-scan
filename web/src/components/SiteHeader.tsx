import { Activity, AtSign, Newspaper } from "lucide-react";
import { OGSCAN_SITE_URL, OGSCAN_TECH_POST_URL, OGSCAN_X_URL } from "@/lib/og";

type Props = { mint: string };

export const SiteHeader = ({ mint }: Props) => {
  return (
    <header className="sticky top-0 z-40 border-b border-og-grid bg-og-ink/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="group flex items-center gap-3">
          <div className="relative grid h-9 w-9 place-items-center border-2 border-og-gold bg-og-ink">
            <span className="font-display text-sm font-bold text-og-gold">OG</span>
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-og-lime" />
          </div>
          <div>
            <div className="font-display text-sm font-bold tracking-[0.24em] text-foreground">ogscan<span className="text-og-lime">.fun</span></div>
            <div className="text-[9px] uppercase tracking-[0.4em] text-muted-foreground">OG coin radar · solana</div>
          </div>
        </a>

        <nav className="hidden items-center gap-6 text-[10px] uppercase tracking-[0.3em] text-muted-foreground md:flex">
          <a href="#og-stats" className="hover:text-og-lime">Vitals</a>
          <a href="#scanner" className="hover:text-og-lime">Scanner</a>
          <a href="#swap" className="hover:text-og-lime">Swap</a>
          <a href="#tech" className="hover:text-og-lime">Tech</a>
          <a href={`https://solscan.io/token/${mint}`} target="_blank" rel="noreferrer" className="hover:text-og-lime">Solscan</a>
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 border border-og-grid bg-og-ink px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-og-lime sm:inline-flex">
            <Activity className="h-3 w-3" /> MAINNET
          </span>
          <a href={OGSCAN_TECH_POST_URL} target="_blank" rel="noreferrer" className="hidden text-muted-foreground hover:text-og-gold sm:inline-flex" title="Read the tech post">
            <Newspaper className="h-4 w-4" />
          </a>
          <a href={OGSCAN_X_URL} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-og-lime" title="Follow ogscan.fun on X">
            <AtSign className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
};
