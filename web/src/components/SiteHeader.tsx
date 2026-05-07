import { Activity, AtSign, ExternalLink, Globe2, Newspaper } from "lucide-react";
import { OGSCAN_SITE_URL, OGSCAN_TECH_POST_URL, OGSCAN_X_URL } from "@/lib/og";

type Props = { mint: string };

export const SiteHeader = ({ mint }: Props) => {
  return (
    <header className="sticky top-0 z-40 border-b border-og-grid bg-og-ink/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="group flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-og-lime bg-og-ink shadow-og-lime">
            <img src="/icon.png" alt="OG Scan icon" className="h-full w-full object-cover" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-og-lime shadow-og-lime" />
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

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 border border-og-grid bg-og-ink px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-og-lime lg:inline-flex">
            <Activity className="h-3 w-3" /> MAINNET
          </span>
          <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 border border-og-grid bg-og-ink px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/70 transition hover:border-og-lime hover:text-og-lime sm:inline-flex" title="Open ogscan.fun">
            <Globe2 className="h-3.5 w-3.5" /> Site
          </a>
          <a href={OGSCAN_TECH_POST_URL} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 border border-og-grid bg-og-ink px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/70 transition hover:border-og-gold hover:text-og-gold md:inline-flex" title="Read the tech post">
            <Newspaper className="h-3.5 w-3.5" /> Post
          </a>
          <a href={OGSCAN_X_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 border border-og-lime bg-og-lime px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-og-ink transition hover:bg-og-lime/90" title="Follow ogscan.fun on X">
            <AtSign className="h-3.5 w-3.5" /> X <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </header>
  );
};
